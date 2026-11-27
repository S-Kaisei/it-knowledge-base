// Pure helpers for the Pagefind-based site search (ADR-0005). No DOM / browser APIs here.

/** Subset of the Pagefind JS API (pagefind.js) that the search UI uses. */
export interface PagefindSubResult {
  title: string;
  url: string;
  excerpt: string;
}

export interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string | undefined>;
  sub_results?: PagefindSubResult[];
}

export interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

export interface PagefindApi {
  options: (opts: Record<string, unknown>) => Promise<void>;
  init: () => Promise<void>;
  search: (term: string) => Promise<{ results: PagefindResult[] } | null>;
}

/** Runtime shape check for the dynamically imported pagefind.js module. */
export function isPagefindApi(mod: unknown): mod is PagefindApi {
  if (typeof mod !== 'object' || mod === null) return false;
  const m = mod as Record<string, unknown>;
  return typeof m.options === 'function' && typeof m.init === 'function' && typeof m.search === 'function';
}

/**
 * Convert a Pagefind result URL into a path for React Router's `navigate()` / `<Link to>`,
 * i.e. WITHOUT the basename (the router adds it back).
 *
 * Pagefind prefixes result URLs with its `baseUrl` option, so depending on configuration the URL may be
 * "/it-knowledge-base/network/x/#id", "/network/x/#id" or even absolute. All of them map to "/network/x/#id".
 */
export function toRouterPath(url: string, basename: string): string {
  let path = url.trim();
  // Drop scheme + host of absolute URLs.
  const abs = /^[a-z][a-z\d+.-]*:\/\/[^/]*/i.exec(path);
  if (abs) path = path.slice(abs[0].length);
  if (!path.startsWith('/')) path = `/${path}`;

  const base = `/${basename.replace(/^\/+|\/+$/g, '')}`;
  if (base !== '/') {
    if (path === base) path = '/';
    else if (path.startsWith(`${base}/`) || path.startsWith(`${base}#`) || path.startsWith(`${base}?`)) path = path.slice(base.length);
    if (!path.startsWith('/')) path = `/${path}`;
  }

  // Pages are served as directories ("/category/slug/"): add the trailing slash Pagefind may omit.
  const m = /^([^?#]*)(.*)$/.exec(path);
  const pathname = m?.[1] ?? path;
  const rest = m?.[2] ?? '';
  const last = pathname.split('/').pop() ?? '';
  const needsSlash = !pathname.endsWith('/') && !last.includes('.');
  // Strip a trailing "index.html" so the URL matches the canonical directory form.
  const canonical = pathname.replace(/\/index\.html$/, '/');
  return `${needsSlash ? `${canonical}/` : canonical}${rest}`;
}

/** A piece of excerpt text; `mark` = highlighted search hit. */
export interface ExcerptSegment {
  text: string;
  mark: boolean;
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decode the HTML character references Pagefind emits (it encodes text before inserting <mark>). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/**
 * Turn an excerpt HTML string into plain-text segments. Only <mark> is honoured (attributes are dropped);
 * any other tag stays literal text, so rendering the segments as React text can never inject markup.
 */
export function parseExcerpt(html: string): ExcerptSegment[] {
  const segments: ExcerptSegment[] = [];
  let depth = 0;
  let last = 0;
  const push = (raw: string) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    const mark = depth > 0;
    const prev = segments[segments.length - 1];
    if (prev && prev.mark === mark) prev.text += text;
    else segments.push({ text, mark });
  };
  for (const match of html.matchAll(/<(\/?)mark(?:\s[^<>]*)?>/gi)) {
    push(html.slice(last, match.index));
    depth = match[1] ? Math.max(0, depth - 1) : depth + 1;
    last = match.index + match[0].length;
  }
  push(html.slice(last));
  return segments;
}

/** Move a keyboard highlight by `delta`, wrapping at both ends. -1 when there is nothing to highlight. */
export function wrapIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta >= 0 ? 0 : length - 1;
  return (((current + delta) % length) + length) % length;
}

export interface ShortcutEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}

/**
 * Whether a keydown should open the search dialog: ⌘K / Ctrl+K anywhere, "/" when not typing in a field.
 * `inEditable` = the event target is an input, textarea, select or contenteditable element.
 */
export function isOpenSearchShortcut(e: ShortcutEvent, inEditable: boolean): boolean {
  if (e.isComposing) return false;
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') return true;
  return e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !inEditable;
}

/** One selectable row in the results list: an article, or a heading section inside it. */
export interface SearchOption {
  id: string;
  kind: 'page' | 'section';
  path: string;
  title: string;
  category?: string;
  excerpt: string;
}

/** Max heading sections listed under an article result. */
export const MAX_SECTIONS_PER_PAGE = 3;

/**
 * Pagefind starts a section excerpt with the heading text plus ". " ("概要. この記事は…"). The heading is
 * already shown as the option title, so drop that prefix (only when it is unhighlighted plain text).
 */
export function stripHeadingPrefix(excerpt: string, heading: string): string {
  const prefix = `${heading}. `;
  return heading && excerpt.startsWith(prefix) ? excerpt.slice(prefix.length) : excerpt;
}

/** Flatten Pagefind result data into keyboard-navigable options (article, then its matching sections). */
export function toSearchOptions(results: ReadonlyArray<PagefindResultData>, basename: string): SearchOption[] {
  const options: SearchOption[] = [];
  results.forEach((r, i) => {
    const path = toRouterPath(r.url, basename);
    options.push({ id: `search-opt-${i}`, kind: 'page', path, title: r.meta.title ?? path, category: r.meta.category, excerpt: r.excerpt });
    const sections = (r.sub_results ?? []).filter((s) => s.url.includes('#')).slice(0, MAX_SECTIONS_PER_PAGE);
    sections.forEach((s, j) => {
      options.push({
        id: `search-opt-${i}-${j}`,
        kind: 'section',
        path: toRouterPath(s.url, basename),
        title: s.title,
        excerpt: stripHeadingPrefix(s.excerpt, s.title),
      });
    });
  });
  return options;
}
