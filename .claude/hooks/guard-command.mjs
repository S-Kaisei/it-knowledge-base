#!/usr/bin/env node
// PreToolUse hook: inspects Bash commands and file-tool paths for destructive or sensitive operations.
//
// Output: JSON with hookSpecificOutput.permissionDecision = "deny" | "ask" (exit 0), or nothing (no opinion).
// This is a defense-in-depth heuristic, NOT a security boundary. String analysis cannot catch every
// obfuscation; settings.json permissions, human review and the OS/Docker isolation still matter.
import os from 'node:os';
import path from 'node:path';
import { emitJson, isInside, isMain, projectDir, readHookInput } from './lib.mjs';

const CONTAINER_ROOT = '/app';
const SYSTEM_DIRS = [
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/var',
  '/opt',
  '/System',
  '/Library',
  '/Applications',
  '/boot',
  '/dev',
  '/proc',
  '/sys',
  'C:\\Windows',
];

// ---------------------------------------------------------------------------
// Shell parsing (best effort)
// ---------------------------------------------------------------------------

/**
 * Remove here-document bodies (`<<EOF ... EOF`). Their text is data written to a file or stdin,
 * not commands or file accesses (e.g. writing ".env" into .gitignore). Quoted delimiters
 * ('EOF') are fully literal; unquoted ones may contain $(...) which we keep for inspection.
 */
export function stripHeredocBodies(cmd) {
  return cmd.replace(/<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1([^\n]*)\n([\s\S]*?)\n[ \t]*\2[ \t]*(?=\n|$)/g, (_m, q, _tag, restOfLine, body) => {
    const kept = q ? '' : (body.match(/\$\([^()]*\)|`[^`]*`/g) ?? []).join(' ; ');
    return `__HEREDOC__${restOfLine}${kept ? ` ; ${kept}` : ''}`;
  });
}

/** Extract `$(...)` and backtick substitutions (non-nested) as separate commands. */
function extractSubstitutions(cmd) {
  const subs = [];
  let rest = cmd.replace(/\$\(([^()]*)\)/g, (_, inner) => {
    subs.push(inner);
    return ' __SUBST__ ';
  });
  rest = rest.replace(/`([^`]*)`/g, (_, inner) => {
    subs.push(inner);
    return ' __SUBST__ ';
  });
  return { rest, subs };
}

/** Split a command line into segments (arrays of words) at unquoted ; & | && || and newlines. */
export function splitSegments(cmd) {
  const segments = [];
  let words = [];
  let word = '';
  let hasWord = false;
  let quote = null;
  const pushWord = () => {
    if (hasWord) words.push(word);
    word = '';
    hasWord = false;
  };
  const pushSegment = () => {
    pushWord();
    if (words.length) segments.push(words);
    words = [];
  };
  for (let i = 0; i < cmd.length; i += 1) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < cmd.length) {
        word += cmd[i + 1];
        i += 1;
      } else word += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasWord = true;
      continue;
    }
    if (ch === '\\' && i + 1 < cmd.length) {
      if (cmd[i + 1] !== '\n') {
        word += cmd[i + 1];
        hasWord = true;
      }
      i += 1;
      continue;
    }
    if (ch === ';' || ch === '&' || ch === '|' || ch === '\n') {
      pushSegment();
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      pushWord();
      continue;
    }
    word += ch;
    hasWord = true;
  }
  pushSegment();
  return segments;
}

const WRAPPERS = new Set(['env', 'nice', 'nohup', 'time', 'command', 'builtin', 'exec', 'stdbuf', 'ionice']);

/** Remove leading VAR=value assignments and transparent wrappers. Returns {argv, sudo}. */
function unwrap(argv) {
  let a = [...argv];
  let sudo = false;
  for (let guard = 0; guard < 10 && a.length; guard += 1) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(a[0])) {
      a = a.slice(1);
    } else if (a[0] === 'sudo' || a[0] === 'doas' || a[0] === 'su') {
      sudo = true;
      a = a.slice(1);
      while (a.length && a[0].startsWith('-')) a = a.slice(1);
    } else if (a[0] === 'timeout') {
      a = a.slice(1);
      while (a.length && a[0].startsWith('-')) a = a.slice(1);
      a = a.slice(1); // duration
    } else if (a[0] === 'xargs') {
      a = a.slice(1);
      while (a.length && a[0].startsWith('-')) a = a.slice(1);
    } else if (WRAPPERS.has(a[0])) {
      a = a.slice(1);
      while (a.length && a[0].startsWith('-')) a = a.slice(1);
    } else break;
  }
  return { argv: a, sudo };
}

function base(cmd) {
  return path.basename(cmd ?? '');
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  { re: /(^|[\s/'"=:])\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?($|[\s'"])/, label: '.env ファイル' },
  { re: /\.(pem|p12|pfx|key|keystore|jks)($|[\s'"])/i, label: '秘密鍵・証明書ファイル' },
  { re: /id_(rsa|ed25519|ecdsa|dsa)\b/, label: 'SSH 秘密鍵' },
  { re: /(^|[\s/'"~])\.ssh(\/|$|[\s'"])/, label: '~/.ssh' },
  { re: /\.aws\/(credentials|config)/, label: 'AWS 認証情報' },
  { re: /\.netrc\b/, label: '.netrc' },
  { re: /\.config\/gh\/hosts\.ya?ml/, label: 'GitHub CLI 認証情報' },
  { re: /\.claude\/\.credentials\.json|\.claude\.json\b/, label: 'Claude Code の認証情報' },
  { re: /\.docker\/config\.json/, label: 'Docker 認証情報' },
  { re: /\bsecurity\s+(find|dump)-(generic|internet)-password|\bsecurity\s+dump-keychain/, label: 'キーチェーン' },
];

export function findSecretReference(text) {
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

function expandHome(p, home) {
  if (p === '~' || p === '$HOME' || p === '${HOME}') return home;
  return p.replace(/^(~|\$HOME|\$\{HOME\})(?=\/)/, home);
}

/**
 * Classify a path target for deletion.
 * Returns 'deny' | 'ask' | null.
 */
function classifyDeleteTarget(rawTarget, ctx) {
  const { home, project, cwd, container } = ctx;
  let t = expandHome(rawTarget, home);
  if (container) {
    if (!t.startsWith('/')) t = path.posix.join(ctx.containerCwd ?? CONTAINER_ROOT, t);
    t = path.posix.normalize(t);
    if (t === '/' || t === CONTAINER_ROOT || CONTAINER_ROOT.startsWith(`${t.replace(/\/$/, '')}/`)) {
      return { level: 'deny', reason: `コンテナ内の ${t} 削除はプロジェクト全体（bind mount）を消します` };
    }
    if (t.startsWith(`${CONTAINER_ROOT}/`)) {
      t = path.join(project, path.posix.relative(CONTAINER_ROOT, t));
    } else {
      return null; // container-internal path (e.g. /tmp)
    }
  }
  if (/[*?]/.test(t) && (t === '*' || /^\/\*|^~\/\*/.test(rawTarget) || path.dirname(t) === '/' || path.dirname(t) === home)) {
    return { level: 'deny', reason: `広範囲のワイルドカード削除: ${rawTarget}` };
  }
  const abs = path.resolve(cwd, t.replace(/[*?].*$/, '') || '.');
  if (abs === path.parse(abs).root || abs === home || isInside(home, abs)) {
    return { level: 'deny', reason: `ルート/ホームディレクトリ配下全体の削除: ${rawTarget}` };
  }
  if (abs === project) return { level: 'deny', reason: 'プロジェクトルート全体の削除' };
  if (isInside(abs, path.join(project, '.git'))) return { level: 'deny', reason: '.git ディレクトリの削除' };
  if (!isInside(abs, project)) {
    if (isInside(abs, os.tmpdir()) || abs.startsWith('/tmp/') || abs.startsWith('/private/tmp/')) return null;
    if (SYSTEM_DIRS.some((d) => isInside(abs, d))) return { level: 'deny', reason: `システムディレクトリの削除: ${abs}` };
    return { level: 'ask', reason: `プロジェクト外の削除: ${abs}` };
  }
  return null;
}

function checkRm(argv, ctx, out) {
  const flags = argv.filter((a) => a.startsWith('-'));
  const targets = argv.slice(1).filter((a) => !a.startsWith('-'));
  const recursive = flags.some((f) => /^-[a-zA-Z]*[rR]/.test(f) || f === '--recursive');
  for (const t of targets) {
    const r = classifyDeleteTarget(t, ctx);
    if (r) out.push(recursive || r.level === 'deny' ? r : { level: 'ask', reason: r.reason });
  }
  if (recursive && targets.length === 0) out.push({ level: 'ask', reason: '対象が不明な再帰削除' });
}

function checkGit(argv, out) {
  // skip global options like -C dir, -c k=v
  let i = 1;
  while (i < argv.length && argv[i].startsWith('-')) i += argv[i] === '-C' || argv[i] === '-c' ? 2 : 1;
  const sub = argv[i];
  const args = argv.slice(i + 1);
  const has = (...names) => args.some((a) => names.includes(a));
  switch (sub) {
    case 'push': {
      if (has('--force', '-f', '--mirror') || args.some((a) => /^-[a-zA-Z]*f/.test(a) && !a.startsWith('--')) || args.some((a) => a.startsWith('+'))) {
        out.push({ level: 'deny', reason: 'force push は禁止されています' });
      } else if (args.some((a) => a.startsWith('--force-with-lease') || a.startsWith('--force-if-includes'))) {
        out.push({ level: 'ask', reason: 'force-with-lease による履歴の上書き' });
      } else if (has('--delete', '-d') || args.some((a) => /^:/.test(a))) {
        out.push({ level: 'ask', reason: 'リモートブランチの削除' });
      } else {
        out.push({ level: 'ask', reason: 'リモートへの push（外部への送信）はユーザー承認が必要です' });
      }
      break;
    }
    case 'reset':
      if (has('--hard', '--merge', '--keep')) out.push({ level: 'ask', reason: 'git reset --hard は未コミットの変更を破棄します' });
      break;
    case 'clean':
      if (args.some((a) => /^-[a-zA-Z]*f/.test(a) || a === '--force')) out.push({ level: 'ask', reason: 'git clean は追跡外ファイルを削除します' });
      break;
    case 'checkout':
      if (has('--', '.', '-f', '--force')) out.push({ level: 'ask', reason: 'git checkout による変更の破棄' });
      break;
    case 'restore':
      if (!has('--staged', '-S') || has('--worktree', '-W')) out.push({ level: 'ask', reason: 'git restore による作業ツリー変更の破棄' });
      break;
    case 'branch':
      if (has('-D') || (has('-d', '--delete') && has('-f', '--force'))) out.push({ level: 'ask', reason: '未マージブランチの強制削除' });
      break;
    case 'stash':
      if (has('drop', 'clear')) out.push({ level: 'ask', reason: 'stash の削除' });
      break;
    case 'filter-branch':
    case 'filter-repo':
      out.push({ level: 'ask', reason: '履歴の書き換え' });
      break;
    case 'update-ref':
      if (has('-d')) out.push({ level: 'ask', reason: '参照の削除' });
      break;
    case 'reflog':
      if (has('expire', 'delete')) out.push({ level: 'ask', reason: 'reflog の削除' });
      break;
    case 'gc':
      if (args.some((a) => a.startsWith('--prune'))) out.push({ level: 'ask', reason: '到達不能オブジェクトの即時削除' });
      break;
    case 'config':
      if (has('--global', '--system')) out.push({ level: 'ask', reason: 'ホスト全体の git 設定の変更' });
      break;
    default:
      break;
  }
}

function checkGh(argv, out) {
  const [, group, action] = argv;
  const args = argv.slice(1);
  if (group === 'repo' && (action === 'delete' || action === 'archive')) out.push({ level: 'deny', reason: 'リポジトリの削除・アーカイブは禁止されています' });
  else if (group === 'pr' && ['create', 'merge', 'close', 'review', 'comment', 'edit', 'ready'].includes(action))
    out.push({ level: 'ask', reason: `gh pr ${action}（GitHub への書き込み）` });
  else if (group === 'release' && action !== 'list' && action !== 'view') out.push({ level: 'ask', reason: 'GitHub Release の操作' });
  else if (group === 'workflow' && (action === 'run' || action === 'enable' || action === 'disable'))
    out.push({ level: 'ask', reason: 'GitHub Actions ワークフローの実行・変更（デプロイの可能性）' });
  else if (group === 'secret' || group === 'variable') out.push({ level: 'ask', reason: 'GitHub のシークレット・変数の操作' });
  else if (group === 'issue' && ['create', 'close', 'comment', 'edit', 'delete'].includes(action))
    out.push({ level: 'ask', reason: `gh issue ${action}（GitHub への書き込み）` });
  else if (group === 'api') {
    const methodIdx = args.findIndex((a) => a === '-X' || a === '--method');
    const method = methodIdx >= 0 ? (args[methodIdx + 1] ?? '').toUpperCase() : args.some((a) => /^-[fF]$|^--(raw-)?field$|^--input$/.test(a)) ? 'POST' : 'GET';
    if (method !== 'GET') out.push({ level: 'ask', reason: `gh api ${method}（GitHub への書き込み）` });
  }
}

const DANGEROUS_MOUNT_SOURCES = (home) => ['/', home, '/var/run/docker.sock', '/run/docker.sock', '/etc', '/var', '/Users', '/home', '/root'];

function checkDockerRunFlags(args, ctx, out) {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--privileged' || a.startsWith('--privileged=')) out.push({ level: 'deny', reason: '特権コンテナ（--privileged）は禁止されています' });
    if (a === '--cap-add' || a.startsWith('--cap-add=')) out.push({ level: 'deny', reason: 'capability の追加は禁止されています' });
    if (/^--(pid|ipc|uts|userns)(=|$)/.test(a) && /host/.test(`${a} ${args[i + 1] ?? ''}`))
      out.push({ level: 'deny', reason: 'ホスト名前空間の共有は禁止されています' });
    if (a === '--device' || a.startsWith('--device=')) out.push({ level: 'deny', reason: 'ホストデバイスの割り当ては禁止されています' });
    if (/^--security-opt/.test(a) && /unconfined|disable/.test(`${a} ${args[i + 1] ?? ''}`))
      out.push({ level: 'deny', reason: 'セキュリティプロファイルの無効化は禁止されています' });
    if (a === '-v' || a === '--volume' || a === '--mount' || a.startsWith('--volume=') || a.startsWith('--mount=') || a.startsWith('-v')) {
      const spec = a.includes('=') ? a.split('=').slice(1).join('=') : a.length > 2 && a.startsWith('-v') ? a.slice(2) : (args[i + 1] ?? '');
      const src = expandHome(
        spec.startsWith('type=') || spec.includes('source=') || spec.includes('src=') ? (spec.match(/(?:source|src)=([^,]+)/)?.[1] ?? '') : spec.split(':')[0],
        ctx.home,
      );
      if (src.includes('docker.sock')) out.push({ level: 'deny', reason: 'Docker ソケットのマウントは禁止されています' });
      else if (src && DANGEROUS_MOUNT_SOURCES(ctx.home).includes(path.resolve(src)))
        out.push({ level: 'deny', reason: `ホストの広範囲ディレクトリのマウント: ${src}` });
    }
  }
}

/** Parse `docker compose exec|run [opts] service cmd...` → inner argv (or null). */
function composeInner(sub, args) {
  const withValue = new Set([
    '-e',
    '--env',
    '-u',
    '--user',
    '-w',
    '--workdir',
    '--index',
    '--name',
    '--entrypoint',
    '-p',
    '--publish',
    '-v',
    '--volume',
    '-l',
    '--label',
    '--cap-add',
    '--cap-drop',
    '--pull',
  ]);
  let i = 0;
  let workdir;
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '-w' || args[i] === '--workdir') workdir = args[i + 1];
    i += withValue.has(args[i]) ? 2 : 1;
  }
  const service = args[i];
  const inner = args.slice(i + 1);
  return service ? { service, inner, workdir } : null;
}

function checkDocker(argv, ctx, out, depth) {
  let args = argv.slice(1);
  let compose = false;
  if (base(argv[0]) === 'docker-compose') compose = true;
  else if (args[0] === 'compose') {
    compose = true;
    args = args.slice(1);
  }
  if (compose) {
    // drop global compose options
    while (args.length && args[0].startsWith('-'))
      args = args.slice(['-f', '--file', '-p', '--project-name', '--profile', '--env-file', '--project-directory'].includes(args[0]) ? 2 : 1);
    const [sub, ...rest] = args;
    if (sub === 'down' && rest.some((a) => a === '-v' || a === '--volumes' || a === '--rmi'))
      out.push({ level: 'ask', reason: 'docker compose down -v はボリューム（node_modules 等）を削除します' });
    if (sub === 'rm' && rest.some((a) => a === '-v' || a === '--volumes')) out.push({ level: 'ask', reason: 'ボリュームの削除' });
    if (sub === 'run') checkDockerRunFlags(rest, ctx, out);
    if (sub === 'exec' || sub === 'run') {
      const parsed = composeInner(sub, rest);
      if (parsed && parsed.inner.length) {
        evaluateCommandString(
          parsed.inner.map(quoteArg).join(' '),
          { ...ctx, container: true, containerCwd: parsed.workdir ?? CONTAINER_ROOT },
          out,
          depth + 1,
        );
      }
    }
    return;
  }
  const [sub, ...rest] = args;
  const joined = rest.join(' ');
  if (sub === 'system' && rest[0] === 'prune') out.push({ level: 'deny', reason: 'docker system prune は無断実行禁止です' });
  if (sub === 'volume' && rest[0] === 'prune') out.push({ level: 'deny', reason: 'docker volume prune は無断実行禁止です' });
  if (sub === 'volume' && rest[0] === 'rm') out.push({ level: 'ask', reason: 'Docker ボリュームの削除' });
  if (['image', 'container', 'network', 'builder', 'buildx'].includes(sub) && rest.includes('prune')) out.push({ level: 'ask', reason: `docker ${sub} prune` });
  if (sub === 'rmi' || (sub === 'image' && rest[0] === 'rm')) out.push({ level: 'ask', reason: 'Docker イメージの削除' });
  if (sub === 'run' || sub === 'create') checkDockerRunFlags(rest, ctx, out);
  if (sub === 'exec' && /\s/.test(joined)) {
    const withValue = new Set(['-e', '--env', '-u', '--user', '-w', '--workdir', '--env-file']);
    let i = 0;
    while (i < rest.length && rest[i].startsWith('-')) i += withValue.has(rest[i]) ? 2 : 1;
    const inner = rest.slice(i + 1);
    if (inner.length) evaluateCommandString(inner.map(quoteArg).join(' '), { ...ctx, container: true, containerCwd: '/' }, out, depth + 1);
  }
}

function quoteArg(a) {
  return /[\s;&|'"$`\\]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a;
}

function checkSegment(rawArgv, ctx, out, depth) {
  const { argv, sudo } = unwrap(rawArgv);
  if (sudo) out.push({ level: 'deny', reason: 'sudo / su による権限昇格は禁止されています' });
  if (!argv.length) return;
  const cmd = base(argv[0]);
  const joined = argv.join(' ');

  // Nested shells: bash -c "...", sh -c, eval
  if (['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish'].includes(cmd)) {
    const ci = argv.findIndex((a) => a === '-c' || /^-[a-z]*c$/.test(a));
    if (ci >= 0 && argv[ci + 1]) evaluateCommandString(argv[ci + 1], ctx, out, depth + 1);
    return;
  }
  if (cmd === 'eval') {
    evaluateCommandString(argv.slice(1).join(' '), ctx, out, depth + 1);
    return;
  }

  if (/--dangerously-skip-permissions|bypassPermissions/.test(joined)) out.push({ level: 'deny', reason: '権限チェックを無効化する操作は禁止されています' });

  const secret = findSecretReference(joined);
  if (secret) out.push({ level: 'deny', reason: `機密情報（${secret}）へのアクセスは禁止されています` });

  switch (cmd) {
    case 'rm':
    case 'rmdir':
    case 'unlink':
    case 'shred':
      checkRm(argv, ctx, out);
      break;
    case 'find':
      if (argv.includes('-delete') || (argv.includes('-exec') && argv.some((a) => a === 'rm'))) {
        const start = argv[1] && !argv[1].startsWith('-') ? argv[1] : '.';
        const r = classifyDeleteTarget(start, ctx);
        // Filtered deletes inside the project are routine (e.g. removing *.tmp); only the scope matters.
        if (r && !(r.reason === 'プロジェクトルート全体の削除')) out.push(r);
      }
      break;
    case 'git':
      checkGit(argv, out);
      break;
    case 'gh':
      checkGh(argv, out);
      break;
    case 'docker':
    case 'docker-compose':
    case 'podman':
      checkDocker(argv, ctx, out, depth);
      break;
    case 'npm':
    case 'pnpm':
    case 'yarn':
      if (['publish', 'unpublish', 'deprecate'].includes(argv[1])) out.push({ level: 'deny', reason: 'パッケージの公開操作は禁止されています' });
      if (argv[1] === 'run' && /^(deploy|publish|release)(:|$)/.test(argv[2] ?? '')) out.push({ level: 'ask', reason: 'デプロイ・公開系スクリプトの実行' });
      if (['login', 'adduser', 'token'].includes(argv[1])) out.push({ level: 'ask', reason: 'npm 認証情報の操作' });
      break;
    case 'npx':
      if (/^(gh-pages|vercel|netlify|wrangler|surge|firebase)(@|$)/.test(argv[1] ?? '')) out.push({ level: 'ask', reason: '外部ホスティングへのデプロイ' });
      break;
    case 'gh-pages':
    case 'vercel':
    case 'netlify':
    case 'wrangler':
    case 'firebase':
      out.push({ level: 'ask', reason: '外部ホスティングへのデプロイ' });
      break;
    case 'curl':
    case 'wget':
    case 'http':
    case 'xh': {
      const upload =
        argv.some(
          (a) =>
            /^(-d|--data.*|-F|--form.*|-T|--upload-file|--post-data|--post-file|--body-data|--body-file)$/.test(a) ||
            (/^-[a-zA-Z]*[dFT]$/.test(a) && a.length <= 3),
        ) || /-X\s*(POST|PUT|PATCH|DELETE)|--request\s*(POST|PUT|PATCH|DELETE)|--method=(POST|PUT|PATCH|DELETE)/i.test(joined);
      if (upload) out.push({ level: 'ask', reason: '外部へのデータ送信の可能性（curl/wget のアップロード）' });
      break;
    }
    case 'nc':
    case 'ncat':
    case 'netcat':
    case 'socat':
    case 'telnet':
    case 'scp':
    case 'sftp':
    case 'ftp':
      out.push({ level: 'ask', reason: `外部への通信・送信（${cmd}）` });
      break;
    case 'rsync':
      if (argv.some((a) => /^[^/\s]+@?[^/\s]*:/.test(a) && !a.startsWith('-'))) out.push({ level: 'ask', reason: 'rsync による外部への転送' });
      if (argv.includes('--delete')) out.push({ level: 'ask', reason: 'rsync --delete による削除' });
      break;
    case 'dd':
      if (argv.some((a) => /^of=\/dev\//.test(a))) out.push({ level: 'deny', reason: 'デバイスへの直接書き込みは禁止されています' });
      break;
    case 'mkfs':
    case 'fdisk':
    case 'diskutil':
    case 'shutdown':
    case 'reboot':
    case 'halt':
    case 'launchctl':
    case 'systemctl':
      out.push({ level: 'deny', reason: `システム操作（${cmd}）は禁止されています` });
      break;
    case 'chmod':
    case 'chown':
    case 'chgrp': {
      const targets = argv.slice(1).filter((a) => !a.startsWith('-'));
      const recursive = argv.some((a) => /^-[a-zA-Z]*R/.test(a));
      if (recursive) {
        for (const t of targets.slice(1)) {
          const r = classifyDeleteTarget(t, ctx);
          if (r) out.push({ level: r.level, reason: `${cmd} -R: ${r.reason.replace(/削除/g, '変更')}` });
        }
      }
      if (cmd === 'chmod' && targets[0] === '777' && recursive) out.push({ level: 'ask', reason: 'chmod -R 777' });
      break;
    }
    case 'printenv':
      out.push({ level: 'ask', reason: '環境変数の一覧表示（機密情報を含む可能性）' });
      break;
    case 'env':
      if (argv.length === 1) out.push({ level: 'ask', reason: '環境変数の一覧表示（機密情報を含む可能性）' });
      break;
    default:
      break;
  }
}

/** Evaluate a full command string, appending findings to `out`. */
function evaluateCommandString(command, ctx, out, depth = 0) {
  if (depth > 5) {
    out.push({ level: 'ask', reason: 'ネストが深すぎるコマンド' });
    return;
  }
  const { rest, subs } = extractSubstitutions(stripHeredocBodies(command));
  for (const s of subs) evaluateCommandString(s, ctx, out, depth + 1);
  const segments = splitSegments(rest);
  for (const seg of segments) checkSegment(seg, ctx, out, depth);
  // pipe-to-shell (curl ... | sh)
  if (/\|\s*(sudo\s+)?(ba|z|da|k)?sh\b/.test(rest) && /\b(curl|wget)\b/.test(rest)) out.push({ level: 'ask', reason: 'ダウンロードしたスクリプトの直接実行' });
}

// ---------------------------------------------------------------------------
// File tools
// ---------------------------------------------------------------------------

function evaluateFileTool(toolName, toolInput, ctx) {
  const out = [];
  const raw = toolInput?.file_path ?? toolInput?.notebook_path ?? toolInput?.path;
  if (typeof raw !== 'string' || !raw) return out;
  const abs = path.resolve(ctx.cwd, expandHome(raw, ctx.home));
  const secret = findSecretReference(` ${abs} `);
  if (secret) out.push({ level: 'deny', reason: `機密情報（${secret}）へのアクセスは禁止されています` });
  if (toolName !== 'Read' && !isInside(abs, ctx.project)) {
    const allowed = [os.tmpdir(), '/tmp', '/private/tmp', path.join(ctx.home, '.claude', 'projects')].some((d) => isInside(abs, d));
    if (!allowed) out.push({ level: 'ask', reason: `プロジェクト外のファイルへの書き込み: ${abs}` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/**
 * Pure evaluation function (unit-tested).
 * @returns {{decision: 'deny'|'ask'|null, reasons: string[]}}
 */
export function evaluate(input, env = {}) {
  const project = env.project ?? projectDir();
  const home = env.home ?? os.homedir();
  const cwd = input?.cwd ? path.resolve(input.cwd) : project;
  const ctx = { project, home, cwd, container: false };
  if (!input || typeof input !== 'object') return { decision: 'ask', reasons: ['フック入力を解析できませんでした（安全側で確認を求めます）'] };
  const toolName = input.tool_name;
  const toolInput = input.tool_input ?? {};
  let findings = [];
  if (toolName === 'Bash') {
    const command = typeof toolInput.command === 'string' ? toolInput.command : '';
    evaluateCommandString(command, ctx, findings);
  } else if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
    findings = evaluateFileTool(toolName, toolInput, ctx);
  }
  const deny = findings.filter((f) => f.level === 'deny');
  const ask = findings.filter((f) => f.level === 'ask');
  if (deny.length) return { decision: 'deny', reasons: [...new Set(deny.map((f) => f.reason))] };
  if (ask.length) return { decision: 'ask', reasons: [...new Set(ask.map((f) => f.reason))] };
  return { decision: null, reasons: [] };
}

async function main() {
  const input = await readHookInput();
  const { decision, reasons } = evaluate(input);
  if (!decision) return;
  emitJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: `[guard-command] ${reasons.join(' / ')}${decision === 'deny' ? '。必要な場合はユーザーに理由を説明し、手動での実行を依頼してください。' : ''}`,
    },
  });
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    // Unexpected failure: ask rather than silently allow.
    emitJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `[guard-command] フックの内部エラー: ${err?.message ?? err}`,
      },
    });
  });
}
