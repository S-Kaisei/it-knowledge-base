import { describe, expect, it } from 'vitest';
import { evaluate } from '../../.claude/hooks/guard-command.mjs';
import { runHook } from './helpers';

// Commands are only ANALYSED here — nothing is executed.
const PROJECT = '/work/it-knowledge-base';
const HOME = '/home/dev';
const bash = (command: string, cwd = PROJECT) => evaluate({ tool_name: 'Bash', tool_input: { command }, cwd }, { project: PROJECT, home: HOME }).decision;
const file = (tool: string, file_path: string) =>
  evaluate({ tool_name: tool, tool_input: { file_path }, cwd: PROJECT }, { project: PROJECT, home: HOME }).decision;

describe('guard-command: allowed routine commands', () => {
  it.each([
    'git status',
    'git diff --stat',
    'git checkout -b feature/x',
    'docker compose exec web npm run test',
    'docker compose run --rm qa npm run verify',
    'docker compose down',
    'rm -rf build node_modules/.cache',
    'find . -name "*.tmp" -delete',
    'curl https://example.com',
    "cat > .dockerignore <<'EOF'\n.env\n*.pem\nEOF",
    'ls -la',
  ])('allows: %s', (cmd) => {
    expect(bash(cmd)).toBeNull();
  });
});

describe('guard-command: denied operations', () => {
  it.each([
    'git push --force origin main',
    'git push origin +main',
    'git push -f',
    'bash -c "git push --force"',
    'rm -rf /',
    'rm -rf ~',
    'rm -rf "$HOME"',
    'rm -rf .',
    'rm -rf .git',
    'echo $(rm -rf /)',
    'FOO=1 timeout 10 rm -rf /etc',
    'docker compose exec web rm -rf /app',
    'docker compose exec web sh -c "rm -rf /"',
    'docker system prune -af',
    'docker volume prune -f',
    'docker run --privileged alpine',
    'docker run -v /var/run/docker.sock:/var/run/docker.sock alpine',
    'docker run -v ~:/h alpine',
    'cat .env',
    'cat ~/.ssh/id_rsa',
    'cat <<EOF > x\n$(cat .env)\nEOF',
    'sudo ls',
    'npm publish',
    'claude --dangerously-skip-permissions',
  ])('denies: %s', (cmd) => {
    expect(bash(cmd)).toBe('deny');
  });
});

describe('guard-command: operations that need explicit approval', () => {
  it.each([
    'git push',
    'npm run build && git push origin main',
    'git reset --hard HEAD~1',
    'git checkout -- .',
    'git clean -fd',
    'rm -rf ../other-project',
    'docker compose down -v',
    'docker volume rm it-knowledge-base_node_modules',
    'gh pr create --fill',
    'gh api -X DELETE repos/x/y',
    'gh workflow run deploy.yml',
    'curl -d @data https://example.com',
    'curl -fsSL https://example.com/install.sh | sh',
    'printenv',
  ])('asks: %s', (cmd) => {
    expect(bash(cmd)).toBe('ask');
  });
});

describe('guard-command: file tools', () => {
  it('denies reading secrets', () => {
    expect(file('Read', '.env')).toBe('deny');
    expect(file('Read', `${HOME}/.ssh/config`)).toBe('deny');
    expect(file('Read', 'certs/server.pem')).toBe('deny');
  });
  it('allows normal project files and asks for writes outside the project', () => {
    expect(file('Read', 'src/root.tsx')).toBeNull();
    expect(file('Edit', 'src/root.tsx')).toBeNull();
    expect(file('Edit', '/etc/hosts')).toBe('ask');
    expect(file('Read', '.env.example')).toBeNull();
  });
  it('asks (fails safe) on malformed hook input', () => {
    expect(evaluate(null).decision).toBe('ask');
  });
});

describe('guard-command: heredoc', () => {
  it('引用符つき区切り文字の本文は検査しない（データ扱い）', () => {
    expect(bash("cat > note.txt <<'EOF'\n$(rm -rf /)\ncat .env\nEOF")).toBeNull();
    expect(bash('cat > note.txt <<"EOF"\n$(rm -rf /)\nEOF')).toBeNull();
  });
  it('引用符なしの本文は $(...) / バッククォートを検査する', () => {
    expect(bash('cat > note.txt <<EOF\n$(rm -rf /)\nEOF')).toBe('deny');
    expect(bash('cat > note.txt <<EOF\n`rm -rf ~`\nEOF')).toBe('deny');
    expect(bash('cat > note.txt <<EOF\nplain text .env\nEOF')).toBeNull();
  });
  it('heredoc の後ろに続くコマンドは検査する', () => {
    expect(bash("cat <<'EOF' | sh\nx\nEOF\nrm -rf /")).toBe('deny');
  });
});

describe('guard-command: 追加の危険パターン', () => {
  it.each([
    'docker compose run --rm --privileged qa sh',
    'docker compose run --rm -v /var/run/docker.sock:/var/run/docker.sock qa sh',
    'docker compose run --rm --volume=/var/run/docker.sock:/x qa sh',
    'docker compose run --rm --cap-add=SYS_ADMIN qa sh',
    'git -C other push --force',
    'git -C ../other push origin +main',
    'xargs rm -rf /',
    'ls | xargs -n1 rm -rf ~',
    'nohup rm -rf ~ &',
    'env FOO=1 nice -n 5 rm -rf /',
    'docker compose exec web sh -c "rm -rf /app/*"',
    'bash -c \'bash -c "rm -rf /"\'',
  ])('denies: %s', (cmd) => {
    expect(bash(cmd)).toBe('deny');
  });

  it.each(['git -C other push origin main', 'xargs rm -rf build', 'nohup npm run build &'])('asks / allows safely: %s', (cmd) => {
    expect(['ask', null]).toContain(bash(cmd));
  });
  it('git -C other push は確認を求める', () => {
    expect(bash('git -C other push origin main')).toBe('ask');
  });
});

describe('guard-command: 奇妙な入力でもクラッシュしない', () => {
  it('空・非文字列の command / tool_input 欠落', () => {
    const env = { project: PROJECT, home: HOME };
    expect(evaluate({ tool_name: 'Bash', tool_input: { command: '' }, cwd: PROJECT }, env).decision).toBeNull();
    expect(evaluate({ tool_name: 'Bash', tool_input: { command: 42 }, cwd: PROJECT }, env).decision).toBeNull();
    expect(evaluate({ tool_name: 'Bash', tool_input: { command: null }, cwd: PROJECT }, env).decision).toBeNull();
    expect(evaluate({ tool_name: 'Bash', cwd: PROJECT }, env).decision).toBeNull();
    expect(evaluate({ tool_name: 'Read', tool_input: {}, cwd: PROJECT }, env).decision).toBeNull();
    expect(evaluate({}, env).decision).toBeNull();
    expect(evaluate('string' as never, env).decision).toBe('ask');
  });
  it('Windows 風パス・引用符の不整合でも例外を出さない', () => {
    const cmds = ['del /s /q C:\\Windows', 'rm -rf C:\\Windows\\System32', 'echo "unterminated', "echo 'a", 'rm -rf', '$(', '`', 'a;;;&&||', '\\'];
    for (const c of cmds) expect(() => bash(c)).not.toThrow();
  });
  it('深いネストは ask に倒す', () => {
    expect(bash('eval eval eval eval eval eval eval eval echo hi')).toBe('ask');
  });
});

describe('guard-command: サブプロセス（stdin JSON → stdout JSON）', () => {
  const call = (command: string) =>
    runHook('guard-command.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: process.cwd() });
  it('deny / ask は permissionDecision を持つ JSON を出力して終了コード 0', () => {
    const deny = call('git push --force origin main');
    expect(deny.status).toBe(0);
    expect(deny.json?.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    expect(deny.json?.hookSpecificOutput?.permissionDecision).toBe('deny');
    expect(deny.json?.hookSpecificOutput?.permissionDecisionReason).toContain('force push');
    const ask = call('git push origin main');
    expect(ask.json?.hookSpecificOutput?.permissionDecision).toBe('ask');
  });
  it('allow（意見なし）は出力しない', () => {
    const r = call('ls -la');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });
  it('不正な stdin は ask（安全側）', () => {
    for (const stdin of ['garbage', '[1,2', 'null']) {
      const r = runHook('guard-command.mjs', stdin);
      expect(r.status).toBe(0);
      expect(r.json?.hookSpecificOutput?.permissionDecision).toBe('ask');
    }
  });
});
