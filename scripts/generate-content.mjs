#!/usr/bin/env node
// Generate src/generated/content-index.json from src/content (or $CONTENT_DIR).
//   --drafts   include draft articles (development preview)
//   --lenient  report errors but exit 0 (development server keeps running)
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, buildContentIndex, contentDir, contentIndexFile, formatErrors } from './lib/content.mjs';

/** Write only when the content changed (avoids needless HMR reloads). Returns true if written. */
export function writeIfChanged(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
}

export async function generate({ includeDrafts, dir = contentDir() }) {
  const { index, errors } = await buildContentIndex({ dir, includeDrafts });
  const written = writeIfChanged(contentIndexFile(), `${JSON.stringify(index, null, 2)}\n`);
  return { index, errors, written };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const includeDrafts = args.has('--drafts') || process.env.INCLUDE_DRAFTS === 'true';
  const { index, errors, written } = await generate({ includeDrafts });
  const rel = path.relative(PROJECT_ROOT, contentIndexFile());
  console.log(
    `content:generate ${written ? 'wrote' : 'unchanged'} ${rel} — ${index.articles.length} articles, ${index.categories.length} categories${includeDrafts ? ' (drafts included)' : ''}`,
  );
  if (errors.length) {
    console.error(`content:generate found ${errors.length} problem(s):\n${formatErrors(errors)}`);
    if (!args.has('--lenient')) process.exit(1);
  }
}
