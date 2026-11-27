// Shared helpers for Claude Code hooks.
// Hooks run on the HOST with the host's Node.js (>=18). Keep this file dependency-free.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Read all of stdin (with a safety timeout) and parse it as JSON. Returns {} on empty input, null on invalid JSON. */
export async function readHookInput({ timeoutMs = 3000 } = {}) {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  const read = new Promise((resolve) => {
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', resolve);
    process.stdin.on('error', resolve);
  });
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([read, timeout]);
  clearTimeout(timer);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Resolve the project root: $CLAUDE_PROJECT_DIR, else the repo containing this file. */
export function projectDir() {
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/** Run a command without a shell. Never throws. */
export function run(cmd, args, { cwd, timeoutMs = 10_000, env } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    ok: res.status === 0 && !res.error,
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    timedOut: res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGTERM',
    missing: res.error?.code === 'ENOENT',
  };
}

export function emitJson(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

export function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function tail(text, lines = 60) {
  const arr = String(text).trimEnd().split('\n');
  return arr.slice(-lines).join('\n');
}

/** True when this module is executed directly (not imported by tests). */
export function isMain(importMetaUrl) {
  try {
    return fs.realpathSync(fileURLToPath(importMetaUrl)) === fs.realpathSync(process.argv[1] ?? '');
  } catch {
    return false;
  }
}
