import { describe, expect, it } from 'vitest';
import {
  type PagefindResultData,
  decodeEntities,
  isOpenSearchShortcut,
  isPagefindApi,
  parseExcerpt,
  stripHeadingPrefix,
  toRouterPath,
  toSearchOptions,
  wrapIndex,
} from '~/lib/search';

describe('toRouterPath', () => {
  it('keeps root-relative URLs at the root base', () => {
    expect(toRouterPath('/network/fixture-network/', '/')).toBe('/network/fixture-network/');
  });

  it('strips the GitHub Pages sub-path base (router adds it back)', () => {
    expect(toRouterPath('/it-knowledge-base/network/fixture-network/', '/it-knowledge-base/')).toBe('/network/fixture-network/');
    expect(toRouterPath('/it-knowledge-base/network/fixture-network/', '/it-knowledge-base')).toBe('/network/fixture-network/');
    expect(toRouterPath('/it-knowledge-base/', '/it-knowledge-base/')).toBe('/');
    expect(toRouterPath('/it-knowledge-base', '/it-knowledge-base/')).toBe('/');
  });

  it('accepts URLs without the base even when a base is configured', () => {
    expect(toRouterPath('/fundamentals/fixture-basics/', '/it-knowledge-base/')).toBe('/fundamentals/fixture-basics/');
  });

  it('does not strip a path segment that only starts with the base name', () => {
    expect(toRouterPath('/it-knowledge-base-old/x/', '/it-knowledge-base/')).toBe('/it-knowledge-base-old/x/');
  });

  it('adds the trailing slash of directory URLs and canonicalises index.html', () => {
    expect(toRouterPath('/network/fixture-network', '/')).toBe('/network/fixture-network/');
    expect(toRouterPath('/network/fixture-network/index.html', '/')).toBe('/network/fixture-network/');
    expect(toRouterPath('/it-knowledge-base/network/fixture-network/index.html', '/it-knowledge-base/')).toBe('/network/fixture-network/');
  });

  it('keeps the heading hash of sub results', () => {
    expect(toRouterPath('/it-knowledge-base/fundamentals/fixture-basics/#概要', '/it-knowledge-base/')).toBe('/fundamentals/fixture-basics/#概要');
    expect(toRouterPath('/fundamentals/fixture-basics#%E6%A6%82%E8%A6%81', '/')).toBe('/fundamentals/fixture-basics/#%E6%A6%82%E8%A6%81');
  });

  it('drops the origin of absolute URLs', () => {
    expect(toRouterPath('https://example.github.io/it-knowledge-base/network/x/#a', '/it-knowledge-base/')).toBe('/network/x/#a');
  });

  it('handles relative URLs', () => {
    expect(toRouterPath('network/x/', '/')).toBe('/network/x/');
  });
});

describe('parseExcerpt', () => {
  it('splits text and <mark> hits', () => {
    expect(parseExcerpt('この記事は<mark>キャッシュ</mark>を含む')).toEqual([
      { text: 'この記事は', mark: false },
      { text: 'キャッシュ', mark: true },
      { text: 'を含む', mark: false },
    ]);
  });

  it('decodes entities so encoded markup shows as text', () => {
    expect(parseExcerpt('a &lt;b&gt; &amp; <mark>c&quot;</mark>')).toEqual([
      { text: 'a <b> & ', mark: false },
      { text: 'c"', mark: true },
    ]);
  });

  it('keeps any other tag as literal text (script tags are never markup)', () => {
    const segments = parseExcerpt('<script>alert(1)</script><mark>x</mark><img src=x onerror=alert(1)>');
    expect(segments).toEqual([
      { text: '<script>alert(1)</script>', mark: false },
      { text: 'x', mark: true },
      { text: '<img src=x onerror=alert(1)>', mark: false },
    ]);
  });

  it('drops attributes on <mark>', () => {
    expect(parseExcerpt('<mark class="hit" onclick="x()">a</mark>')).toEqual([{ text: 'a', mark: true }]);
    expect(parseExcerpt('<MARK>a</MARK>')).toEqual([{ text: 'a', mark: true }]);
  });

  it('flattens nested marks and tolerates unbalanced closing tags', () => {
    expect(parseExcerpt('<mark>a<mark>b</mark>c</mark>d')).toEqual([
      { text: 'abc', mark: true },
      { text: 'd', mark: false },
    ]);
    expect(parseExcerpt('a</mark>b<mark>c')).toEqual([
      { text: 'ab', mark: false },
      { text: 'c', mark: true },
    ]);
  });

  it('returns nothing for an empty excerpt', () => {
    expect(parseExcerpt('')).toEqual([]);
  });
});

describe('decodeEntities', () => {
  it('decodes numeric and named references and leaves unknown ones', () => {
    expect(decodeEntities('&#39;&#x41;&apos;&nbsp;&unknown;&#0;')).toBe("'A' &unknown;&#0;");
  });
});

describe('wrapIndex', () => {
  it('starts at the first / last item', () => {
    expect(wrapIndex(-1, 1, 3)).toBe(0);
    expect(wrapIndex(-1, -1, 3)).toBe(2);
  });
  it('wraps around both ends', () => {
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(1, 1, 3)).toBe(2);
  });
  it('returns -1 for an empty list', () => {
    expect(wrapIndex(0, 1, 0)).toBe(-1);
  });
});

describe('isOpenSearchShortcut', () => {
  const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; isComposing: boolean }> = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...mods,
  });
  it('opens on ⌘K and Ctrl+K, even in text fields', () => {
    expect(isOpenSearchShortcut(key('k', { metaKey: true }), false)).toBe(true);
    expect(isOpenSearchShortcut(key('K', { ctrlKey: true }), true)).toBe(true);
  });
  it('opens on "/" only outside editable elements', () => {
    expect(isOpenSearchShortcut(key('/'), false)).toBe(true);
    expect(isOpenSearchShortcut(key('/'), true)).toBe(false);
    expect(isOpenSearchShortcut(key('/', { ctrlKey: true }), false)).toBe(false);
  });
  it('ignores plain k, Alt combos and IME composition', () => {
    expect(isOpenSearchShortcut(key('k'), false)).toBe(false);
    expect(isOpenSearchShortcut(key('k', { ctrlKey: true, altKey: true }), false)).toBe(false);
    expect(isOpenSearchShortcut(key('k', { ctrlKey: true, isComposing: true }), false)).toBe(false);
  });
});

describe('toSearchOptions', () => {
  const data: PagefindResultData[] = [
    {
      url: '/it-knowledge-base/fundamentals/fixture-basics/',
      excerpt: '<mark>キャッシュ</mark>',
      meta: { title: 'テスト用記事（基礎）', category: 'IT基礎' },
      sub_results: [
        { title: 'テスト用記事（基礎）', url: '/it-knowledge-base/fundamentals/fixture-basics/', excerpt: 'top' },
        { title: '概要', url: '/it-knowledge-base/fundamentals/fixture-basics/#概要', excerpt: 'a' },
        { title: 'b', url: '/it-knowledge-base/fundamentals/fixture-basics/#b', excerpt: 'b' },
        { title: 'c', url: '/it-knowledge-base/fundamentals/fixture-basics/#c', excerpt: 'c' },
        { title: 'd', url: '/it-knowledge-base/fundamentals/fixture-basics/#d', excerpt: 'd' },
      ],
    },
    { url: '/it-knowledge-base/network/x/', excerpt: 'n', meta: {} },
  ];

  it('lists each article followed by up to 3 heading sections, with router paths', () => {
    const options = toSearchOptions(data, '/it-knowledge-base/');
    expect(options.map((o) => [o.kind, o.path, o.title])).toEqual([
      ['page', '/fundamentals/fixture-basics/', 'テスト用記事（基礎）'],
      ['section', '/fundamentals/fixture-basics/#概要', '概要'],
      ['section', '/fundamentals/fixture-basics/#b', 'b'],
      ['section', '/fundamentals/fixture-basics/#c', 'c'],
      ['page', '/network/x/', '/network/x/'],
    ]);
    expect(options[0]?.category).toBe('IT基礎');
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
  });
});

describe('stripHeadingPrefix', () => {
  it('drops the leading "heading. " Pagefind puts in section excerpts', () => {
    expect(stripHeadingPrefix('概要. この記事は<mark>検索</mark>', '概要')).toBe('この記事は<mark>検索</mark>');
  });
  it('keeps excerpts that do not start with the heading (or whose heading is highlighted)', () => {
    expect(stripHeadingPrefix('<mark>名前</mark><mark>解決</mark>. ドメイン名', '名前解決')).toBe('<mark>名前</mark><mark>解決</mark>. ドメイン名');
    expect(stripHeadingPrefix('本文', '')).toBe('本文');
  });
});

describe('isPagefindApi', () => {
  it('accepts a module exposing options/init/search', () => {
    const fn = () => Promise.resolve();
    expect(isPagefindApi({ options: fn, init: fn, search: fn })).toBe(true);
    expect(isPagefindApi({ options: fn })).toBe(false);
    expect(isPagefindApi(null)).toBe(false);
  });
});
