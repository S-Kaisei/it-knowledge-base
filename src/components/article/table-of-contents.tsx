import { useMemo } from 'react';
import { useActiveHeading } from '~/hooks/use-active-heading';
import type { TocItem } from '~/lib/content-schema';
import { cn } from '~/lib/utils';

/** Sticky right-column TOC with scroll-spy (desktop ≥1241px). */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useActiveHeading(ids);
  if (items.length === 0) return null;
  return (
    <nav aria-label="この記事の目次" className="text-[13px] leading-normal">
      <p className="mb-2.5 text-xs font-semibold tracking-[0.04em] text-subtle">この記事の目次</p>
      <ol className="border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? 'location' : undefined}
              className={cn(
                '-ml-px block border-l-2 py-1 no-underline',
                item.depth === 3 ? 'pl-6' : 'pl-3',
                active === item.id ? 'border-accent font-semibold text-accent-text' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Collapsible TOC shown above the body on narrower screens (≤1240px). */
export function InlineTableOfContents({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <details className="mt-5 rounded-lg border border-border text-sm toc:hidden">
      <summary className="cursor-pointer px-3.5 py-2.5 font-semibold text-muted">この記事の目次</summary>
      <ol className="px-3.5 pb-3 pl-8 leading-loose">
        {items.map((item) => (
          <li key={item.id} className={item.depth === 3 ? 'ml-4' : undefined}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </details>
  );
}
