import { useSyncExternalStore } from 'react';
import type { ResolvedTheme } from '~/lib/theme';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function getSnapshot(): ResolvedTheme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * The theme currently applied to <html data-theme>, updated when it changes (MutationObserver).
 * Returns undefined while pre-rendering, where there is no document.
 */
export function useDataTheme(): ResolvedTheme | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
