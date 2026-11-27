import rawIndex from '~/generated/content-index.json';
import type { ArticleMeta, CategorySummary, ContentIndex } from './content-schema.ts';

/** Build-time generated content index (scripts/generate-content.mjs). Never scan src/content at runtime. */
export const contentIndex = rawIndex as unknown as ContentIndex;

export function getCategory(slug: string | undefined, index: ContentIndex = contentIndex): CategorySummary | undefined {
  return slug ? index.categories.find((c) => c.slug === slug) : undefined;
}

export function getArticle(slug: string | undefined, index: ContentIndex = contentIndex): ArticleMeta | undefined {
  return slug ? index.articles.find((a) => a.slug === slug) : undefined;
}

/** Find an article by router pathname (basename already stripped); trailing slash optional. */
export function getArticleByPath(pathname: string, index: ContentIndex = contentIndex): ArticleMeta | undefined {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return index.articles.find((a) => a.path === normalized);
}

export function articlesInCategory(category: string, index: ContentIndex = contentIndex): ArticleMeta[] {
  return index.articles.filter((a) => a.category === category);
}

/** Categories that have at least one listed article (only these appear in navigation). */
export function publishedCategories(index: ContentIndex = contentIndex): CategorySummary[] {
  return index.categories.filter((c) => c.articleCount > 0);
}

/** Most recently updated articles (ties broken by title for deterministic output). */
export function recentArticles(limit: number, index: ContentIndex = contentIndex): ArticleMeta[] {
  return [...index.articles].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated) || a.title.localeCompare(b.title, 'ja')).slice(0, limit);
}

/** Resolve slugs to articles, silently skipping unknown slugs (content:check reports them). */
export function resolveArticles(slugs: readonly string[], index: ContentIndex = contentIndex): ArticleMeta[] {
  return slugs.map((s) => getArticle(s, index)).filter((a): a is ArticleMeta => a !== undefined);
}

/** Route id used for article routes in src/routes.ts. */
export const ARTICLE_ROUTE_PREFIX = 'article/';

export function slugFromRouteId(id: string): string | undefined {
  return id.startsWith(ARTICLE_ROUTE_PREFIX) ? id.slice(ARTICLE_ROUTE_PREFIX.length) : undefined;
}
