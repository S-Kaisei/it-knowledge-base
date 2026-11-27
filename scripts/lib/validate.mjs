// Machine-checkable content rules (SPEC §14). Pure-ish: reads files under the content dir and public/.
// Items that need human/technical review are listed in HUMAN_REVIEW_ITEMS and never auto-passed.
import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import katex from 'katex';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import { MDX_COMPONENT_NAMES } from '../../src/components/article/mdx-component-names.ts';
import { PROJECT_ROOT, articlePath, buildContentIndex, contentDir, loadCategories, readArticles } from './content.mjs';

/**
 * Strict KaTeX check of every math node, with file line numbers.
 * The site renders with throwOnError: false, which hides e.g. undefined commands (shown in red, no
 * .katex-error element), so the build-time KaTeX check alone would miss them.
 * @param {string} source whole file (frontmatter included, so positions are file lines)
 * @returns {Promise<Array<{ line?: number, message: string }>>}
 */
export async function checkMath(source) {
  const problems = [];
  const collect = () => (tree) => {
    visit(tree, ['math', 'inlineMath'], (node) => {
      try {
        katex.renderToString(node.value, { displayMode: node.type === 'math', throwOnError: true, strict: 'ignore' });
      } catch (e) {
        const message = String(e?.message ?? e)
          .replace(/^KaTeX parse error:\s*/, '')
          .replace(/\s+/g, ' ')
          .slice(0, 200);
        problems.push({ line: node.position?.start.line, message });
      }
    });
  };
  await compile(source, { format: 'mdx', remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath, collect] });
  return problems;
}

export const REQUIRED_FIELDS = [
  'title',
  'description',
  'slug',
  'category',
  'difficulty',
  'tags',
  'prerequisites',
  'related',
  'order',
  'draft',
  'lastUpdated',
  'lastVerified',
  'references',
];
export const PLACEHOLDER_RE = /\b(TODO|FIXME|TBD|XXX)\b|lorem ipsum|ここに(本文|説明|図)を|（要確認）|\(要確認\)/i;

export const HUMAN_REVIEW_ITEMS = [
  '技術的正確性（定義・数値・数式・因果関係）',
  '初学者への分かりやすさと例え話の妥当性',
  '図解の正確さと本文との整合',
  '出典が主張を実際に裏付けているか（URL の実在確認だけでは不十分）',
  '第三者の文章・図の転載がないか',
];

/** Lines of the markdown body outside fenced code blocks, with 1-based line numbers. */
export function proseLines(body, startLine = 1) {
  const out = [];
  let fence = null;
  body.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (m) {
      if (!fence) fence = m[1];
      else if (m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) fence = null;
      return;
    }
    if (!fence) out.push({ line: startLine + i, text: line });
  });
  return out;
}

/** Extract root-relative link targets from markdown/MDX prose. */
export function extractLinks(lines) {
  const links = [];
  for (const { line, text } of lines) {
    const stripped = text.replace(/`[^`]*`/g, '');
    for (const m of stripped.matchAll(/(!?)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) links.push({ line, image: m[1] === '!', alt: m[2], href: m[3] });
    for (const m of stripped.matchAll(/\b(href|src)=["']([^"']+)["']/g)) links.push({ line, image: m[1] === 'src', alt: null, href: m[2] });
  }
  return links;
}

/**
 * ```mermaid fences in an article body with the 1-based file line of the opening fence.
 * Fences nested in longer fences (e.g. a ````md example) are ignored.
 * @returns {Array<{ line: number, code: string }>}
 */
export function extractMermaidBlocks(body, startLine = 1) {
  const blocks = [];
  let fence = null;
  body.split(/\r?\n/).forEach((text, i) => {
    const m = text.match(/^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)/);
    if (!fence) {
      if (m) fence = { marker: m[1], line: startLine + i, mermaid: m[2] === 'mermaid', lines: [] };
      return;
    }
    if (m && m[1][0] === fence.marker[0] && m[1].length >= fence.marker.length && text.trim() === m[1]) {
      if (fence.mermaid) blocks.push({ line: fence.line, code: fence.lines.join('\n') });
      fence = null;
      return;
    }
    fence.lines.push(text);
  });
  return blocks;
}

let mermaidPromise;
/**
 * Mermaid for Node. mermaid.parse() needs a DOM for DOMPurify (used by flowchart, class, state, gantt,
 * mindmap and others), so a jsdom window is installed as `window`/`document` before mermaid is imported.
 * The globals stay for the rest of the process (content:check is a short-lived CLI; vitest isolates files).
 * Limitation: parse() validates syntax only. Layout/render-time failures (rare) are caught by E2E through
 * the `data-mermaid-error` attribute set by src/components/diagrams/mermaid.tsx.
 */
async function loadMermaid() {
  mermaidPromise ??= (async () => {
    if (typeof globalThis.window === 'undefined') {
      const { JSDOM } = await import('jsdom');
      const { window } = new JSDOM('<!doctype html><html><body></body></html>');
      globalThis.window = window;
      globalThis.document = window.document;
    }
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    return mermaid;
  })();
  return mermaidPromise;
}

/**
 * Validate Mermaid source with mermaid's own parser.
 * @returns {Promise<null | { line?: number, message: string }>} line is relative to the diagram (1 = first line)
 */
export async function checkMermaid(code) {
  const mermaid = await loadMermaid();
  try {
    await mermaid.parse(code);
    return null;
  } catch (e) {
    const raw = String(e?.message ?? e);
    const lineMatch = /on line (\d+)/.exec(raw);
    const message = raw
      .split('\n')
      .filter((l) => l.trim() && !/^-*\^$/.test(l.trim()))
      .join(' / ')
      .replace(/\s+/g, ' ')
      .slice(0, 240);
    return { line: lineMatch ? Number(lineMatch[1]) : undefined, message };
  }
}

/** `<Figure src="...">` without a non-empty alt (images inside Figure need alternative text). */
export function figuresWithoutAlt(body, startLine = 1) {
  const out = [];
  for (const m of body.matchAll(/<Figure\b([^>]*)>/g)) {
    const attrs = m[1];
    if (!/\bsrc=/.test(attrs)) continue;
    const alt = /\balt=(?:"([^"]*)"|'([^']*)')/.exec(attrs);
    if (!alt || !(alt[1] ?? alt[2] ?? '').trim()) out.push({ line: startLine + body.slice(0, m.index).split('\n').length - 1 });
  }
  return out;
}

/** "Today" in Japan Standard Time: the site's dates are written in JST regardless of the container's TZ. */
export function todayJst(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/**
 * @param {{ dir?: string, publicDir?: string, now?: string }} [opts]
 * @returns {Promise<{ errors: Array<{file: string, line?: number, message: string}>, warnings: Array<{file: string, line?: number, message: string}>, stats: {articles: number, published: number, drafts: number} }>}
 */
export async function validateContent({ dir = contentDir(), publicDir = path.join(PROJECT_ROOT, 'public'), now = todayJst() } = {}) {
  const errors = [];
  const warnings = [];
  const { categories, errors: catErrors } = loadCategories(dir);
  errors.push(...catErrors);
  const { articles, errors: readErrors } = readArticles(dir, categories);
  errors.push(...readErrors);

  // Compile every article (drafts included) to surface MDX syntax and KaTeX errors.
  const { errors: compileErrors } = await buildContentIndex({ dir, includeDrafts: true });
  for (const e of compileErrors) if (!errors.some((x) => x.file === e.file && x.message === e.message)) errors.push(e);

  const bySlug = new Map(articles.map((a) => [a.data.slug, a]));
  const validPaths = new Map();
  validPaths.set('/', { draft: false });
  for (const c of categories) validPaths.set(`/${c.slug}/`, { draft: false });
  for (const a of articles) validPaths.set(articlePath(a.data), { draft: a.data.draft, slug: a.data.slug });

  for (const a of articles) {
    const { data, file } = a;
    const isDraft = data.draft;
    const problem = (message, line) => (isDraft ? warnings : errors).push({ file, line, message: isDraft ? `${message}（draft のため警告）` : message });
    const raw = matter(fs.readFileSync(a.abs, 'utf8')).data;

    // Required fields must be written explicitly (defaults exist only for robustness).
    const missing = REQUIRED_FIELDS.filter((k) => !(k in raw));
    if (missing.length) problem(`フロントマターに必須項目がありません: ${missing.join(', ')}`);

    // Dates
    if (data.lastUpdated > now) errors.push({ file, message: `lastUpdated（${data.lastUpdated}）が未来の日付です` });
    if (data.lastVerified && data.lastVerified > now) errors.push({ file, message: `lastVerified（${data.lastVerified}）が未来の日付です` });
    for (const r of data.references) if (r.accessed > now) errors.push({ file, message: `出典の確認日（${r.accessed}）が未来の日付です: ${r.url}` });

    // Sources
    if (data.references.length === 0) problem('出典（references）がありません。確認した一次情報を記載してください');
    if (!data.lastVerified) problem('lastVerified がありません（情報源を確認した日を記載）');
    const urls = data.references.map((r) => r.url);
    if (new Set(urls).size !== urls.length) warnings.push({ file, message: '出典 URL が重複しています' });

    // Article links in frontmatter
    for (const key of ['prerequisites', 'related']) {
      for (const s of data[key]) {
        if (s === data.slug) errors.push({ file, message: `${key} に自分自身（${s}）が含まれています` });
        else if (!bySlug.has(s)) errors.push({ file, message: `${key} に存在しない記事があります: ${s}` });
        else if (!isDraft && bySlug.get(s).data.draft) errors.push({ file, message: `公開記事の ${key} が下書き記事（${s}）を参照しています` });
      }
    }
    for (const s of data.related) {
      const other = bySlug.get(s);
      if (other && !other.data.related.includes(data.slug))
        warnings.push({ file, message: `関連記事 ${s} 側から ${data.slug} への related がありません（双方向推奨）` });
    }

    // Body checks
    const lines = proseLines(a.body, a.bodyStartLine);
    let prevLevel = 1; // title acts as h1
    for (const { line, text } of lines) {
      const h = text.match(/^(#{1,6})\s+\S/);
      if (h) {
        const level = h[1].length;
        if (level === 1) errors.push({ file, line, message: '本文に h1（#）は使えません。本文は h2（##）から始めます' });
        else if (level > prevLevel + 1) errors.push({ file, line, message: `見出しレベルが h${prevLevel} から h${level} に飛んでいます` });
        prevLevel = level;
      }
      if (PLACEHOLDER_RE.test(text)) problem(`未完成のプレースホルダーがあります: ${text.trim().slice(0, 60)}`, line);
      // Capitalised JSX tags must be registered MDX components (an unknown one only fails at runtime).
      for (const m of text.replace(/`[^`]*`/g, '').matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) {
        if (!MDX_COMPONENT_NAMES.includes(m[1])) {
          errors.push({ file, line, message: `未登録の MDX コンポーネント <${m[1]}> が使われています（使用可能: ${MDX_COMPONENT_NAMES.join(', ')}）` });
        }
      }
    }

    // Mermaid syntax (drafts included: a broken diagram is a build-quality problem, not a content one).
    for (const block of extractMermaidBlocks(a.body, a.bodyStartLine)) {
      const err = await checkMermaid(block.code);
      if (err) errors.push({ file, line: block.line + (err.line ?? 0), message: `Mermaid の構文エラー: ${err.message}` });
    }
    // Math (strict). MDX syntax errors were already reported by the compile step above.
    const mathProblems = await checkMath(fs.readFileSync(a.abs, 'utf8')).catch(() => []);
    if (mathProblems.length) {
      // Prefer these (with line numbers) over the line-less build-time KaTeX errors for the same file.
      for (let i = errors.length - 1; i >= 0; i--) {
        if (errors[i].file === file && !errors[i].line && errors[i].message.startsWith('数式をレンダリングできません')) errors.splice(i, 1);
      }
      for (const p of mathProblems) errors.push({ file, line: p.line, message: `数式をレンダリングできません: ${p.message}` });
    }
    for (const { line } of figuresWithoutAlt(a.body, a.bodyStartLine)) errors.push({ file, line, message: '<Figure src> に代替テキスト（alt）がありません' });

    for (const link of extractLinks(lines)) {
      const { href, line } = link;
      if (link.image) {
        if (link.alt !== null && !link.alt.trim()) errors.push({ file, line, message: `画像に代替テキストがありません: ${href}` });
        if (href.startsWith('/')) {
          const target = path.join(publicDir, decodeURI(href.split(/[?#]/)[0]));
          if (!target.startsWith(publicDir) || !fs.existsSync(target)) errors.push({ file, line, message: `画像が見つかりません: ${href}（public${href}）` });
        }
        continue;
      }
      if (!href.startsWith('/') || href.startsWith('//')) continue; // external / relative / anchor links are checked after build
      const pathOnly = href.split(/[?#]/)[0];
      const normalized = pathOnly.endsWith('/') || path.extname(pathOnly) ? pathOnly : `${pathOnly}/`;
      if (fs.existsSync(path.join(publicDir, pathOnly)) && path.extname(pathOnly)) continue; // static file
      const target = validPaths.get(normalized);
      if (!target) errors.push({ file, line, message: `内部リンク切れ: ${href}` });
      else if (!isDraft && target.draft) errors.push({ file, line, message: `公開記事から下書き記事へのリンクがあります: ${href}` });
    }
  }

  const published = articles.filter((a) => !a.data.draft).length;
  return { errors, warnings, stats: { articles: articles.length, published, drafts: articles.length - published } };
}
