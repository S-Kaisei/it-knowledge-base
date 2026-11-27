import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { summarize } from '../../.claude/hooks/session-start.mjs';
import { createTempRepo, runHook, type TempRepo } from './helpers';

const base = { branch: 'feature/x', changed: [] as string[], dockerOk: true, webRunning: false, hasPackageJson: true, hasNodeModulesVolume: true };

describe('session-start summarize（純粋関数）', () => {
  it('main ブランチでは警告を出す', () => {
    expect(summarize({ ...base, branch: 'main' })).toContain('main 上です');
    expect(summarize(base)).not.toContain('main 上です');
  });
  it('Docker 不可 → 「未検証」と報告するよう促す', () => {
    const out = summarize({ ...base, dockerOk: false });
    expect(out).toContain('Docker: 利用不可');
    expect(out).toContain('未検証');
  });
  it('package.json なし → 初期構築中として通知する', () => {
    expect(summarize({ ...base, hasPackageJson: false })).toContain('package.json 未作成');
  });
  it('未コミットの変更を件数つきで要約する（6 件以上は省略）', () => {
    const out = summarize({ ...base, changed: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(out).toContain('6 件');
    expect(out).toContain('ほか');
  });
});

let repo: TempRepo | undefined;
afterEach(() => repo?.cleanup());

const snapshot = (dir: string) => {
  const status = spawnSync('git', ['status', '--porcelain', '-uall'], { cwd: dir, encoding: 'utf8' }).stdout;
  const files = fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => !String(f).startsWith('.git'))
    .map(String)
    .sort();
  return { status, files };
};

describe('session-start: サブプロセス', () => {
  it('偽 docker 環境で有効な JSON（additionalContext）を出力し、リポジトリを変更しない', () => {
    repo = createTempRepo({ 'package.json': '{}' }, 'main');
    const before = snapshot(repo.dir);
    const r = runHook('session-start.mjs', { hook_event_name: 'SessionStart', source: 'startup', cwd: repo.dir }, { cwd: repo.dir, env: repo.env });
    expect(r.status).toBe(0);
    expect(r.json?.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    const ctx = r.json?.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('main 上です');
    expect(ctx).toContain('Docker: 利用可能');
    expect(snapshot(repo.dir)).toEqual(before);
    expect(repo.dockerCalls().every((c) => /^(info|compose ps|volume ls)/.test(c))).toBe(true);
  });

  it('Docker 不可・package.json なしでも終了コード 0 で「未検証」を案内する', () => {
    repo = createTempRepo({}, 'feature/y');
    const r = runHook('session-start.mjs', {}, { cwd: repo.dir, env: { ...repo.env, FAKE_DOCKER: 'unavailable' } });
    expect(r.status).toBe(0);
    const ctx = r.json?.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('未検証');
    expect(ctx).toContain('package.json 未作成');
    expect(path.isAbsolute(repo.dir)).toBe(true);
  });

  it('不正な stdin でも落ちない', () => {
    repo = createTempRepo({});
    const r = runHook('session-start.mjs', 'garbage', { cwd: repo.dir, env: repo.env });
    expect(r.status).toBe(0);
    expect(r.json?.hookSpecificOutput?.additionalContext).toBeTruthy();
  });
});
