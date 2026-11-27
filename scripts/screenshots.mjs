#!/usr/bin/env node
/* global document -- used inside page.evaluate / waitForFunction callbacks, which run in the browser */
// Capture review screenshots (light/dark × desktop/mobile) of pages from a static build.
// Used by the visual-reviewer agent and the create-diagram skill. Output: test-results/screenshots/<name>-<theme>-<device>.png
// Usage: node scripts/screenshots.mjs [--dir build-drafts/client] [--base /] <path> [<path> ...]
//   e.g. npm run build:drafts && node scripts/screenshots.mjs --dir build-drafts/client /fundamentals/cpu/
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium, devices } from '@playwright/test';
import { PROJECT_ROOT } from './lib/content.mjs';

const args = process.argv.slice(2);
const take = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const dir = take('dir', 'build/client');
const base = take('base', '/').replace(/\/?$/, '/');
const port = Number(take('port', '4180'));
const paths = args.length ? args : ['/'];
const outDir = path.join(PROJECT_ROOT, 'test-results', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const server = spawn(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'serve-static.mjs'), '--dir', dir, '--port', String(port), '--base', base], {
  stdio: 'ignore',
});
const origin = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i += 1) {
  try {
    await fetch(`${origin}${base}`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}

const browser = await chromium.launch();
const problems = [];
try {
  for (const p of paths) {
    for (const theme of ['light', 'dark']) {
      for (const [device, opts] of [
        ['desktop', { viewport: { width: 1440, height: 900 } }],
        ['mobile', devices['Pixel 7']],
      ]) {
        const context = await browser.newContext({ ...opts, colorScheme: theme, locale: 'ja-JP' });
        const page = await context.newPage();
        page.on('pageerror', (e) => problems.push(`${p} [${theme}/${device}] pageerror: ${e.message}`));
        const res = await page.goto(`${origin}${base}${p.replace(/^\//, '')}`, { waitUntil: 'networkidle' });
        if (!res || res.status() >= 400) problems.push(`${p}: HTTP ${res?.status()}`);
        // Wait for client-only diagrams to finish rendering (or fail visibly).
        await page.waitForFunction(() => document.querySelectorAll('[data-mermaid="pending"]').length === 0, null, { timeout: 15000 }).catch(() => {});
        const errs = await page.locator('[data-mermaid-error]').count();
        if (errs) problems.push(`${p} [${theme}/${device}]: Mermaid error ×${errs}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) problems.push(`${p} [${theme}/${device}]: horizontal overflow`);
        const name = p.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'home';
        const file = path.join(outDir, `${name}-${theme}-${device}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`saved ${path.relative(PROJECT_ROOT, file)}`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}
if (problems.length) {
  console.error(`\n⚠ ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
}
