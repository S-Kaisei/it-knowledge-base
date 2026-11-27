import { describe, expect, it } from 'vitest';
import { getArticleByPath, publishedCategories, recentArticles, resolveArticles, slugFromRouteId } from '~/lib/content';
import type { ArticleMeta, ContentIndex } from '~/lib/content-schema';

function article(slug: string, category: string, lastUpdated: string): ArticleMeta {
  return {
    title: slug,
    description: 'description for tests',
    slug,
    category,
    difficulty: 'beginner',
    tags: [],
    prerequisites: [],
    related: [],
    order: 1,
    draft: false,
    lastUpdated,
    references: [],
    path: `/${category}/${slug}/`,
    file: `${category}/${slug}.mdx`,
    toc: [],
    readingMinutes: 1,
    prev: null,
    next: null,
  };
}

const index: ContentIndex = {
  includeDrafts: false,
  categories: [
    {
      slug: 'fundamentals',
      name: 'IT基礎',
      nameEn: 'Fundamentals',
      description: 'd',
      topics: 't',
      icon: 'cpu',
      order: 1,
      articleCount: 2,
      path: '/fundamentals/',
    },
    { slug: 'network', name: 'ネットワーク', nameEn: 'Network', description: 'd', topics: 't', icon: 'globe', order: 2, articleCount: 0, path: '/network/' },
  ],
  articles: [article('cpu', 'fundamentals', '2026-01-01'), article('cache', 'fundamentals', '2026-03-01')],
};

describe('content helpers', () => {
  it('finds articles by router path with or without trailing slash', () => {
    expect(getArticleByPath('/fundamentals/cpu/', index)?.slug).toBe('cpu');
    expect(getArticleByPath('/fundamentals/cpu', index)?.slug).toBe('cpu');
    expect(getArticleByPath('/fundamentals/none/', index)).toBeUndefined();
  });

  it('lists only categories with articles for navigation', () => {
    expect(publishedCategories(index).map((c) => c.slug)).toEqual(['fundamentals']);
  });

  it('sorts recent articles by lastUpdated descending', () => {
    expect(recentArticles(5, index).map((a) => a.slug)).toEqual(['cache', 'cpu']);
    expect(recentArticles(1, index)).toHaveLength(1);
  });

  it('skips unknown slugs when resolving related articles', () => {
    expect(resolveArticles(['cache', 'missing'], index).map((a) => a.slug)).toEqual(['cache']);
  });

  it('extracts slugs from article route ids only', () => {
    expect(slugFromRouteId('article/cache')).toBe('cache');
    expect(slugFromRouteId('routes/home')).toBeUndefined();
  });
});
