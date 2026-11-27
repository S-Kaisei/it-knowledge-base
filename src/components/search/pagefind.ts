import { type PagefindApi, isPagefindApi } from '~/lib/search';
import { withBase } from '~/lib/utils';

/** The Pagefind bundle is not available (dev server, or the index was not generated). */
export class PagefindUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Pagefind index is not available', { cause });
    this.name = 'PagefindUnavailableError';
  }
}

let loading: Promise<PagefindApi> | undefined;

async function importPagefind(): Promise<PagefindApi> {
  // The index only exists in production builds (`pagefind --site build/client`). Skipping the request in dev
  // avoids a 404 + console error on every dialog open.
  if (import.meta.env.DEV) throw new PagefindUnavailableError();
  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ withBase('/pagefind/pagefind.js'));
  } catch (e) {
    throw new PagefindUnavailableError(e);
  }
  if (!isPagefindApi(mod)) throw new PagefindUnavailableError();
  // Result URLs are prefixed with the deploy base ("/" or "/it-knowledge-base/"); toRouterPath() strips it again.
  await mod.options({ baseUrl: import.meta.env.BASE_URL, excerptLength: 26 });
  await mod.init();
  return mod;
}

/**
 * Lazily load pagefind.js in the browser (never during prerender). The promise is cached;
 * a failed load is forgotten so the next attempt retries.
 */
export function loadPagefind(): Promise<PagefindApi> {
  loading ??= importPagefind().catch((e: unknown) => {
    loading = undefined;
    throw e;
  });
  return loading;
}
