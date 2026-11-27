import { Search } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '~/lib/utils';
import { useSearchDialog } from './search-provider';

const noopSubscribe = () => () => {};

function detectShortcutLabel(): string {
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K';
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere; null during prerender/hydration (no mismatch). */
function useShortcutLabel(): string | null {
  return useSyncExternalStore(noopSubscribe, detectShortcutLabel, () => null);
}

function ShortcutHint({ className }: { className?: string }) {
  const label = useShortcutLabel();
  if (!label) return null;
  return (
    <kbd className={cn('rounded border border-border bg-bg px-1.5 font-mono text-[11px] leading-5 font-normal text-muted', className)} aria-hidden="true">
      {label}
    </kbd>
  );
}

/** Header search button styled like an input (icon-only on narrow screens). */
export function SearchTrigger() {
  const { openSearch } = useSearchDialog();
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="サイト内検索を開く"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K /"
      className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg sm:flex sm:h-9 sm:w-full sm:max-w-[360px] sm:items-center sm:gap-2 sm:border sm:border-border sm:bg-surface sm:px-3 sm:text-left sm:hover:bg-surface-2"
    >
      <Search className="size-[18px] shrink-0 sm:size-4" aria-hidden="true" />
      <span className="hidden flex-1 text-sm text-subtle sm:block">検索</span>
      <ShortcutHint className="hidden nav:inline-block" />
    </button>
  );
}

/** Large search button for the home hero; opens the same dialog. */
export function HeroSearchButton() {
  const { openSearch } = useSearchDialog();
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-haspopup="dialog"
      className="flex h-12 w-full max-w-[520px] items-center gap-3 rounded-[10px] border border-border bg-bg px-4 text-left text-subtle hover:border-subtle"
    >
      <Search className="size-[18px] shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[15px]">キーワードで検索（例: DNS 名前解決）</span>
      <ShortcutHint className="hidden sm:inline-block" />
    </button>
  );
}
