#!/usr/bin/env node
// Stop hook: run quality gates that match what changed, before Claude finishes.
//
// Loop safety (Claude Code also force-stops after 8 consecutive blocks):
//   - No working-tree changes vs HEAD            → no-op (consultation / research tasks)
//   - Same fingerprint already passed             → no-op
//   - stop_hook_active and nothing changed since the last failure → don't block again
//   - failures >= MAX_ATTEMPTS for this session   → stop blocking, report as unresolved
//   - Docker unavailable                          → block ONCE asking Claude to report "未検証", then allow
//   - package.json / script missing (bootstrap)   → gate skipped, never blocks
// Disable with IKB_STOP_CHECK=off.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { emitJson, isMain, projectDir, readHookInput, readJsonSafe, run, tail } from './lib.mjs';

const MAX_ATTEMPTS = Number(process.env.IKB_STOP_CHECK_MAX_ATTEMPTS ?? 3);
const GATE_TIMEOUT_MS = Number(process.env.IKB_STOP_CHECK_TIMEOUT_MS ?? 8 * 60 * 1000);

/** Classify changed paths into areas. */
export function classifyChanges(files) {
  const areas = new Set();
  for (const f of files) {
    if (/^src\/content\/|^public\/images\//.test(f)) areas.add('content');
    else if (
      /^(src|scripts|tests)\//.test(f) ||
      /^(package(-lock)?\.json|tsconfig[^/]*\.json|[^/]+\.config\.(ts|mjs|js|cjs)|\.markdownlint[^/]*|\.prettierrc[^/]*|eslint\.config\.[^/]+)$/.test(f)
    )
      areas.add('code');
    else if (/^\.claude\/hooks\//.test(f)) areas.add('code');
    else if (/^(Dockerfile|compose\.ya?ml|\.dockerignore)$|^docker\//.test(f)) areas.add('docker');
    else if (/^\.github\//.test(f)) areas.add('ci');
    else if (/\.mdx?$/.test(f)) areas.add('docs');
    else areas.add('other');
  }
  return areas;
}

/** Decide which npm scripts to run, given the changed areas and available scripts. */
export function selectGates(areas, scripts) {
  const has = (s) => Object.prototype.hasOwnProperty.call(scripts ?? {}, s);
  const gates = [];
  const skipped = [];
  const want = (name, args = []) => {
    if (has(name)) gates.push({ name, args });
    else skipped.push(name);
  };
  if (areas.has('code')) {
    if (has('verify')) gates.push({ name: 'verify', args: ['--', '--quick'] });
    else ['typecheck', 'lint', 'test'].forEach((s) => want(s));
  } else if (areas.has('content')) {
    want('content:check');
    want('lint:md');
    want('test');
  } else if (areas.has('docs')) {
    want('lint:md');
  }
  const notes = [];
  if (areas.has('docker'))
    notes.push('Docker 設定が変更されています。`docker compose build` と該当サービスの起動確認を行ってください（Stop フックでは重いビルドを自動実行しません）');
  if (areas.has('ci')) notes.push('CI 設定が変更されています。ワークフローは GitHub 上でのみ完全に検証できます');
  if (areas.has('content') || areas.has('code'))
    notes.push('静的ビルド・E2E は Stop フックでは実行しません。完了報告の前に `docker compose run --rm qa npm run verify` を実行してください');
  return { gates, skipped, notes };
}

function gitChangedFiles(cwd) {
  const r = run('git', ['status', '--porcelain=v1', '-uall', '-z'], { cwd, timeoutMs: 10000 });
  if (!r.ok) return null;
  const entries = r.stdout.split('\0').filter(Boolean);
  const files = [];
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const status = e.slice(0, 2);
    files.push(e.slice(3));
    if (status.startsWith('R') || status.startsWith('C')) i += 1; // skip rename source
  }
  return files;
}

function fingerprint(cwd, files) {
  const h = crypto.createHash('sha256');
  h.update(run('git', ['rev-parse', 'HEAD'], { cwd }).stdout);
  h.update(run('git', ['diff', 'HEAD', '--no-color', '--binary'], { cwd, timeoutMs: 20000 }).stdout);
  for (const f of files) {
    const abs = path.join(cwd, f);
    try {
      const st = fs.statSync(abs);
      h.update(`${f}:${st.size}:${st.size < 1_000_000 ? crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex') : st.mtimeMs}`);
    } catch {
      h.update(`${f}:deleted`);
    }
  }
  return h.digest('hex').slice(0, 16);
}

function loadState(file) {
  const s = readJsonSafe(file, { sessions: {} });
  return s && typeof s === 'object' && s.sessions ? s : { sessions: {} };
}

function saveState(file, state) {
  const entries = Object.entries(state.sessions)
    .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
    .slice(0, 20);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ sessions: Object.fromEntries(entries) }, null, 2)}\n`);
}

function dockerStatus(project) {
  const info = run('docker', ['info', '--format', '{{.ServerVersion}}'], { cwd: project, timeoutMs: 8000 });
  if (!info.ok) return { available: false };
  const ps = run('docker', ['compose', 'ps', '--status', 'running', '--services'], { cwd: project, timeoutMs: 8000 });
  return { available: true, webRunning: ps.ok && ps.stdout.split('\n').includes('web') };
}

function runGate(project, docker, gate) {
  const npmArgs = ['run', gate.name, ...gate.args];
  const args = docker.webRunning
    ? ['compose', 'exec', '-T', 'web', 'npm', ...npmArgs]
    : ['compose', 'run', '--rm', '--no-deps', '-T', 'web', 'npm', ...npmArgs];
  const display = `docker ${args.join(' ')}`;
  const r = run('docker', args, { cwd: project, timeoutMs: GATE_TIMEOUT_MS });
  return { ...r, display };
}

async function main() {
  if (process.env.IKB_STOP_CHECK === 'off') return;
  const input = (await readHookInput()) ?? {};
  const project = projectDir();
  const files = gitChangedFiles(project);
  if (!files || files.length === 0) return; // not a repo, or nothing changed

  const relevant = files.filter((f) => !/^\.claude\/\.state\//.test(f));
  if (!relevant.length) return;

  const stateFile = path.join(project, '.claude', '.state', 'stop-check.json');
  const state = loadState(stateFile);
  const sid = String(input.session_id ?? 'unknown');
  const s = state.sessions[sid] ?? { failures: 0 };
  s.updatedAt = Date.now();
  const fp = fingerprint(project, relevant);

  const finish = (output) => {
    state.sessions[sid] = s;
    saveState(stateFile, state);
    if (output) emitJson(output);
  };

  if (s.passed === fp) return finish(null);
  if (s.unverified === fp) return finish(null);
  if (input.stop_hook_active && s.lastFailed === fp) {
    return finish({ systemMessage: '[stop-check] 前回失敗した品質ゲートから変更がないため、ブロックせずに終了します。失敗は未解決として報告してください。' });
  }
  if (s.failures >= MAX_ATTEMPTS) {
    return finish({
      systemMessage: `[stop-check] 品質ゲートが ${s.failures} 回連続で失敗しました。これ以上ブロックしません。失敗内容を未解決の課題として報告してください。`,
    });
  }

  const pkg = readJsonSafe(path.join(project, 'package.json'), null);
  const areas = classifyChanges(relevant);
  const { gates, skipped, notes } = selectGates(areas, pkg?.scripts);

  if (!gates.length) {
    s.passed = fp;
    const msg = [skipped.length ? `未整備のため未実行の検証: ${skipped.join(', ')}` : '', ...notes].filter(Boolean);
    return finish(msg.length ? { systemMessage: `[stop-check] ${msg.join(' / ')}` } : null);
  }

  const docker = dockerStatus(project);
  if (!docker.available) {
    s.unverified = fp;
    return finish({
      decision: 'block',
      reason: `[stop-check] Docker が利用できないため品質ゲート（${gates.map((g) => g.name).join(', ')}）を実行できませんでした。変更は「未検証」です。完了報告では検証できていないことを明記してください（このメッセージは一度だけ表示されます）。`,
    });
  }

  const results = [];
  for (const gate of gates) {
    const r = runGate(project, docker, gate);
    results.push({ gate, r });
    if (!r.ok) break;
  }
  const failed = results.find((x) => !x.r.ok);
  if (!failed) {
    s.passed = fp;
    s.failures = 0;
    s.lastFailed = undefined;
    const ok = results.map((x) => `✓ ${x.r.display}`).join('\n');
    return finish({
      systemMessage: `[stop-check] 品質ゲート通過:\n${ok}${notes.length ? `\n${notes.join('\n')}` : ''}${skipped.length ? `\n未整備: ${skipped.join(', ')}` : ''}`,
    });
  }

  s.failures = (s.failures ?? 0) + 1;
  s.lastFailed = fp;
  const why = failed.r.timedOut ? `タイムアウト（${Math.round(GATE_TIMEOUT_MS / 1000)} 秒）` : `終了コード ${failed.r.status}`;
  return finish({
    decision: 'block',
    reason: [
      `[stop-check] 品質ゲートが失敗しました（${s.failures}/${MAX_ATTEMPTS} 回目）: ${failed.r.display} → ${why}`,
      '原因を特定して修正してください。テストの削除や仕様の変更で通すことは禁止です。修正できない場合は未解決として報告してください。',
      '--- 出力（末尾） ---',
      tail(`${failed.r.stdout}\n${failed.r.stderr}`, 60),
    ].join('\n'),
  });
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`[stop-check] internal error: ${err?.message ?? err}\n`);
    process.exit(1); // non-blocking
  });
}
