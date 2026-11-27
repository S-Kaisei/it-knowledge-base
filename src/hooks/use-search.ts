import { useEffect, useState } from 'react';
import { type PagefindApi, type SearchOption, toSearchOptions } from '~/lib/search';

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface SearchState {
  status: SearchStatus;
  /** The query the current `options` belong to (trimmed). */
  query: string;
  options: SearchOption[];
  /** Number of matching articles (not counting heading sections). */
  total: number;
}

/** Max articles shown in the dialog. */
export const MAX_RESULTS = 8;
const DEBOUNCE_MS = 120;

interface UseSearchArgs {
  /** Load Pagefind only while the dialog is open. */
  enabled: boolean;
  query: string;
  loader: () => Promise<PagefindApi>;
  basename: string;
  /** Classifies a loader failure as "index unavailable" (vs. an unexpected error). */
  isUnavailable: (e: unknown) => boolean;
}

/**
 * Runs Pagefind searches for `query`. Pagefind is imported lazily on first enable (browser only — effects
 * never run during prerender). Stale responses are discarded, so fast typing cannot show older results.
 */
export function useSearch({ enabled, query, loader, basename, isUnavailable }: UseSearchArgs): SearchState {
  const [api, setApi] = useState<PagefindApi | null>(null);
  const [loadState, setLoadState] = useState<'pending' | 'ok' | 'unavailable' | 'error'>('pending');
  const [result, setResult] = useState<{ query: string; options: SearchOption[]; total: number; failed: boolean } | null>(null);

  useEffect(() => {
    if (!enabled || api) return;
    let cancelled = false;
    loader().then(
      (pf) => {
        if (cancelled) return;
        setApi(pf);
        setLoadState('ok');
      },
      (e: unknown) => {
        if (!cancelled) setLoadState(isUnavailable(e) ? 'unavailable' : 'error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, api, loader, isUnavailable]);

  const term = query.trim();

  useEffect(() => {
    if (!api || !term) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.search(term);
          if (cancelled || !res) return;
          const data = await Promise.all(res.results.slice(0, MAX_RESULTS).map((r) => r.data()));
          if (cancelled) return;
          setResult({ query: term, options: toSearchOptions(data, basename), total: res.results.length, failed: false });
        } catch {
          if (!cancelled) setResult({ query: term, options: [], total: 0, failed: true });
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, term, basename]);

  if (loadState === 'unavailable') return { status: 'unavailable', query: term, options: [], total: 0 };
  if (loadState === 'error') return { status: 'error', query: term, options: [], total: 0 };
  if (!term) return { status: 'idle', query: term, options: [], total: 0 };
  if (loadState === 'pending' || !result || result.query !== term) {
    // Keep showing the previous results while the next query runs (avoids flicker), flagged as loading.
    return { status: 'loading', query: term, options: result?.options ?? [], total: result?.total ?? 0 };
  }
  if (result.failed) return { status: 'error', query: term, options: [], total: 0 };
  return { status: 'ready', query: term, options: result.options, total: result.total };
}
