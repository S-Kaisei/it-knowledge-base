import fs from 'node:fs';
import path from 'node:path';
import { compile, evaluate } from '@mdx-js/mdx';
import { createElement, type ComponentProps } from 'react';
import * as runtime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../../scripts/lib/content.mjs';
import { mdxOptions, parseCodeMeta } from '../../scripts/lib/mdx-options.mjs';
import { checkMath, checkMermaid, extractMermaidBlocks, figuresWithoutAlt } from '../../scripts/lib/validate.mjs';

/** Compile + run MDX with the production plugins and render it to static HTML (as pre-rendering does). */
async function renderMdx(source: string, components: Record<string, unknown> = {}) {
  const { providerImportSource: _ignored, ...options } = mdxOptions();
  const { default: Content } = await evaluate(source, { ...options, ...runtime, baseUrl: import.meta.url });
  const MermaidStub = ({ chart }: { chart: string }) => createElement('pre', { 'data-mermaid-source': '' }, chart);
  return renderToStaticMarkup(createElement(Content, { components: { Mermaid: MermaidStub, ...components } }));
}

describe('parseCodeMeta', () => {
  it('reads title in double quotes, single quotes or bare', () => {
    expect(parseCodeMeta('title="example.ts"')).toEqual({ title: 'example.ts' });
    expect(parseCodeMeta("showLineNumbers title='a b.py'")).toEqual({ title: 'a b.py' });
    expect(parseCodeMeta('title=main.go')).toEqual({ title: 'main.go' });
    expect(parseCodeMeta('')).toEqual({});
    expect(parseCodeMeta('subtitle="x"')).toEqual({});
  });
});

describe('MDX pipeline (mdx-options.mjs)', () => {
  it('highlights code at build time with dual-theme CSS variables and exposes language/title', async () => {
    const html = await renderMdx('```ts title="example.ts"\nconst x: number = 1;\n```\n');
    expect(html).toMatch(/<pre class="shiki shiki-themes github-light-default github-dark-default"/);
    expect(html).toContain('data-language="ts"');
    expect(html).toContain('data-title="example.ts"');
    expect(html).toMatch(/<span style="--shiki-light:#[0-9a-fA-F]{6};--shiki-dark:#[0-9a-fA-F]{6}">const<\/span>/);
    // defaultColor: false → no inline `color:` (themes are switched in CSS)
    expect(html).not.toMatch(/[";]color:/);
  });

  it('falls back to plain text for unknown or missing languages', async () => {
    const html = await renderMdx('```no-such-language\nplain\n```\n\n```\nalso plain\n```\n');
    expect(html.match(/data-language="text"/g)).toHaveLength(2);
    expect(html).toContain('plain');
  });

  it('keeps mermaid fences out of Shiki (converted to <Mermaid> first)', async () => {
    const html = await renderMdx('```mermaid\nflowchart LR\n  A --> B\n```\n');
    expect(html).toContain('<pre data-mermaid-source="">flowchart LR');
    expect(html).not.toContain('shiki');
  });

  it('adds heading ids (rehype-slug) and renders KaTeX at build time', async () => {
    const html = await renderMdx('## 数式の例\n\n$$\nE = mc^2\n$$\n');
    expect(html).toContain('<h2 id="数式の例">');
    expect(html).toContain('class="katex-display"');
  });

  it('passes the highlighted <pre> to the `pre` component', async () => {
    const Pre = ({ children, ...rest }: ComponentProps<'pre'> & { 'data-title'?: string }) =>
      createElement('div', { 'data-wrapped': rest['data-title'] ?? '' }, createElement('pre', rest, children));
    const html = await renderMdx('```js title="a.js"\nlet a;\n```\n', { pre: Pre });
    expect(html).toContain('<div data-wrapped="a.js"><pre');
  });

  it('compiles the article template (docs/templates/article.md) as MDX', async () => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, 'docs', 'templates', 'article.md'), 'utf8');
    await expect(compile(source, mdxOptions())).resolves.toBeDefined();
  });
});

describe('Mermaid validation (content:check)', () => {
  it('extracts mermaid fences with the line of the opening fence', () => {
    const body = ['## 図', '', '```mermaid', 'flowchart LR', '  A --> B', '```', '', '````md', '```mermaid', 'nested', '```', '````'].join('\n');
    expect(extractMermaidBlocks(body, 10)).toEqual([{ line: 12, code: 'flowchart LR\n  A --> B' }]);
  });

  it('accepts valid diagrams of several types', async () => {
    expect(await checkMermaid('flowchart LR\n  A --> B')).toBeNull();
    expect(await checkMermaid('sequenceDiagram\n  A->>B: hi')).toBeNull();
    expect(await checkMermaid('classDiagram\n  A <|-- B')).toBeNull();
    expect(await checkMermaid('stateDiagram-v2\n  [*] --> S')).toBeNull();
  }, 30_000);

  it('reports syntax errors with the line inside the diagram', async () => {
    const err = await checkMermaid('flowchart LR\n  A --> B\n  B --> -->');
    expect(err).toMatchObject({ line: 3 });
    expect(err?.message).toContain('Parse error');
    const unknown = await checkMermaid('notADiagram\n  x');
    expect(unknown).not.toBeNull();
    expect(unknown?.line).toBeUndefined();
  }, 30_000);

  it('checkMath reports invalid math strictly, with file lines', async () => {
    const source = '---\ntitle: x\n---\n\n$E = mc^2$\n\n$$\n\\nosuchmacro{x}\n$$\n';
    const problems = await checkMath(source);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ line: 7 });
    expect(problems[0]?.message).toContain('nosuchmacro');
  });

  it('flags <Figure src> without alt text', () => {
    const body =
      'a\n<Figure src="/x.svg" caption="c" />\n<Figure src="/y.svg" alt="図" />\n<Figure caption="z">\n</Figure>\n<Figure\n  src="/z.svg"\n  alt=""\n/>';
    expect(figuresWithoutAlt(body, 1)).toEqual([{ line: 2 }, { line: 6 }]);
  });
});
