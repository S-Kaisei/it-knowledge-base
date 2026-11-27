import { Link } from 'react-router';
import type { Route } from './+types/home';
import { HeroSearchButton } from '~/components/search/search-trigger';
import { CategoryIcon } from '~/components/ui/category-icon';
import { contentIndex, recentArticles } from '~/lib/content';
import { SITE, pageTitle } from '~/lib/site';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [
  { title: pageTitle() },
  { name: 'description', content: SITE.description },
  { property: 'og:title', content: SITE.name },
  { property: 'og:description', content: SITE.description },
  { property: 'og:type', content: 'website' },
];

export default function Home() {
  const recent = recentArticles(5);
  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-20 nav:px-12">
      <section className="border-b border-border pt-10 pb-8">
        <p className="font-mono text-[12.5px] tracking-[0.04em] text-accent-text">IT KNOWLEDGE BASE</p>
        <h1 className="mt-2 mb-2.5 text-[clamp(30px,5vw,44px)] leading-tight font-bold tracking-tight">{SITE.tagline}</h1>
        <p className="mb-5 max-w-[560px] text-[17px] text-muted">{SITE.description}</p>
        <HeroSearchButton />
      </section>

      <div className="mt-9 mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">カテゴリ</h2>
        <span className="text-[13px] text-subtle">公開済みの記事数</span>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-px overflow-hidden rounded-[10px] border border-border bg-border">
        {contentIndex.categories.map((c) => {
          const empty = c.articleCount === 0;
          const body = (
            <>
              <CategoryIcon name={c.icon} className={cn('row-span-2 mt-0.5 size-5', empty ? 'text-subtle' : 'text-accent-text')} />
              <span className={cn('flex justify-between gap-2 text-[15px] font-semibold', empty && 'text-subtle')}>
                {c.name}
                <span className="shrink-0 font-mono text-xs font-normal whitespace-nowrap text-subtle">{empty ? '準備中' : c.articleCount}</span>
              </span>
              <span className="text-[12.5px] text-subtle">{c.topics}</span>
            </>
          );
          const cls = 'grid h-full grid-cols-[32px_1fr] gap-x-3 gap-y-1 bg-bg px-[18px] py-4 leading-normal text-fg no-underline';
          return (
            <li key={c.slug}>
              {empty ? (
                <div className={cls} aria-label={`${c.name}（準備中）`}>
                  {body}
                </div>
              ) : (
                <Link to={c.path} className={cn(cls, 'hover:bg-surface')}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-9 mb-3.5">
        <h2 className="text-lg font-bold">最近更新された記事</h2>
      </div>
      {recent.length === 0 ? (
        <p className="text-muted">公開中の記事はまだありません。</p>
      ) : (
        <ul className="border-t border-border">
          {recent.map((a) => (
            <li key={a.slug}>
              <Link
                to={a.path}
                className="group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-border px-1 py-3.5 leading-normal text-fg no-underline"
              >
                <b className="font-semibold group-hover:text-accent-text">{a.title}</b>
                <span className="row-span-2 self-center text-xs text-muted">{contentIndex.categories.find((c) => c.slug === a.category)?.name}</span>
                <small className="text-[13px] text-subtle">
                  {a.description} — {a.lastUpdated}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
