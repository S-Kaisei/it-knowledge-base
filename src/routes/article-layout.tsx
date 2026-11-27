import { MDXProvider } from '@mdx-js/react';
import { Link, Outlet, useMatches } from 'react-router';
import type { Route } from './+types/article-layout';
import { ArticlePager, ReferenceList, RelatedArticles } from '~/components/article/article-footer';
import { DifficultyBadge } from '~/components/article/difficulty-badge';
import { mdxComponents } from '~/components/article/mdx-components';
import { InlineTableOfContents, TableOfContents } from '~/components/article/table-of-contents';
import { getArticle, getArticleByPath, getCategory, resolveArticles, slugFromRouteId } from '~/lib/content';
import type { ArticleMeta } from '~/lib/content-schema';
import { SITE, pageTitle } from '~/lib/site';

function findArticle(matches: ReadonlyArray<{ id: string } | undefined>): ArticleMeta | undefined {
  for (const m of [...matches].reverse()) {
    const slug = m ? slugFromRouteId(m.id) : undefined;
    if (slug) return getArticle(slug);
  }
  return undefined;
}

// Article MDX route modules export no meta, so this layout's meta applies to every article.
export const meta: Route.MetaFunction = ({ matches, location }) => {
  const a = findArticle(matches) ?? getArticleByPath(location.pathname);
  if (!a) return [{ title: pageTitle() }];
  return [
    { title: pageTitle(a.title) },
    { name: 'description', content: a.description },
    { property: 'og:title', content: a.title },
    { property: 'og:description', content: a.description },
    { property: 'og:type', content: 'article' },
    { property: 'og:site_name', content: SITE.name },
    ...(a.draft ? [{ name: 'robots', content: 'noindex' }] : []),
  ];
};

export default function ArticleLayout() {
  const article = findArticle(useMatches());
  if (!article) return <Outlet />;
  const category = getCategory(article.category);
  const prerequisites = resolveArticles(article.prerequisites);

  return (
    <div className="flex">
      <div className="min-w-0 flex-1 px-4 pt-5 pb-20 nav:px-12 nav:pt-8">
        <article className="mx-auto max-w-[720px]" data-pagefind-body="" data-pagefind-meta={`category:${category?.name ?? ''}`}>
          <nav aria-label="パンくずリスト" className="flex flex-wrap items-center gap-1.5 text-[13px] leading-snug text-subtle" data-pagefind-ignore="">
            <Link to="/" className="text-muted no-underline hover:text-fg hover:underline">
              ホーム
            </Link>
            <span aria-hidden="true">/</span>
            {category ? (
              <>
                <Link to={category.path} className="text-muted no-underline hover:text-fg hover:underline">
                  {category.name}
                </Link>
                <span aria-hidden="true">/</span>
              </>
            ) : null}
            <span aria-current="page">{article.title}</span>
          </nav>

          {article.draft ? (
            <p className="mt-4 rounded-lg border border-warn/30 bg-warn-soft px-4 py-2 text-sm" data-pagefind-ignore="">
              <b className="mr-3 text-warn">下書き</b>この記事は公開前の下書きです。開発サーバーでのみ表示されます。
            </p>
          ) : null}

          <h1 className="mt-3.5 mb-3 text-[clamp(28px,4vw,36px)] leading-[1.3] font-bold tracking-[-0.015em]">{article.title}</h1>
          <p className="mb-4.5 text-[17px] text-muted">{article.description}</p>
          <div
            className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-border pb-6 text-[13px] leading-snug text-subtle"
            data-pagefind-ignore=""
          >
            <DifficultyBadge difficulty={article.difficulty} />
            <span>読了 約{article.readingMinutes}分</span>
            {prerequisites.length > 0 ? (
              <span>
                前提：
                {prerequisites.map((p, i) => (
                  <span key={p.slug}>
                    {i > 0 ? '、' : ''}
                    <Link to={p.path}>{p.title}</Link>
                  </span>
                ))}
              </span>
            ) : null}
          </div>

          <InlineTableOfContents items={article.toc} />

          <div className="prose-ikb mt-7">
            <MDXProvider components={mdxComponents}>
              <Outlet />
            </MDXProvider>
          </div>

          <div data-pagefind-ignore="">
            <RelatedArticles article={article} />
            <ReferenceList article={article} />
            <ArticlePager article={article} />
            <div className="mt-5 flex flex-wrap gap-4 text-[12.5px] text-subtle">
              <span>最終更新 {article.lastUpdated}</span>
              {article.lastVerified ? <span>情報源の確認 {article.lastVerified}</span> : null}
              <a href={`${SITE.repoUrl}/blob/main/src/content/${article.file}`} rel="noopener noreferrer" className="text-subtle">
                この記事のソースを見る
              </a>
            </div>
          </div>
        </article>
      </div>
      <aside className="sticky top-[var(--header-h)] hidden h-[calc(100vh-var(--header-h))] w-[220px] shrink-0 overflow-y-auto pt-8 pr-4 pb-10 pl-2 toc:block">
        <TableOfContents items={article.toc} />
      </aside>
    </div>
  );
}
