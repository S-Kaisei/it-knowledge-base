// Content loading shared by routes.ts, react-router.config.ts, the content generator and the validator.
// All filesystem access is limited to the content directory inside the repository.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import { toString as hastToString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';
import { categoriesFileSchema, frontmatterSchema } from '../../src/lib/content-schema.ts';
import { mdxOptions } from './mdx-options.mjs';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ARTICLE_EXT = ['.mdx', '.md'];
/** Japanese reading speed used for the reading-time estimate (characters per minute). */
const CHARS_PER_MINUTE = 500;

/** Content directory: $CONTENT_DIR (for fixtures/tests) or src/content. */
export function contentDir() {
  const dir = process.env.CONTENT_DIR ? path.resolve(PROJECT_ROOT, process.env.CONTENT_DIR) : path.join(PROJECT_ROOT, 'src', 'content');
  const rel = path.relative(PROJECT_ROOT, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`CONTENT_DIR must be inside the repository: ${dir}`);
  return dir;
}

export function includeDraftsFromEnv() {
  return process.env.INCLUDE_DRAFTS === 'true';
}

/**
 * Generated content index consumed by the app (aliased in vite.config.ts).
 * Non-default content dirs (fixtures) get their own file so they never overwrite the real index.
 */
export function contentIndexFile() {
  const name = process.env.CONTENT_DIR
    ? `content-index.${path.relative(PROJECT_ROOT, contentDir()).replace(/[^a-zA-Z0-9]+/g, '-')}.json`
    : 'content-index.json';
  return path.join(PROJECT_ROOT, 'src', 'generated', name);
}

/** Build output directory (relative to the repo). Static site lives in <buildDir>/client. */
export function buildDir() {
  return process.env.BUILD_DIR || 'build';
}

/** Normalize BASE_PATH to "/" or "/segment/". */
export function basePath() {
  const raw = (process.env.BASE_PATH ?? '/').trim() || '/';
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function formatZodIssues(error) {
  return error.issues.map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
}

export function loadCategories(dir = contentDir()) {
  const file = path.join(dir, 'categories.json');
  const errors = [];
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { categories: [], errors: [{ file: 'categories.json', message: `読み込めません: ${e.message}` }] };
  }
  const parsed = categoriesFileSchema.safeParse(raw);
  if (!parsed.success) {
    for (const m of formatZodIssues(parsed.error)) errors.push({ file: 'categories.json', message: m });
    return { categories: [], errors };
  }
  const seen = new Set();
  for (const c of parsed.data) {
    if (seen.has(c.slug)) errors.push({ file: 'categories.json', message: `カテゴリ slug が重複しています: ${c.slug}` });
    seen.add(c.slug);
  }
  return { categories: [...parsed.data].sort((a, b) => a.order - b.order), errors };
}

/**
 * Read and validate every article file. Does not compile MDX.
 * @returns {{ articles: Array<{file: string, abs: string, data: import('../../src/lib/content-schema.ts').Frontmatter, body: string, bodyStartLine: number}>, errors: Array<{file: string, message: string}> }}
 */
export function readArticles(dir = contentDir(), categories = loadCategories(dir).categories) {
  const errors = [];
  const articles = [];
  const categorySlugs = new Set(categories.map((c) => c.slug));
  if (!fs.existsSync(dir)) return { articles, errors: [{ file: '.', message: `コンテンツディレクトリがありません: ${dir}` }] };

  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const catDir = path.join(dir, entry.name);
    for (const f of fs.readdirSync(catDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = `${entry.name}/${f.name}`;
      if (f.isDirectory()) {
        errors.push({ file: rel, message: 'カテゴリ配下にサブディレクトリは置けません（画像は public/images/<slug>/ へ）' });
        continue;
      }
      if (!ARTICLE_EXT.includes(path.extname(f.name))) continue;
      const abs = path.join(catDir, f.name);
      const source = fs.readFileSync(abs, 'utf8');
      let fm;
      try {
        fm = matter(source);
      } catch (e) {
        errors.push({ file: rel, message: `フロントマターの YAML を解析できません: ${e.message}` });
        continue;
      }
      const parsed = frontmatterSchema.safeParse(fm.data);
      if (!parsed.success) {
        for (const m of formatZodIssues(parsed.error)) errors.push({ file: rel, message: `フロントマター ${m}` });
        continue;
      }
      const data = parsed.data;
      const fileSlug = path.basename(f.name, path.extname(f.name));
      if (data.slug !== fileSlug) errors.push({ file: rel, message: `slug（${data.slug}）とファイル名（${fileSlug}）が一致しません` });
      if (data.category !== entry.name) errors.push({ file: rel, message: `category（${data.category}）と配置ディレクトリ（${entry.name}）が一致しません` });
      if (!categorySlugs.has(data.category))
        errors.push({ file: rel, message: `未定義のカテゴリです: ${data.category}（categories.json に定義してください）` });
      const bodyStartLine = source.slice(0, source.length - fm.content.length).split('\n').length;
      articles.push({ file: rel, abs, data, body: fm.content, bodyStartLine });
    }
  }

  const bySlug = new Map();
  for (const a of articles) {
    if (bySlug.has(a.data.slug)) errors.push({ file: a.file, message: `slug が重複しています: ${a.data.slug}（${bySlug.get(a.data.slug).file} と同じ）` });
    else bySlug.set(a.data.slug, a);
  }
  return { articles, errors };
}

export function articlePath(data) {
  return `/${data.category}/${data.slug}/`;
}

/**
 * Lightweight list for routing and pre-rendering (no MDX compile).
 * Articles with frontmatter errors are excluded (content:check reports them).
 */
export function listArticles({ dir = contentDir(), includeDrafts = includeDraftsFromEnv() } = {}) {
  const { categories } = loadCategories(dir);
  const { articles } = readArticles(dir, categories);
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const seen = new Set();
  return articles
    .filter((a) => (includeDrafts || !a.data.draft) && categorySlugs.has(a.data.category))
    .filter((a) => path.basename(a.file, path.extname(a.file)) === a.data.slug && a.file.startsWith(`${a.data.category}/`))
    .filter((a) => (seen.has(a.data.slug) ? false : (seen.add(a.data.slug), true)))
    .map((a) => ({ slug: a.data.slug, category: a.data.category, file: a.file, abs: a.abs, path: articlePath(a.data), draft: a.data.draft }));
}

/** rehype plugin factory capturing TOC entries, text length and KaTeX errors from the final HAST. */
function captureFactory(sink) {
  return () => (tree) => {
    visit(tree, 'element', (node) => {
      if ((node.tagName === 'h2' || node.tagName === 'h3') && node.properties?.id) {
        sink.toc.push({ depth: node.tagName === 'h2' ? 2 : 3, id: String(node.properties.id), text: hastToString(node).trim() });
      }
      const cls = node.properties?.className;
      if (Array.isArray(cls) && cls.includes('katex-error')) {
        sink.katexErrors.push(String(node.properties?.title ?? hastToString(node)).slice(0, 200));
      }
    });
    sink.chars = hastToString(tree).replace(/\s+/g, '').length;
  };
}

/** Compile one article with the production MDX pipeline and collect derived data. */
export async function analyzeArticle(article) {
  const sink = { toc: [], katexErrors: [], chars: 0 };
  await compile({ value: fs.readFileSync(article.abs, 'utf8'), path: article.abs }, mdxOptions({ extraRehype: [captureFactory(sink)] }));
  return sink;
}

function sortArticles(a, b) {
  return a.order - b.order || a.title.localeCompare(b.title, 'ja');
}

/**
 * Build the full content index (used by the app via src/generated/content-index.json).
 * @returns {Promise<{ index: import('../../src/lib/content-schema.ts').ContentIndex, errors: Array<{file: string, message: string}> }>}
 */
export async function buildContentIndex({ dir = contentDir(), includeDrafts = includeDraftsFromEnv() } = {}) {
  const { categories, errors: catErrors } = loadCategories(dir);
  const { articles, errors: articleErrors } = readArticles(dir, categories);
  const errors = [...catErrors, ...articleErrors];
  const listed = new Set(listArticles({ dir, includeDrafts }).map((a) => a.slug));

  const metas = [];
  for (const a of articles) {
    if (!listed.has(a.data.slug)) continue;
    try {
      const { toc, katexErrors, chars } = await analyzeArticle(a);
      for (const k of katexErrors) errors.push({ file: a.file, message: `数式をレンダリングできません: ${k}` });
      metas.push({
        ...a.data,
        path: articlePath(a.data),
        file: a.file,
        toc,
        readingMinutes: Math.max(1, Math.round(chars / CHARS_PER_MINUTE)),
        prev: null,
        next: null,
      });
    } catch (e) {
      const where = e.place?.start ? `${e.place.start.line}:${e.place.start.column} ` : e.line ? `${e.line}:${e.column ?? 0} ` : '';
      errors.push({ file: a.file, message: `MDX をコンパイルできません: ${where}${e.reason ?? e.message}` });
    }
  }

  const summaries = categories.map((c) => {
    const inCat = metas.filter((m) => m.category === c.slug).sort(sortArticles);
    inCat.forEach((m, i) => {
      const link = (x) => (x ? { slug: x.slug, title: x.title, path: x.path, category: x.category } : null);
      m.prev = link(inCat[i - 1]);
      m.next = link(inCat[i + 1]);
    });
    return { ...c, articleCount: inCat.length, path: `/${c.slug}/` };
  });

  const ordered = summaries.flatMap((c) => metas.filter((m) => m.category === c.slug).sort(sortArticles));
  return { index: { includeDrafts, categories: summaries, articles: ordered }, errors };
}

export function formatErrors(errors) {
  return errors.map((e) => `  ✗ ${e.file}: ${e.message}`).join('\n');
}
