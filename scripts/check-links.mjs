#!/usr/bin/env node
// links:check — verify every internal link / asset / #fragment in the built HTML.
// Internal problems fail (exit 1). External links are only checked with --external and are reported
// separately as warnings, because network failures are not the same thing as broken internal links.
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, basePath, buildDir } from './lib/content.mjs';
import { resolveStatic } from './lib/static-site.mjs';

const root = path.join(PROJECT_ROOT, buildDir(), 'client');
const base = basePath();
const checkExternal = process.argv.includes('--external');

if (!fs.existsSync(root)) {
  console.error(`links:check: ${path.relative(PROJECT_ROOT, root)} がありません。先に npm run build を実行してください`);
  process.exit(1);
}

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'pagefind' && e.name !== 'assets') yield* htmlFiles(p);
    } else if (e.name.endsWith('.html') && e.name !== '__spa-fallback.html') yield p;
  }
}

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
}

/** URL path of a built HTML file (with base path). */
function pageUrl(file) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  return base + (rel.endsWith('index.html') ? rel.slice(0, -'index.html'.length) : rel);
}

const broken = [];
const external = new Map();
let checked = 0;

for (const file of htmlFiles(root)) {
  const html = fs.readFileSync(file, 'utf8');
  const from = pageUrl(file);
  for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    const raw = m[2].replace(/&amp;/g, '&');
    if (!raw || raw.startsWith('data:') || raw.startsWith('mailto:') || raw.startsWith('javascript:')) continue;
    if (/^https?:\/\//.test(raw) || raw.startsWith('//')) {
      if (!external.has(raw)) external.set(raw, from);
      continue;
    }
    checked += 1;
    const resolved = new URL(raw, `http://site${from}`);
    if (resolved.host !== 'site') continue;
    if (!resolved.pathname.startsWith(base)) {
      broken.push({ from, href: raw, reason: `base path（${base}）の外を指しています` });
      continue;
    }
    const r = resolveStatic(root, `/${resolved.pathname.slice(base.length)}`);
    if (r.status === 404) {
      broken.push({ from, href: raw, reason: '対象が存在しません' });
      continue;
    }
    const targetFile = r.status === 200 ? r.file : path.join(root, r.location.slice(1), 'index.html');
    if (resolved.hash && targetFile.endsWith('.html')) {
      const id = decodeURIComponent(resolved.hash.slice(1));
      if (id && !idsOf(targetFile).has(id)) broken.push({ from, href: raw, reason: `ページ内アンカー #${id} がありません` });
    }
  }
}

console.log(`links:check ${path.relative(PROJECT_ROOT, root)} (base ${base}) — internal ${checked} links checked, ${external.size} external URLs found`);

if (checkExternal && external.size) {
  const failures = [];
  await Promise.all(
    [...external.keys()].map(async (url) => {
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) });
        if (res.status >= 400 && res.status !== 405 && res.status !== 403) failures.push(`${url} → HTTP ${res.status}（${external.get(url)}）`);
      } catch (e) {
        failures.push(`${url} → 通信エラー: ${e.cause?.code ?? e.name}（${external.get(url)}）`);
      }
    }),
  );
  if (failures.length) console.warn(`\n⚠ 外部リンクの警告 ${failures.length} 件（通信障害の可能性を含むため失敗扱いにしません）:\n  ${failures.join('\n  ')}`);
  else console.log('✓ 外部リンクはすべて応答しました');
}

if (broken.length) {
  console.error(`\n✗ 内部リンク切れ ${broken.length} 件:\n${broken.map((b) => `  ${b.from} → ${b.href}（${b.reason}）`).join('\n')}`);
  process.exit(1);
}
console.log('✓ 内部リンク切れはありません');
