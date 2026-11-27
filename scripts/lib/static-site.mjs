// Resolution rules that mimic GitHub Pages for a static build directory.
// Shared by the link checker and the local static server used in E2E tests.
import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve a URL path (already stripped of the base path) to a file inside `root`.
 * @returns {{ status: 200, file: string } | { status: 301, location: string } | { status: 404 }}
 */
export function resolveStatic(root, urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split(/[?#]/)[0] || '/');
  } catch {
    return { status: 404 };
  }
  const target = path.resolve(root, `.${p}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return { status: 404 };
  const isFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile();
  if (p.endsWith('/')) {
    const idx = path.join(target, 'index.html');
    return isFile(idx) ? { status: 200, file: idx } : { status: 404 };
  }
  if (isFile(target)) return { status: 200, file: target };
  if (fs.existsSync(target) && fs.statSync(target).isDirectory() && isFile(path.join(target, 'index.html'))) return { status: 301, location: `${p}/` };
  if (isFile(`${target}.html`)) return { status: 200, file: `${target}.html` };
  return { status: 404 };
}

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
};

/** Pagefind fragments are served gzip-compressed with custom extensions. */
export function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}
