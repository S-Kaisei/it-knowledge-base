import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SITE } from '~/lib/site';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';

function GitHubMark({ className }: { className?: string }) {
  // GitHub mark (brand icons are not shipped by lucide-react).
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** Sticky site header. `search` is the search trigger slot. */
export function SiteHeader({ search }: { search?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur-md nav:gap-4">
      <MobileNav />
      <Link to="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight whitespace-nowrap text-fg no-underline">
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-[7px] bg-fg font-mono text-xs font-medium text-bg">
          IT
        </span>
        <span className="max-[520px]:sr-only">{SITE.name}</span>
      </Link>
      <div className="ml-auto flex min-w-0 flex-1 justify-end nav:max-w-[420px]">{search}</div>
      <a
        href={SITE.repoUrl}
        className="hidden size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg nav:grid"
        aria-label="GitHub リポジトリ"
        rel="noopener noreferrer"
      >
        <GitHubMark className="size-[18px]" />
      </a>
      <ThemeToggle />
    </header>
  );
}
