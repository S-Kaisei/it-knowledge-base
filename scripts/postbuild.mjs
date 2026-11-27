#!/usr/bin/env node
// Post-build steps on <BUILD_DIR>/client (after `react-router build`, before Pagefind):
//   - 404.html for GitHub Pages / nginx (from the pre-rendered /404 route)
//   - sitemap.xml and robots.txt (published pages only)
//   - .nojekyll (GitHub Pages must not run Jekyll on the output)
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, basePath, buildDir, contentIndexFile } from './lib/content.mjs';

const client = path.join(PROJECT_ROOT, buildDir(), 'client');
const base = basePath();
const fail = (msg) => {
  console.error(`postbuild: ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(client)) fail(`${client} がありません。react-router build を先に実行してください`);

const index = JSON.parse(fs.readFileSync(contentIndexFile(), 'utf8'));
// Draft builds are allowed only for local visual review (bun run build:drafts → build-drafts/). Never in CI/deploy.
if (index.includeDrafts && process.env.ALLOW_DRAFT_BUILD !== 'true') {
  fail('下書きを含むコンテンツインデックスで本番ビルドされています（content:generate を --drafts なしで実行してください）');
}
if (index.includeDrafts && process.env.CI === 'true' && process.env.GITHUB_ACTIONS === 'true') fail('CI では下書き入りビルドを作成できません');

// With a basename, React Router writes pre-rendered pages under <client>/<basename>/ while assets stay at
// <client>/assets. The deployed artifact root IS the base path (GitHub Pages serves it at /<repo>/),
// so hoist the pages to the artifact root and keep the root SPA fallback under its conventional name.
if (base !== '/') {
  const nested = path.join(client, ...base.split('/').filter(Boolean));
  if (fs.existsSync(nested)) {
    const rootIndex = path.join(client, 'index.html');
    if (fs.existsSync(rootIndex)) fs.renameSync(rootIndex, path.join(client, '__spa-fallback.html'));
    for (const entry of fs.readdirSync(nested)) {
      const dest = path.join(client, entry);
      if (fs.existsSync(dest)) fail(`サブパス配下の ${entry} が成果物ルートの同名ファイルと衝突しました`);
      fs.renameSync(path.join(nested, entry), dest);
    }
    fs.rmSync(path.join(client, base.split('/').filter(Boolean)[0]), { recursive: true, force: true });
  }
}

// 404.html
const prerendered404 = path.join(client, '404', 'index.html');
if (!fs.existsSync(prerendered404)) fail('事前レンダリングされた /404 ページがありません');
fs.copyFileSync(prerendered404, path.join(client, '404.html'));
fs.rmSync(path.join(client, '404'), { recursive: true, force: true }); // /404/ must not answer 200

// sitemap.xml / robots.txt
const siteUrl = (process.env.SITE_URL ?? `http://localhost:8080${base}`).replace(/\/?$/, '/');
const abs = (p) => new URL(p.replace(/^\//, ''), siteUrl).href;
const pages = [
  {
    loc: abs('/'),
    lastmod: index.articles
      .map((a) => a.lastUpdated)
      .sort()
      .at(-1),
  },
  ...index.categories
    .filter((c) => c.articleCount > 0)
    .map((c) => ({
      loc: abs(c.path),
      lastmod: index.articles
        .filter((a) => a.category === c.slug)
        .map((a) => a.lastUpdated)
        .sort()
        .at(-1),
    })),
  ...index.articles.filter((a) => !a.draft).map((a) => ({ loc: abs(a.path), lastmod: a.lastUpdated })),
];
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map((p) => `  <url><loc>${p.loc}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`),
  '</urlset>',
  '',
].join('\n');
fs.writeFileSync(path.join(client, 'sitemap.xml'), xml);
fs.writeFileSync(path.join(client, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
fs.writeFileSync(path.join(client, '.nojekyll'), '');

console.log(`postbuild: 404.html, sitemap.xml (${pages.length} URLs), robots.txt, .nojekyll → ${path.relative(PROJECT_ROOT, client)} (base ${base})`);
