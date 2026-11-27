#!/usr/bin/env node
// PostToolUse hook (Edit|Write): fast, file-local checks. Never runs builds or E2E.
//   errors   → {"decision":"block","reason":...}  (Claude is told to fix them)
//   warnings → hookSpecificOutput.additionalContext
import fs from 'node:fs';
import path from 'node:path';
import { emitJson, isInside, isMain, projectDir, readHookInput, run } from './lib.mjs';

const ARTICLE_RE = /^src\/content\/([^/]+)\/([^/]+)\.mdx?$/;
const REQUIRED_KEYS = ['title', 'description', 'slug', 'category', 'difficulty', 'draft', 'lastUpdated'];
// Keep in sync with PLACEHOLDER_RE in scripts/lib/validate.mjs (content:check).
const PLACEHOLDER_RE = /\b(TODO|FIXME|TBD|XXX)\b|lorem ipsum|ここに(本文|説明|図)を|（要確認）|\(要確認\)/i;

/** Split markdown into lines, marking which lines are inside fenced code blocks. Returns {lines, fenceOpen}. */
function scanFences(text) {
  const lines = text.split(/\r?\n/);
  let fence = null;
  const inFence = lines.map((line) => {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (m) {
      if (!fence) {
        fence = m[1];
        return true;
      }
      if (m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) {
        fence = null;
        return true;
      }
    }
    return fence !== null;
  });
  return { lines, inFence, fenceOpen: fence !== null };
}

function parseFrontmatter(text) {
  if (!/^---\r?\n/.test(text)) return null;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return { broken: true };
  const block = text.slice(4, end);
  const keys = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) keys[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  const bodyStart = text.indexOf('\n', end + 4);
  return { keys, bodyOffsetLine: text.slice(0, bodyStart < 0 ? text.length : bodyStart).split('\n').length };
}

/**
 * Pure check function (unit-tested).
 * @param {string} rel  path relative to the project root (posix separators)
 * @param {string} text file contents
 * @returns {{errors: string[], warnings: string[]}}
 */
export function checkFile(rel, text) {
  const errors = [];
  const warnings = [];
  const ext = path.extname(rel).toLowerCase();

  if (ext === '.json') {
    const jsonc = /(^|\/)(tsconfig[^/]*|\.vscode\/[^/]+)\.json$/.test(rel);
    const src = jsonc ? text.replace(/\/\*[\s\S]*?\*\/|(^|[^:"])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1') : text;
    try {
      JSON.parse(src);
    } catch (e) {
      errors.push(`JSON の構文エラー: ${e.message}`);
    }
  }

  if (ext === '.yml' || ext === '.yaml') {
    text.split(/\r?\n/).forEach((line, i) => {
      if (/^\t/.test(line)) errors.push(`YAML の ${i + 1} 行目でインデントにタブが使われています`);
    });
  }

  if (ext === '.md' || ext === '.mdx') {
    const { lines, inFence, fenceOpen } = scanFences(text);
    if (fenceOpen) errors.push('閉じられていないコードフェンス（```）があります');

    const article = rel.match(ARTICLE_RE);
    const fm = parseFrontmatter(text);
    let prevLevel = 0;
    let h1Count = 0;
    const startLine = fm && !fm.broken ? fm.bodyOffsetLine : 0;
    for (let i = startLine; i < lines.length; i += 1) {
      if (inFence[i]) continue;
      const m = lines[i].match(/^(#{1,6})\s+\S/);
      if (!m) continue;
      const level = m[1].length;
      if (level === 1) h1Count += 1;
      if (prevLevel && level > prevLevel + 1) {
        (article ? errors : warnings).push(`${i + 1} 行目: 見出しレベルが h${prevLevel} から h${level} に飛んでいます`);
      }
      prevLevel = level;
    }

    if (article) {
      const [, category, fileSlug] = article;
      if (!fm) errors.push('記事にフロントマター（--- で囲まれたメタデータ）がありません');
      else if (fm.broken) errors.push('フロントマターの終端（---）が見つかりません');
      else {
        const missing = REQUIRED_KEYS.filter((k) => !(k in fm.keys));
        if (missing.length) errors.push(`フロントマターの必須項目が不足しています: ${missing.join(', ')}`);
        if (fm.keys.slug && fm.keys.slug !== fileSlug) errors.push(`slug（${fm.keys.slug}）とファイル名（${fileSlug}）が一致しません`);
        if (fm.keys.category && fm.keys.category !== category) errors.push(`category（${fm.keys.category}）と配置ディレクトリ（${category}）が一致しません`);
        for (const k of ['lastUpdated', 'lastVerified']) {
          if (fm.keys[k] && !/^\d{4}-\d{2}-\d{2}$/.test(fm.keys[k])) errors.push(`${k} は YYYY-MM-DD 形式で記述してください`);
        }
        const draft = fm.keys.draft === 'true';
        const body = lines
          .slice(startLine)
          .filter((_, i) => !inFence[i + startLine])
          .join('\n');
        if (PLACEHOLDER_RE.test(body)) {
          (draft ? warnings : errors).push(`未完成のプレースホルダー（TODO 等）が残っています${draft ? '（draft のため警告のみ）' : ''}`);
        }
      }
      if (h1Count > 0) errors.push('記事本文に h1（#）は使わないでください。タイトルはフロントマターの title から表示されます');
    } else if (ext === '.md' && h1Count > 1 && !rel.startsWith('.claude/')) {
      warnings.push('h1 見出しが複数あります');
    }
  }
  return { errors, warnings };
}

function dockerWebRunning(project) {
  const r = run('docker', ['compose', 'ps', '--status', 'running', '--services'], { cwd: project, timeoutMs: 4000 });
  return r.ok && r.stdout.split('\n').includes('web');
}

const PRETTIER_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.css', '.md', '.mdx', '.yml', '.yaml']);

async function main() {
  const input = await readHookInput();
  if (!input || typeof input !== 'object') return; // malformed input: nothing to check, never block the edit
  const file = input.tool_input?.file_path;
  if (typeof file !== 'string') return;
  const project = projectDir();
  const abs = path.resolve(input.cwd ?? project, file);
  if (!isInside(abs, project) || !fs.existsSync(abs)) return;
  const rel = path.relative(project, abs).split(path.sep).join('/');
  if (/^(node_modules|build|\.react-router|src\/generated)\//.test(rel)) return;
  const stat = fs.statSync(abs);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return;

  const { errors, warnings } = checkFile(rel, fs.readFileSync(abs, 'utf8'));

  const ext = path.extname(rel).toLowerCase();
  if (['.mjs', '.js', '.cjs'].includes(ext)) {
    const r = run(process.execPath, ['--check', abs], { cwd: project, timeoutMs: 5000 });
    if (!r.ok && !r.timedOut) errors.push(`JavaScript の構文エラー:\n${r.stderr.trim().split('\n').slice(0, 6).join('\n')}`);
  }

  // Formatting (advisory): only when the dev container is already running; never starts containers.
  if (process.env.IKB_POST_EDIT_PRETTIER !== 'off' && PRETTIER_EXT.has(ext) && fs.existsSync(path.join(project, 'package.json')) && dockerWebRunning(project)) {
    const r = run('docker', ['compose', 'exec', '-T', 'web', 'bun', 'run', 'prettier', '--check', rel], { cwd: project, timeoutMs: 20000 });
    if (!r.ok && !r.timedOut && /\[warn\]/.test(r.stdout + r.stderr)) {
      warnings.push(`Prettier の整形差分があります。\`docker compose exec web bun run prettier --write ${rel}\` で整形してください`);
    }
  }

  if (errors.length) {
    emitJson({
      decision: 'block',
      reason: `[post-edit] ${rel} に問題があります:\n- ${errors.join('\n- ')}${warnings.length ? `\n（警告）\n- ${warnings.join('\n- ')}` : ''}`,
    });
  } else if (warnings.length) {
    emitJson({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `[post-edit] ${rel} の警告:\n- ${warnings.join('\n- ')}` } });
  }
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`[post-edit] internal error: ${err?.message ?? err}\n`);
    process.exit(1); // non-blocking error
  });
}
