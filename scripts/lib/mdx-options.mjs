// Shared MDX compile options. Used by Vite (@mdx-js/rollup) and by the content generator
// (@mdx-js/mdx), so heading ids in the TOC are produced by exactly the same pipeline.
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

/**
 * ```mermaid fences → <Mermaid chart="..." /> (rendered client-side only).
 * Keeps the source text so it is present in pre-rendered HTML as a fallback.
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

/**
 * @param {{ extraRehype?: import('@mdx-js/mdx').CompileOptions['rehypePlugins'] }} [opts]
 * @returns {import('@mdx-js/mdx').CompileOptions}
 */
export function mdxOptions(opts = {}) {
  return {
    format: 'mdx',
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath, remarkMermaid],
    rehypePlugins: [rehypeSlug, [rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }], ...(opts.extraRehype ?? [])],
  };
}
