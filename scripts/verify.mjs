#!/usr/bin/env node
// Quality gate shared by Hooks, Docker (qa) and GitHub Actions (SPEC §13).
//   node scripts/verify.mjs            full gate (10 steps + sub-path build/link check)
//   node scripts/verify.mjs --quick    typecheck, lint, content, unit + component tests (no build / E2E)
//   node scripts/verify.mjs --list     print the steps without running them
// Stops at the first failure and exits non-zero. Prints a summary table either way.
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');

/** @type {Array<{ id: string, label: string, cmd: string[], env?: Record<string,string>, quick?: boolean }>} */
export const STEPS = [
  { id: 'typecheck', label: '1. TypeScript 型チェック', cmd: ['bun', 'run', 'typecheck'], quick: true },
  { id: 'lint', label: '2. ESLint', cmd: ['bun', 'run', 'lint'], quick: true },
  { id: 'lint:md', label: '3. Markdownlint', cmd: ['bun', 'run', 'lint:md'], quick: true },
  { id: 'format', label: '4. Prettier', cmd: ['bun', 'run', 'format:check'], quick: true },
  { id: 'content', label: '5. コンテンツ構造検証', cmd: ['bun', 'run', 'content:check'], quick: true },
  { id: 'unit', label: '6. ユニットテスト', cmd: ['bun', 'run', 'vitest', 'run', '--project', 'unit'], quick: true },
  { id: 'components', label: '7. コンポーネントテスト', cmd: ['bun', 'run', 'vitest', 'run', '--project', 'components'], quick: true },
  { id: 'build', label: '8. 静的サイトビルド（ルート配信）', cmd: ['bun', 'run', 'build'] },
  { id: 'build:subpath', label: '8b. 静的サイトビルド（GitHub Pages サブパス）', cmd: ['bun', 'run', 'build:subpath'] },
  { id: 'links', label: '9. 内部リンク検証', cmd: ['bun', 'run', 'links:check'] },
  { id: 'links:subpath', label: '9b. 内部リンク検証（サブパス）', cmd: ['bun', 'run', 'links:check:subpath'] },
  { id: 'e2e', label: '10. Playwright E2E', cmd: ['bun', 'run', 'test:e2e'] },
];

const steps = STEPS.filter((s) => !quick || s.quick);

if (args.has('--list')) {
  for (const s of steps) console.log(`${s.label}: ${s.cmd.join(' ')}`);
  process.exit(0);
}

const results = [];
const started = Date.now();
for (const step of steps) {
  console.log(`\n━━ ${step.label} ━━ $ ${step.cmd.join(' ')}`);
  const t0 = Date.now();
  const r = spawnSync(step.cmd[0], step.cmd.slice(1), { stdio: 'inherit', env: { ...process.env, ...step.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' } });
  const ok = r.status === 0;
  results.push({ step, ok, seconds: ((Date.now() - t0) / 1000).toFixed(1), status: r.status ?? r.signal });
  if (!ok) break;
}

const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].length * 1));
console.log(`\n${'━'.repeat(60)}\nverify${quick ? ' --quick' : ''} の結果`);
for (const s of steps) {
  const r = results.find((x) => x.step === s);
  const mark = !r ? '－ 未実行' : r.ok ? '✓ 成功' : `✗ 失敗 (exit ${r.status})`;
  console.log(`  ${pad(s.label, 34)} ${mark}${r ? `  ${r.seconds}s` : ''}`);
}
const failed = results.find((r) => !r.ok);
console.log(`合計 ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (failed) {
  console.error(`\n✗ ${failed.step.label} が失敗しました。以降のステップは実行していません。`);
  process.exit(1);
}
console.log(`\n✓ すべての品質ゲートを通過しました${quick ? '（--quick: ビルド・リンク・E2E は未実行）' : ''}`);
