import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { SidebarNav } from './sidebar-nav';

/**
 * Drawer navigation for narrow screens (≤900px). Radix Dialog handles focus trap, Esc and focus return.
 * Link clicks inside the drawer close it via SidebarNav's onNavigate.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg nav:hidden"
          aria-label="ナビゲーションを開く"
        >
          <Menu className="size-[18px]" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content
          className="fixed top-0 bottom-0 left-0 z-50 flex w-[min(300px,85vw)] flex-col border-r border-border bg-bg shadow-xl"
          aria-describedby={undefined}
        >
          <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-border pr-2 pl-4">
            <Dialog.Title className="text-sm font-semibold">ナビゲーション</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="ナビゲーションを閉じる"
              >
                <X className="size-[18px]" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-3 py-5">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
