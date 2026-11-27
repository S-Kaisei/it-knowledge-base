#!/usr/bin/env node
// Minimal static server with GitHub Pages semantics (base path, dir → trailing-slash redirect,
// real 404 status with 404.html). Used by Playwright; NOT a production server.
// Usage: node scripts/serve-static.mjs [--dir build/client] [--port 4173] [--base /]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { PROJECT_ROOT } from './lib/content.mjs';
import { mimeFor, resolveStatic } from './lib/static-site.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const root = path.resolve(PROJECT_ROOT, opt('dir', 'build/client'));
const port = Number(opt('port', '4173'));
const base = opt('base', '/').replace(/\/?$/, '/');

if (!fs.existsSync(root)) {
  console.error(`serve-static: ${root} がありません。先に npm run build を実行してください`);
  process.exit(1);
}

const send404 = (res) => {
  const page = path.join(root, '404.html');
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  res.end(fs.existsSync(page) ? fs.readFileSync(page) : 'Not Found');
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === base.slice(0, -1)) {
      res.writeHead(301, { location: base });
      res.end();
      return;
    }
    if (!url.pathname.startsWith(base)) return send404(res);
    const r = resolveStatic(root, `/${url.pathname.slice(base.length)}`);
    if (r.status === 301) {
      res.writeHead(301, { location: `${base}${r.location.slice(1)}${url.search}` });
      res.end();
    } else if (r.status === 200) {
      res.writeHead(200, { 'content-type': mimeFor(r.file), 'cache-control': 'no-cache' });
      fs.createReadStream(r.file).pipe(res);
    } else send404(res);
  })
  .listen(port, '127.0.0.1', () => console.log(`serve-static: http://127.0.0.1:${port}${base} → ${path.relative(PROJECT_ROOT, root)}`));
