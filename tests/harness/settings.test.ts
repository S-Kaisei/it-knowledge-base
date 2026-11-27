import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

interface Settings {
  permissions: { allow: string[]; ask?: string[]; deny: string[] };
  hooks: Record<string, { matcher?: string; hooks: { type: string; command: string; timeout?: number }[] }[]>;
}

const raw = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'settings.json'), 'utf8');
const settings = JSON.parse(raw) as Settings;

describe('settings.json: permissions', () => {
  it('有効な JSON で allow / deny を持つ', () => {
    expect(Array.isArray(settings.permissions.allow)).toBe(true);
    expect(Array.isArray(settings.permissions.deny)).toBe(true);
  });

  it('広すぎる Bash allow がない（Bash(*) / docker / docker compose exec / npx / bunx / sudo / rm など）', () => {
    const broad = [
      /^Bash$/,
      /^Bash\(\*\)$/,
      /^Bash\(docker \*\)$/,
      /^Bash\(docker compose \*\)$/,
      /^Bash\(docker compose exec (web )?\*\)$/,
      /^Bash\(npx \*\)$/,
      /^Bash\(bunx \*\)$/,
      /^Bash\(bun (x|run) \*\)$/,
      /^Bash\(npm /,
      /^Bash\(sh \*\)$/,
      /^Bash\(bash \*\)$/,
      /^Bash\(rm /,
      /^Bash\(sudo/,
      /^Bash\(git push/,
      /^Bash\(curl/,
      /^Bash\(node \*\)$/,
    ];
    for (const rule of settings.permissions.allow) {
      for (const re of broad) expect(re.test(rule), `broad allow: ${rule}`).toBe(false);
    }
  });

  it('allow の `docker compose exec` は web サービスの bun run に限定されている', () => {
    for (const rule of settings.permissions.allow.filter((r) => r.startsWith('Bash(docker compose exec'))) {
      expect(rule).toMatch(/^Bash\(docker compose exec web bun run [\w:-]+/);
    }
  });

  it('deny に force push・prune・公開・sudo・秘密情報の Read が含まれる', () => {
    const deny = settings.permissions.deny.join('\n');
    for (const needle of [
      'git push --force',
      'git push -f',
      'docker system prune',
      'docker volume prune',
      'npm publish',
      'bun publish',
      'sudo',
      'Read(./.env)',
      'Read(./.env.*)',
      '.ssh',
      '.pem',
    ]) {
      expect(deny, needle).toContain(needle);
    }
  });

  it('push・reset --hard・down -v は ask 以上に置かれ、allow にない', () => {
    const allow = settings.permissions.allow.join('\n');
    const ask = (settings.permissions.ask ?? []).join('\n');
    for (const needle of ['git push', 'git reset --hard', 'docker compose down -v', 'docker volume rm']) {
      expect(allow, needle).not.toContain(needle);
      expect(ask, needle).toContain(needle);
    }
  });
});

describe('settings.json: hooks', () => {
  const entries = Object.entries(settings.hooks).flatMap(([event, groups]) => groups.flatMap((g) => g.hooks.map((h) => ({ event, ...h }))));

  it('SessionStart / PreToolUse / PostToolUse / Stop が登録されている', () => {
    expect(Object.keys(settings.hooks).sort()).toEqual(['PostToolUse', 'PreToolUse', 'SessionStart', 'Stop']);
  });

  it.each(entries)('$event: コマンドは実在する .claude/hooks のファイルを指し、timeout が設定されている', ({ command, timeout }) => {
    const m = command.match(/\.claude\/hooks\/([\w.-]+\.mjs)/);
    expect(m, command).not.toBeNull();
    expect(fs.existsSync(path.join(REPO_ROOT, '.claude', 'hooks', m?.[1] ?? 'missing'))).toBe(true);
    expect(typeof timeout).toBe('number');
    expect(timeout).toBeGreaterThan(0);
  });

  it('フックは $CLAUDE_PROJECT_DIR 経由で参照する（cwd に依存しない）', () => {
    for (const e of entries) expect(e.command).toContain('$CLAUDE_PROJECT_DIR');
  });

  it('.claude/hooks の全スクリプトのうち lib 以外はいずれかのイベントに登録されている', () => {
    const files = fs.readdirSync(path.join(REPO_ROOT, '.claude', 'hooks')).filter((f) => f.endsWith('.mjs') && f !== 'lib.mjs');
    const joined = entries.map((e) => e.command).join('\n');
    for (const f of files) expect(joined, f).toContain(f);
  });
});

describe('個人設定の除外', () => {
  it('.claude/settings.local.json と .claude/.state/ は .gitignore に含まれる', () => {
    const ignore = fs
      .readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8')
      .split('\n')
      .map((l) => l.trim());
    expect(ignore).toContain('.claude/settings.local.json');
    expect(ignore).toContain('.claude/.state/');
  });
});
