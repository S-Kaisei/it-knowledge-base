import { NavLink } from 'react-router';
import { articlesInCategory, contentIndex, publishedCategories } from '~/lib/content';
import type { ContentIndex } from '~/lib/content-schema';
import { cn } from '~/lib/utils';

type Props = { index?: ContentIndex; onNavigate?: () => void };

/** Category → article navigation. Only categories with published articles are listed. */
export function SidebarNav({ index = contentIndex, onNavigate }: Props) {
  const categories = publishedCategories(index);
  return (
    <nav aria-label="記事ナビゲーション" className="text-sm leading-normal">
      {categories.length === 0 ? (
        <p className="px-2 text-subtle">公開中の記事はまだありません。</p>
      ) : (
        <ul className="flex flex-col gap-[18px]">
          {categories.map((c) => (
            <li key={c.slug}>
              <NavLink
                to={c.path}
                end
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'mb-1.5 block rounded-md px-2 text-[11.5px] font-semibold tracking-[0.06em] uppercase no-underline',
                    isActive ? 'text-accent-text' : 'text-subtle hover:text-fg',
                  )
                }
              >
                {c.nameEn}
                <span className="ml-1.5 font-medium tracking-normal normal-case">{c.name}</span>
              </NavLink>
              <ul>
                {articlesInCategory(c.slug, index).map((a) => (
                  <li key={a.slug}>
                    <NavLink
                      to={a.path}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-md px-2 py-1.5 no-underline',
                          isActive ? 'bg-accent-soft font-semibold text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-fg',
                        )
                      }
                    >
                      {a.title}
                      {a.draft ? <span className="ml-1.5 text-xs font-normal text-warn">（下書き）</span> : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
