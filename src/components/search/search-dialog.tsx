import * as Dialog from '@radix-ui/react-dialog';
import { CornerDownLeft, FileText, Hash, Search } from 'lucide-react';
import { type ChangeEvent, type CompositionEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSearch } from '~/hooks/use-search';
import { type PagefindApi, type SearchOption, parseExcerpt, wrapIndex } from '~/lib/search';
import { cn } from '~/lib/utils';
import { PagefindUnavailableError } from './pagefind';

export const DEV_INDEX_MESSAGE = '検索インデックスは本番ビルド後に利用できます（npm run build）';
export const NO_RESULTS_MESSAGE = '一致する記事が見つかりませんでした';

const isUnavailable = (e: unknown) => e instanceof PagefindUnavailableError;

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
  loader: () => Promise<PagefindApi>;
}

export function SearchDialog({ open, onOpenChange, onCloseAutoFocus, loader }: SearchDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content
          className="fixed top-3 left-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-xl nav:top-[12vh] nav:max-h-[min(600px,76vh)]"
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <Dialog.Title className="sr-only">サイト内検索</Dialog.Title>
          <SearchPanel loader={loader} onClose={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Excerpt with <mark> hits; built from parsed text segments, never from raw HTML. */
function Excerpt({ html, className }: { html: string; className?: string }) {
  return (
    <span className={className}>
      {parseExcerpt(html).map((s, i) =>
        s.mark ? (
          <mark key={i} className="rounded-sm bg-accent-soft px-0.5 font-semibold text-accent-text">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

function SearchPanel({ loader, onClose }: { loader: () => Promise<PagefindApi>; onClose: () => void }) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const composing = useRef(false);
  const state = useSearch({ enabled: true, query, loader, basename: import.meta.env.BASE_URL, isUnavailable });
  const { options } = state;
  // The highlight belongs to one result list; a new list starts with nothing highlighted.
  const [active, setActive] = useState<{ list: SearchOption[]; index: number }>({ list: options, index: -1 });
  const activeIndex = active.list === options ? active.index : -1;
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  useEffect(() => {
    if (!activeOption) return;
    const el = document.getElementById(activeOption.id);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [activeOption]);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    // While an IME is composing (Japanese input), wait for compositionend before searching.
    const native = e.nativeEvent as InputEvent;
    if (!composing.current && !native.isComposing) setQuery(e.target.value);
  };
  const onCompositionEnd = (e: CompositionEvent<HTMLInputElement>) => {
    composing.current = false;
    setQuery(e.currentTarget.value);
  };

  const go = (option: SearchOption) => {
    onClose();
    void navigate(option.path);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter / arrows confirm IME candidates while composing; leave them to the IME.
    if (e.nativeEvent.isComposing || composing.current || e.keyCode === 229) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive({ list: options, index: wrapIndex(activeIndex, e.key === 'ArrowDown' ? 1 : -1, options.length) });
    } else if (e.key === 'Enter') {
      const target = activeOption ?? options[0];
      if (target) {
        e.preventDefault();
        go(target);
      }
    }
  };

  const listId = 'site-search-results';
  const showList = options.length > 0;
  let message: string | null = null;
  if (state.status === 'unavailable') message = DEV_INDEX_MESSAGE;
  else if (state.status === 'error') message = '検索中にエラーが発生しました。ページを再読み込みしてお試しください。';
  else if (state.status === 'idle') message = '記事のタイトルや本文をキーワードで検索できます。';
  else if (state.status === 'loading' && !showList) message = '検索しています…';
  else if (state.status === 'ready' && !showList) message = NO_RESULTS_MESSAGE;

  // Visible messages live inside the status region; the result count is announced for screen readers only.
  const count = state.status === 'ready' && state.total > 0 ? `${state.total}件の記事が見つかりました` : '';

  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b-2 border-border px-4 focus-within:border-accent">
        <Search className="size-5 shrink-0 text-subtle" aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          aria-label="検索キーワード"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeOption?.id}
          placeholder="キーワードを入力"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-subtle focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          value={input}
          onChange={onChange}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={onCompositionEnd}
          onKeyDown={onKeyDown}
        />
        <Dialog.Close className="shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] leading-5 text-muted hover:bg-surface-2 hover:text-fg">
          <span aria-hidden="true">Esc</span>
          <span className="sr-only">検索を閉じる</span>
        </Dialog.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div role="status" aria-live="polite">
          {message ? <p className="px-5 py-10 text-center text-sm leading-relaxed text-balance text-muted">{message}</p> : null}
          {count ? <p className="sr-only">{count}</p> : null}
        </div>
        <ul id={listId} role="listbox" aria-label="検索結果" className={cn('p-2', !showList && 'hidden')} aria-busy={state.status === 'loading'}>
          {options.map((o, i) => {
            const selected = i === activeIndex;
            const Icon = o.kind === 'page' ? FileText : Hash;
            return (
              <li key={o.id} role="presentation">
                <Link
                  id={o.id}
                  to={o.path}
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onClick={onClose}
                  onMouseMove={() => {
                    if (!selected) setActive({ list: options, index: i });
                  }}
                  className={cn(
                    'grid grid-cols-[16px_minmax(0,1fr)_14px] items-start gap-x-3 rounded-lg px-3 py-2.5 leading-normal text-fg no-underline',
                    o.kind === 'section' && 'ml-4 py-2 nav:ml-6',
                    selected && 'bg-accent-soft',
                  )}
                >
                  <Icon className={cn('mt-1 size-4', selected ? 'text-accent-text' : 'text-subtle')} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={cn(
                          'min-w-0 truncate',
                          o.kind === 'page' ? 'text-[15px] font-semibold' : 'text-sm font-medium',
                          selected && 'text-accent-text',
                        )}
                      >
                        {o.title}
                      </span>
                      {o.category ? <span className="shrink-0 text-xs whitespace-nowrap text-subtle">{o.category}</span> : null}
                    </span>
                    <Excerpt html={o.excerpt} className="mt-0.5 line-clamp-2 block text-[13px] text-muted" />
                  </span>
                  <CornerDownLeft className={cn('mt-1.5 size-3.5 text-accent-text', !selected && 'invisible')} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hidden shrink-0 items-center gap-4 border-t border-border bg-surface px-4 py-2 text-xs text-subtle nav:flex" aria-hidden="true">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> 移動
        </span>
        <span>
          <Kbd>Enter</Kbd> 開く
        </span>
        <span>
          <Kbd>Esc</Kbd> 閉じる
        </span>
      </div>
    </>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-border bg-bg px-1.5 py-px font-mono text-[11px] text-muted">{children}</kbd>;
}
