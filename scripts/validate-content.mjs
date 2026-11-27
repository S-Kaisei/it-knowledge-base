#!/usr/bin/env node
// content:check — machine-checkable content rules. Exit 1 on errors.
// Usage: node scripts/validate-content.mjs   (CONTENT_DIR=tests/fixtures/... to check fixtures)
import path from 'node:path';
import { PROJECT_ROOT, contentDir } from './lib/content.mjs';
import { HUMAN_REVIEW_ITEMS, validateContent } from './lib/validate.mjs';

const fmt = (x) => `  ${x.file}${x.line ? `:${x.line}` : ''} — ${x.message}`;

const dir = contentDir();
const { errors, warnings, stats } = await validateContent({ dir });
console.log(`content:check ${path.relative(PROJECT_ROOT, dir)} — ${stats.articles} articles (${stats.published} published, ${stats.drafts} drafts)`);
if (warnings.length) console.warn(`\n⚠ 警告 ${warnings.length} 件:\n${warnings.map(fmt).join('\n')}`);
if (errors.length) {
  console.error(`\n✗ エラー ${errors.length} 件:\n${errors.map(fmt).join('\n')}`);
  process.exit(1);
}
console.log('\n✓ 機械的に検証できる項目はすべて通過しました。');
console.log(`以下は自動検証の対象外です（technical-reviewer と人間による確認が必要）:\n${HUMAN_REVIEW_ITEMS.map((i) => `  - ${i}`).join('\n')}`);
