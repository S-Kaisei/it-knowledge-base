import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveStatic } from '../../scripts/lib/static-site.mjs';

let root = '';
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ikb-static-'));
  fs.mkdirSync(path.join(root, 'fundamentals', 'cpu'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), 'home');
  fs.writeFileSync(path.join(root, 'fundamentals', 'cpu', 'index.html'), 'cpu');
  fs.writeFileSync(path.join(root, 'robots.txt'), 'robots');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('resolveStatic (GitHub Pages semantics)', () => {
  it('serves index.html for directory URLs with a trailing slash', () => {
    expect(resolveStatic(root, '/')).toEqual({ status: 200, file: path.join(root, 'index.html') });
    expect(resolveStatic(root, '/fundamentals/cpu/')).toMatchObject({ status: 200 });
  });

  it('redirects directory URLs without a trailing slash', () => {
    expect(resolveStatic(root, '/fundamentals/cpu')).toEqual({ status: 301, location: '/fundamentals/cpu/' });
  });

  it('serves plain files and ignores query strings', () => {
    expect(resolveStatic(root, '/robots.txt?x=1')).toMatchObject({ status: 200 });
  });

  it('returns 404 for unknown paths (never falls back to the top page)', () => {
    expect(resolveStatic(root, '/nope/')).toEqual({ status: 404 });
    expect(resolveStatic(root, '/fundamentals/')).toEqual({ status: 404 });
  });

  it('blocks path traversal', () => {
    expect(resolveStatic(root, '/../../etc/passwd')).toEqual({ status: 404 });
    expect(resolveStatic(root, '/%2e%2e/%2e%2e/etc/passwd')).toEqual({ status: 404 });
  });
});
