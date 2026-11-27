import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// mermaid itself needs real layout (getBBox etc.), so the dynamic import is replaced by a stub.
const mermaidApi = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (id: string, _chart: string) => ({ svg: `<svg id="${id}" viewBox="0 0 540.5 120"><g></g></svg>` })),
}));
vi.mock('mermaid', () => ({ default: mermaidApi }));

const { Mermaid } = await import('~/components/diagrams/mermaid');

const CHART = 'flowchart LR\n  A --> B';

describe('Mermaid', () => {
  beforeEach(() => {
    mermaidApi.initialize.mockClear();
    mermaidApi.render.mockClear();
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('pre-render (server) output contains the source and never loads mermaid', () => {
    const html = renderToString(<Mermaid chart={CHART} />);
    expect(html).toContain('data-mermaid-source');
    expect(html).toContain('flowchart LR');
    expect(html).toContain('data-mermaid="pending"');
    expect(mermaidApi.render).not.toHaveBeenCalled();
  });

  it('shows the source first, then the rendered SVG with an accessible name', async () => {
    const { container } = render(<Mermaid chart={CHART} />);
    expect(container.querySelector('[data-mermaid-source]')).toHaveTextContent('flowchart LR');
    const img = await screen.findByRole('img', { name: '図（内容は本文で説明しています）' });
    expect(img.querySelector('svg')).not.toBeNull();
    // Natural width from the viewBox keeps text legible on narrow screens (see app.css).
    expect(img.style.getPropertyValue('--mermaid-natural-width')).toBe('541px');
    // Diagram source / labels are not article text for search.
    expect(container.querySelector('figure')).toHaveAttribute('data-pagefind-ignore');
    expect(container.querySelector('[data-mermaid-source]')).toBeNull();
    expect(container.querySelector('[data-mermaid-error]')).toBeNull();
    expect(mermaidApi.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict', startOnLoad: false }));
  });

  it('uses accTitle as the accessible name and unique ids per diagram', async () => {
    render(
      <>
        <Mermaid chart={'flowchart LR\n  accTitle: 処理の流れ\n  A --> B'} />
        <Mermaid chart={CHART} />
      </>,
    );
    await screen.findByRole('img', { name: '処理の流れ' });
    await waitFor(() => expect(mermaidApi.render).toHaveBeenCalledTimes(2));
    const ids = mermaidApi.render.mock.calls.map((c) => c[0]);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z][\w-]*$/);
  });

  it('re-renders when the theme changes', async () => {
    render(<Mermaid chart={CHART} />);
    await screen.findByRole('img');
    expect(mermaidApi.render).toHaveBeenCalledTimes(1);
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await waitFor(() => expect(mermaidApi.render).toHaveBeenCalledTimes(2));
    expect(mermaidApi.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ themeVariables: expect.objectContaining({ darkMode: true }) }));
  });

  it('on failure sets data-mermaid-error and keeps the source visible with a notice', async () => {
    mermaidApi.render.mockRejectedValueOnce(new Error('Parse error on line 2:\n...'));
    const { container } = render(<Mermaid chart={'flowchart LR\n  A --> -->'} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('図を表示できませんでした');
    const figure = container.querySelector('figure');
    expect(figure).toHaveAttribute('data-mermaid-error', expect.stringContaining('Parse error on line 2'));
    expect(container.querySelector('[data-mermaid-source]')).toHaveTextContent('A --> -->');
  });
});
