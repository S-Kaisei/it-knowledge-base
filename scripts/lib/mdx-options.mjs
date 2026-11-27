// Shared MDX compile options. Used by Vite (@mdx-js/rollup) and by the content generator
// (@mdx-js/mdx), so heading ids in the TOC are produced by exactly the same pipeline.
import rehypeShiki from '@shikijs/rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

/**
 * ```mermaid fences → <Mermaid chart="..." /> (rendered client-side only).
 * Keeps the source text so it is present in pre-rendered HTML as a fallback.
 * Runs in the remark phase, i.e. before Shiki (rehype), so Mermaid sources are never highlighted.
 */
export function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid' || !parent || index === undefined) return;
      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: 'Mermaid',
        attributes: [{ type: 'mdxJsxAttribute', name: 'chart', value: node.value }],
        children: [],
      };
    });
  };
}

/** Light/dark Shiki themes. Colors are emitted as CSS variables and switched by [data-theme] in app.css. */
export const SHIKI_THEMES = { light: 'github-light-default', dark: 'github-dark-default' };

/** Languages loaded up front; any other bundled language is loaded lazily, unknown ones fall back to plain text. */
const SHIKI_LANGS = ['typescript', 'tsx', 'javascript', 'jsx', 'json', 'bash', 'html', 'css', 'python', 'sql', 'yaml', 'diff', 'http', 'dockerfile'];

/**
 * Parse fence meta such as `title="file.ts"` (also `title='x'` or `title=x`).
 * @param {string} meta
 * @returns {{ title?: string }}
 */
export function parseCodeMeta(meta) {
  const m = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta ?? '');
  const title = m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : '';
  return title ? { title } : {};
}

/** Expose language and filename on <pre> for the CodeBlock component (mdx-components.tsx). */
const codeBlockDataTransformer = {
  name: 'ikb:code-block-data',
  pre(node) {
    node.properties['data-language'] = this.options.lang;
    const title = this.options.meta?.title;
    if (title) node.properties['data-title'] = title;
  },
};

/** @type {import('@shikijs/rehype').RehypeShikiOptions} */
export const shikiOptions = {
  themes: SHIKI_THEMES,
  // No inline `color` — both palettes are CSS variables (--shiki-light / --shiki-dark) mapped in app.css.
  defaultColor: false,
  langs: SHIKI_LANGS,
  lazy: true,
  defaultLanguage: 'text',
  fallbackLanguage: 'text',
  parseMetaString: (meta) => parseCodeMeta(meta),
  transformers: [codeBlockDataTransformer],
  // github-light-default comments (#6e7781) fall below 4.5:1 on our --code-bg; use a darker gray.
  colorReplacements: { 'github-light-default': { '#6e7781': '#59636e' } },
};

/**
 * @param {{ extraRehype?: import('@mdx-js/mdx').CompileOptions['rehypePlugins'] }} [opts]
 * @returns {import('@mdx-js/mdx').CompileOptions}
 */
export function mdxOptions(opts = {}) {
  return {
    format: 'mdx',
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath, remarkMermaid],
    rehypePlugins: [
      rehypeSlug,
      [rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }],
      [rehypeShiki, shikiOptions],
      ...(opts.extraRehype ?? []),
    ],
  };
}
