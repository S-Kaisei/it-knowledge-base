// Type-only import: erased at build time, the runtime module is loaded with import() below.
import type { Mermaid as MermaidApi } from 'mermaid';
import { type CSSProperties, useEffect, useId, useState } from 'react';
import { useDataTheme } from '~/hooks/use-data-theme';
import type { ResolvedTheme } from '~/lib/theme';

type RenderState = { status: 'pending' } | { status: 'rendered'; svg: string } | { status: 'error'; message: string };

let mermaidPromise: Promise<MermaidApi> | undefined;
/** Loaded on first use in the browser only (never during pre-render). */
function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  return mermaidPromise;
}

// mermaid keeps global config, so renders are serialized to keep initialize() and render() paired.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Map the site's design tokens (CSS variables on <html>) to Mermaid's "base" theme variables. */
function themeVariables(theme: ResolvedTheme): Record<string, string | boolean> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    darkMode: theme === 'dark',
    background: v('--bg'),
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontSize: '14px',
    primaryColor: v('--accent-soft'),
    primaryTextColor: v('--fg'),
    primaryBorderColor: v('--accent'),
    secondaryColor: v('--surface-2'),
    secondaryTextColor: v('--fg'),
    secondaryBorderColor: v('--border'),
    tertiaryColor: v('--surface'),
    tertiaryTextColor: v('--fg'),
    tertiaryBorderColor: v('--border'),
    lineColor: v('--muted'),
    textColor: v('--fg'),
    mainBkg: v('--accent-soft'),
    nodeBorder: v('--accent'),
    clusterBkg: v('--surface'),
    clusterBorder: v('--border'),
    edgeLabelBackground: v('--bg'),
    noteBkgColor: v('--note-soft'),
    noteTextColor: v('--fg'),
    noteBorderColor: v('--note'),
    actorBkg: v('--accent-soft'),
    actorBorder: v('--accent'),
    actorTextColor: v('--fg'),
    signalColor: v('--fg'),
    signalTextColor: v('--fg'),
  };
}

/** `accTitle: ...` in the diagram source becomes the accessible name; otherwise a generic one. */
function accessibleName(chart: string): string {
  const m = /^\s*accTitle\s*:\s*(.+)$/m.exec(chart);
  return m?.[1]?.trim() || '図（内容は本文で説明しています）';
}

/** Natural width of the rendered SVG (from its viewBox), used to keep text legible on narrow screens. */
function naturalWidth(svg: string): number | undefined {
  const m = /viewBox="[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+[\d.]+"/.exec(svg);
  const w = m?.[1] ? Number(m[1]) : NaN;
  return Number.isFinite(w) && w > 0 ? Math.round(w) : undefined;
}

function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.replace(/\s+/g, ' ').trim().slice(0, 300) || '不明なエラー';
}

let renderCount = 0;

/**
 * Client-only Mermaid renderer for ```mermaid fences (converted by remarkMermaid in mdx-options.mjs).
 * Pre-rendered HTML contains the diagram source (<pre>) until the SVG is ready. Failures are exposed as
 * `data-mermaid-error` (detected by E2E) and shown to the reader together with the source.
 */
export function Mermaid({ chart }: { chart: string }) {
  const theme = useDataTheme();
  const baseId = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [state, setState] = useState<RenderState>({ status: 'pending' });

  useEffect(() => {
    if (!theme) return undefined;
    let cancelled = false;
    enqueue(async () => {
      const mermaid = await loadMermaid();
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: 'base',
        themeVariables: themeVariables(theme),
      });
      renderCount += 1;
      return mermaid.render(`${baseId}-${renderCount}`, chart);
    }).then(
      ({ svg }) => {
        if (!cancelled) setState({ status: 'rendered', svg });
      },
      (e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [chart, theme, baseId]);

  return (
    // data-pagefind-ignore: neither the diagram source nor the SVG labels are article text for search.
    <figure
      className="mermaid-figure"
      data-pagefind-ignore=""
      data-mermaid={state.status}
      data-mermaid-error={state.status === 'error' ? state.message : undefined}
    >
      {state.status === 'rendered' ? (
        // The SVG comes from our own MDX source and is sanitized by Mermaid (securityLevel: 'strict').
        <div
          className="mermaid-svg"
          role="img"
          aria-label={accessibleName(chart)}
          // Focusable so a diagram wider than the screen can be scrolled with the keyboard.
          tabIndex={0}
          style={{ '--mermaid-natural-width': `${naturalWidth(state.svg) ?? 0}px` } as CSSProperties}
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : (
        <>
          {state.status === 'error' ? (
            <p className="mermaid-error" role="alert">
              図を表示できませんでした。図の元になったテキストを表示しています。（{state.message}）
            </p>
          ) : null}
          <pre className="mermaid-source" data-mermaid-source="">
            <code>{chart}</code>
          </pre>
        </>
      )}
    </figure>
  );
}
