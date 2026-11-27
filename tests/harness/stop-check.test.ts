import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyChanges, hasRunningBackgroundTasks, selectGates } from '../../.claude/hooks/stop-check.mjs';
import { createTempRepo, runHook, type TempRepo } from './helpers';

// Stop フックを一時 git リポジトリ + 偽 docker で実行する（実際の docker・検証コマンドは一切実行しない）。
const PKG = JSON.stringify({
  scripts: { verify: 'x', typecheck: 'x', lint: 'x', test: 'x', 'content:check': 'x', 'lint:md': 'x' },
});

let repo: TempRepo | undefined;
afterEach(() => repo?.cleanup());
const R = (): TempRepo => {
  if (!repo) throw new Error('repo not set up');
  return repo;
};

const stop = (input: object = {}, env: Record<string, string> = {}) =>
  runHook('stop-check.mjs', { session_id: 's1', hook_event_name: 'Stop', ...input }, { cwd: R().dir, env: { ...R().env, ...env } });

describe('stop-check: classifyChanges / selectGates（純粋関数）', () => {
  const scripts: Record<string, string> = { verify: '', typecheck: '', lint: '', test: '', 'content:check': '', 'lint:md': '' };
  const names = (files: string[], s: Record<string, string> = scripts) =>
    selectGates(classifyChanges(files), s).gates.map((g: { name: string; args: string[] }) => [g.name, ...g.args].join(' '));

  it('記事のみの変更 → content:check / lint:md / test', () => {
    expect(names(['src/content/fundamentals/a.mdx'])).toEqual(['content:check', 'lint:md', 'test']);
  });
  it('コード変更 → verify --quick（記事が混在してもコード優先）', () => {
    expect(names(['src/lib/a.ts'])).toEqual(['verify -- --quick']);
    expect(names(['src/content/a/b.mdx', 'scripts/x.mjs'])).toEqual(['verify -- --quick']);
    expect(names(['.claude/hooks/stop-check.mjs'])).toEqual(['verify -- --quick']);
  });
  it('verify が無ければ typecheck / lint / test にフォールバックする', () => {
    const rest = { ...scripts };
    delete rest.verify;
    expect(names(['src/a.ts'], rest)).toEqual(['typecheck', 'lint', 'test']);
  });
  it('ドキュメントのみ → lint:md', () => {
    expect(names(['docs/a.md', 'README.md'])).toEqual(['lint:md']);
  });
  it('設定ファイル等は検証なし。未整備 script は skipped に入る', () => {
    expect(names(['.gitignore'])).toEqual([]);
    expect(selectGates(classifyChanges(['docs/a.md']), {}).skipped).toEqual(['lint:md']);
  });
  it('Docker / CI 変更は note のみ（ゲートは走らせない）', () => {
    const d = selectGates(classifyChanges(['Dockerfile', 'docker/nginx.conf']), scripts);
    expect(d.gates).toEqual([]);
    expect(d.notes.join()).toContain('Docker');
    const c = selectGates(classifyChanges(['.github/workflows/ci.yml']), scripts);
    expect(c.gates).toEqual([]);
    expect(c.notes.join()).toContain('CI');
  });
  it('code / content では E2E 未実行の note を出す', () => {
    expect(selectGates(classifyChanges(['src/a.ts']), scripts).notes.join()).toContain('verify');
  });
  it('hasRunningBackgroundTasks: 配列・オブジェクト・空', () => {
    expect(hasRunningBackgroundTasks({})).toBe(false);
    expect(hasRunningBackgroundTasks({ background_tasks: [] })).toBe(false);
    expect(hasRunningBackgroundTasks({ background_tasks: [{ status: 'running' }] })).toBe(true);
    expect(hasRunningBackgroundTasks({ background_tasks: { a: { status: 'completed' } } })).toBe(false);
    expect(hasRunningBackgroundTasks({ background_tasks: { a: { status: 'in_progress' } } })).toBe(true);
  });
});

describe('stop-check: サブプロセス', () => {
  const setup = (files: Record<string, string> = { 'package.json': PKG, 'src/a.ts': 'export const a = 1;\n' }) => {
    repo = createTempRepo(files);
  };
  let n = 0;
  const touchCode = () => {
    n += 1;
    R().write('src/a.ts', `export const a = ${n + 100};\n`);
  };
  const runCalls = () =>
    R()
      .dockerCalls()
      .filter((c) => c.includes(' bun run '));

  it('H12: クリーンな作業ツリー → 出力なし・docker を呼ばない', () => {
    setup();
    const r = stop();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
    expect(R().dockerCalls()).toEqual([]);
  });

  it('H15: package.json がなくても block しない（未整備を通知）', () => {
    setup({ 'README.md': '# t\n' });
    R().write('src/a.ts', 'export {};\n');
    const r = stop();
    expect(r.status).toBe(0);
    expect(r.json?.decision).toBeUndefined();
    expect(r.json?.systemMessage ?? '').toMatch(/未整備/);
    expect(R().dockerCalls()).toEqual([]);
  });

  it('H8: ゲート失敗 → decision block（コマンド・出力末尾・1/3 回目）。状態は一時ディレクトリ配下', () => {
    setup();
    touchCode();
    const r = stop({}, { FAKE_DOCKER: 'fail' });
    expect(r.status).toBe(0);
    expect(r.json?.decision).toBe('block');
    expect(r.json?.reason).toContain('bun run verify -- --quick');
    expect(r.json?.reason).toContain('FAKE GATE FAILURE: lint exploded');
    expect(r.json?.reason).toContain('1/3');
    const state = JSON.parse(fs.readFileSync(path.join(R().dir, '.claude/.state/stop-check.json'), 'utf8')) as { sessions: { s1: { failures: number } } };
    expect(state.sessions.s1.failures).toBe(1);
  });

  it('H9: 同じ fingerprint + stop_hook_active=true → 再度 block しない', () => {
    setup();
    touchCode();
    expect(stop({}, { FAKE_DOCKER: 'fail' }).json?.decision).toBe('block');
    const before = R().dockerCalls().length;
    const r = stop({ stop_hook_active: true }, { FAKE_DOCKER: 'fail' });
    expect(r.json?.decision).toBeUndefined();
    expect(r.json?.systemMessage).toContain('ブロックせず');
    expect(R().dockerCalls().length).toBe(before);
  });

  it('H9: 修正のたびに失敗しても MAX_ATTEMPTS 回で block をやめる', () => {
    setup();
    for (let i = 1; i <= 3; i += 1) {
      touchCode();
      const r = stop({ stop_hook_active: i > 1 }, { FAKE_DOCKER: 'fail' });
      expect(r.json?.decision).toBe('block');
      expect(r.json?.reason).toContain(`${i}/3`);
    }
    touchCode();
    const r = stop({ stop_hook_active: true }, { FAKE_DOCKER: 'fail' });
    expect(r.json?.decision).toBeUndefined();
    expect(r.json?.systemMessage).toContain('3 回連続');
  });

  it('H11: Docker 不可 → 一度だけ「未検証」で block、同じ fingerprint の 2 回目は block しない', () => {
    setup();
    touchCode();
    const first = stop({}, { FAKE_DOCKER: 'unavailable' });
    expect(first.json?.decision).toBe('block');
    expect(first.json?.reason).toContain('未検証');
    const second = stop({ stop_hook_active: true }, { FAKE_DOCKER: 'unavailable' });
    expect(second.status).toBe(0);
    expect(second.stdout.trim()).toBe('');
    expect(runCalls()).toEqual([]);
  });

  it('ゲート通過 → 品質ゲート通過を通知。同じ fingerprint では docker を再実行しない', () => {
    setup();
    touchCode();
    const r1 = stop();
    expect(r1.json?.decision).toBeUndefined();
    expect(r1.json?.systemMessage).toContain('品質ゲート通過');
    expect(runCalls()).toHaveLength(1);
    const r2 = stop();
    expect(r2.stdout.trim()).toBe('');
    expect(runCalls()).toHaveLength(1);
    touchCode(); // a new change triggers the gate again
    stop();
    expect(runCalls()).toHaveLength(2);
  });

  it('記事のみの変更 → content:check → lint:md → test を順に実行する', () => {
    setup({ 'package.json': PKG, 'README.md': '# t\n' });
    R().write('src/content/fundamentals/a.mdx', '---\n---\n');
    const r = stop();
    expect(r.json?.systemMessage).toContain('品質ゲート通過');
    expect(runCalls().map((c) => c.split('bun run ')[1])).toEqual(['content:check', 'lint:md', 'test']);
  });

  it('バックグラウンドタスク実行中 → 保留（docker 未呼び出し・block なし）', () => {
    setup();
    touchCode();
    const r = stop({ background_tasks: [{ id: 't1', status: 'running' }] }, { FAKE_DOCKER: 'fail' });
    expect(r.json?.decision).toBeUndefined();
    expect(r.json?.systemMessage).toContain('保留');
    expect(R().dockerCalls()).toEqual([]);
  });

  it('IKB_STOP_CHECK=off → 何もしない / 不正な stdin でも落ちない', () => {
    setup();
    touchCode();
    expect(stop({}, { IKB_STOP_CHECK: 'off' }).stdout.trim()).toBe('');
    const r = runHook('stop-check.mjs', 'garbage', { cwd: R().dir, env: R().env });
    expect(r.status).toBe(0);
  });
});
