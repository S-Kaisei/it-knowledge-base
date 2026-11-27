#!/usr/bin/env node
// SessionStart hook: read-only status report injected as context. Never modifies files or environment.
import fs from 'node:fs';
import path from 'node:path';
import { emitJson, isMain, projectDir, readHookInput, run } from './lib.mjs';

export function summarize({ branch, changed, dockerOk, webRunning, hasPackageJson, hasNodeModulesVolume }) {
  const lines = [];
  lines.push('## プロジェクト状態（session-start フック）');
  lines.push(`- ブランチ: ${branch || '(不明)'}${branch === 'main' ? ' ← main 上です。作業前に Phase/機能ごとのブランチを切ってください' : ''}`);
  lines.push(
    `- 未コミットの変更: ${changed.length ? `${changed.length} 件（${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ' ほか' : ''}）` : 'なし'}`,
  );
  if (!dockerOk) lines.push('- Docker: 利用不可。品質ゲートは実行できないため、検証結果は「未検証」として報告すること');
  else lines.push(`- Docker: 利用可能 / web コンテナ: ${webRunning ? '起動中' : '停止中（`docker compose up -d --build web` で起動）'}`);
  if (!hasPackageJson) lines.push('- package.json 未作成（初期構築中）。npm スクリプトに依存する検証はスキップされます');
  else if (dockerOk && !hasNodeModulesVolume && !webRunning)
    lines.push('- 依存関係が未インストールの可能性があります（初回は `docker compose up -d --build web`）');
  lines.push('');
  lines.push('主要コマンド: `docker compose exec web npm run typecheck|lint|test|build` / `docker compose run --rm qa npm run verify`');
  lines.push('作業ループ: Understand → Plan → Implement → Review → Verify → Fix → Re-verify → Report（詳細は CLAUDE.md）');
  return lines.join('\n');
}

async function main() {
  const input = await readHookInput();
  const project = projectDir();
  const cwd = input?.cwd && fs.existsSync(input.cwd) ? input.cwd : project;
  const branch = run('git', ['branch', '--show-current'], { cwd, timeoutMs: 3000 }).stdout.trim();
  const status = run('git', ['status', '--porcelain'], { cwd, timeoutMs: 5000 });
  const changed = status.ok
    ? status.stdout
        .split('\n')
        .filter(Boolean)
        .map((l) => l.slice(3))
    : [];
  const docker = run('docker', ['info', '--format', '{{.ServerVersion}}'], { cwd, timeoutMs: 5000 });
  const dockerOk = docker.ok && docker.stdout.trim().length > 0;
  let webRunning = false;
  let hasNodeModulesVolume = false;
  if (dockerOk) {
    const ps = run('docker', ['compose', 'ps', '--status', 'running', '--services'], { cwd: project, timeoutMs: 5000 });
    webRunning = ps.ok && ps.stdout.split('\n').includes('web');
    const vols = run('docker', ['volume', 'ls', '--format', '{{.Name}}'], { cwd: project, timeoutMs: 5000 });
    hasNodeModulesVolume = vols.ok && /node_modules/.test(vols.stdout);
  }
  const hasPackageJson = fs.existsSync(path.join(project, 'package.json'));
  emitJson({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: summarize({ branch, changed, dockerOk, webRunning, hasPackageJson, hasNodeModulesVolume }),
    },
  });
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`[session-start] internal error: ${err?.message ?? err}\n`);
    process.exit(1);
  });
}
