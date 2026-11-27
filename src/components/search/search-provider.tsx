import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type PagefindApi, isOpenSearchShortcut } from '~/lib/search';
import { loadPagefind } from './pagefind';
import { SearchDialog } from './search-dialog';

interface SearchContextValue {
  /** Open the search dialog. Focus returns to the element that was focused before opening. */
  openSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearchDialog(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchDialog must be used inside <SearchProvider>');
  return ctx;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

interface SearchProviderProps {
  children: ReactNode;
  /** Injectable for tests; defaults to the lazy pagefind.js import. */
  loader?: () => Promise<PagefindApi>;
}

/**
 * Owns the single search dialog shared by the header trigger and the home hero, and the global
 * shortcuts (⌘K / Ctrl+K anywhere, "/" outside text fields).
 */
export function SearchProvider({ children, loader = loadPagefind }: SearchProviderProps) {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openSearch = useCallback(() => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnFocus.current = document.activeElement;
    } else {
      returnFocus.current = null;
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isOpenSearchShortcut(e, isEditable(e.target))) return;
      e.preventDefault();
      // ⌘K inside the open dialog keeps it open (the input stays focused).
      if (!open) openSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openSearch]);

  const onCloseAutoFocus = useCallback((e: Event) => {
    const el = returnFocus.current;
    returnFocus.current = null;
    // Radix would focus its (absent) Trigger; return focus to the opener ourselves when it still exists.
    e.preventDefault();
    if (el?.isConnected) el.focus();
  }, []);

  const value = useMemo(() => ({ openSearch }), [openSearch]);

  return (
    <SearchContext value={value}>
      {children}
      <SearchDialog open={open} onOpenChange={setOpen} onCloseAutoFocus={onCloseAutoFocus} loader={loader} />
    </SearchContext>
  );
}
