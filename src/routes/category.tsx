import { Link, useMatches } from 'react-router';
import type { Route } from './+types/category';
import { DifficultyBadge } from '~/components/article/difficulty-badge';
import { CategoryIcon } from '~/components/ui/category-icon';
import { articlesInCategory, getCategory } from '~/lib/content';
import { pageTitle } from '~/lib/site';
import { NotFoundContent } from './not-found';

/** Category slug from the route id ("category/<slug>") set in src/routes.ts. */
function slugFromMatches(matches: ReadonlyArray<{ id: string } | undefined>): string | undefined {
  const id = [...matches].reverse().find((m) => m?.id.startsWith('category/'))?.id;
  return id?.slice('category/'.length);
}

export const meta: Route.MetaFunction = ({ matches, location }) => {
  const c = getCategory(slugFromMatches(matches) ?? location.pathname.split('/').filter(Boolean)[0]);
  if (!c) return [{ title: pageTitle('ページが見つかりません') }, { name: 'robots', content: 'noindex' }];
  return [{ title: pageTitle(c.name) }, { name: 'description', content: c.description }];
};

export default function CategoryPage() {
  const category = getCategory(slugFromMatches(useMatches()));
  if (!category) return <NotFoundContent />;
  const articles = articlesInCategory(category.slug);

  return (
    <div className="mx-auto max-w-[720px] px-4 pt-8 pb-20 nav:px-0">
      <nav aria-label="パンくずリスト" className="flex flex-wrap items-center gap-1.5 text-[13px] leading-snug text-subtle">
        <Link to="/" className="text-muted no-underline hover:text-fg hover:underline">
          ホーム
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{category.name}</span>
      </nav>
      <div className="mt-3.5 flex items-center gap-3">
        <CategoryIcon name={category.icon} className="size-7 text-accent-text" />
        <h1 className="text-[clamp(28px,4vw,36px)] leading-tight font-bold tracking-tight">{category.name}</h1>
      </div>
      <p className="mt-3 text-[17px] text-muted">{category.description}</p>

      {articles.length === 0 ? (
        <p className="mt-10 rounded-[10px] border border-border bg-surface px-5 py-4 text-muted">このカテゴリの記事は準備中です。</p>
      ) : (
        <ol className="mt-8 border-t border-border">
          {articles.map((a) => (
            <li key={a.slug} className="border-b border-border">
              <Link to={a.path} className="group block px-1 py-4 text-fg no-underline">
                <span className="text-[17px] font-semibold group-hover:text-accent-text">{a.title}</span>
                <span className="mt-1 block text-[14.5px] leading-relaxed text-muted">{a.description}</span>
                <span className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-subtle">
                  <DifficultyBadge difficulty={a.difficulty} />
                  <span>読了 約{a.readingMinutes}分</span>
                  {a.draft ? <span className="text-warn">下書き</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
