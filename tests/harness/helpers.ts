import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const HOOKS_DIR = path.join(REPO_ROOT, '.claude', 'hooks');

export interface HookJson {
  decision?: string;
  reason?: string;
  systemMessage?: string;
  hookSpecificOutput?: { hookEventName?: string; permissionDecision?: string; permissionDecisionReason?: string; additionalContext?: string };
}

export interface HookRun {
  status: number | null;
  stdout: string;
  stderr: string;
  /** Parsed stdout: object, null when empty, undefined when not valid JSON. */
  json: HookJson | null | undefined;
}

/** Run a hook script as a subprocess with the given stdin. Only ever runs the hook itself, never the analysed command. */
export function runHook(script: string, stdin: string | object, opts: { cwd?: string; env?: Record<string, string | undefined> } = {}): HookRun {
  const res = spawnSync(process.execPath, [path.join(HOOKS_DIR, script)], {
    cwd: opts.cwd ?? REPO_ROOT,
    input: typeof stdin === 'string' ? stdin : JSON.stringify(stdin),
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, ...opts.env },
  });
  const stdout = res.stdout ?? '';
  let json: HookJson | null | undefined;
  try {
    json = stdout.trim() ? (JSON.parse(stdout) as HookJson) : null;
  } catch {
    json = undefined;
  }
  return { status: res.status, stdout, stderr: res.stderr ?? '', json };
}

const FAKE_DOCKER = `#!/bin/sh
# Fake docker for hook tests. Behaviour is selected by FAKE_DOCKER (pass | fail | unavailable); every call is logged.
[ -n "$FAKE_DOCKER_LOG" ] && echo "$*" >> "$FAKE_DOCKER_LOG"
case "$1" in
  info)
    [ "$FAKE_DOCKER" = "unavailable" ] && { echo "Cannot connect to the Docker daemon" >&2; exit 1; }
    echo "26.0.0"; exit 0 ;;
  volume) exit 0 ;;
  compose)
    case "$*" in
      *" ps "*) exit 0 ;;
      *" bun run "*)
        if [ "$FAKE_DOCKER" = "fail" ]; then
          echo "line1"; echo "FAKE GATE FAILURE: lint exploded" >&2; exit 1
        fi
        echo "ok"; exit 0 ;;
    esac ;;
esac
exit 0
`;

export interface TempRepo {
  dir: string;
  bin: string;
  dockerLog: string;
  env: Record<string, string>;
  dockerCalls: () => string[];
  write: (rel: string, content: string) => void;
  cleanup: () => void;
}

const git = (cwd: string, ...args: string[]) =>
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });

/** Create a throw-away git repo (committed baseline) and a fake `docker` placed first on PATH. */
export function createTempRepo(files: Record<string, string>, branch = 'feature/x'): TempRepo {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ikb-hook-')));
  const bin = `${dir}-bin`;
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 });
  const dockerLog = path.join(bin, 'docker.log');
  fs.writeFileSync(dockerLog, '');
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  };
  git(dir, 'init', '-q', '-b', branch);
  for (const [rel, content] of Object.entries(files)) write(rel, content);
  if (!Object.keys(files).length) write('README.md', '# t\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  return {
    dir,
    bin,
    dockerLog,
    env: {
      CLAUDE_PROJECT_DIR: dir,
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      FAKE_DOCKER_LOG: dockerLog,
      FAKE_DOCKER: 'pass',
    },
    dockerCalls: () => fs.readFileSync(dockerLog, 'utf8').split('\n').filter(Boolean),
    write,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(bin, { recursive: true, force: true });
    },
  };
}
