import { useEffect, type RefObject } from 'react';

/**
 * KaTeX display math is build-time HTML that scrolls horizontally when too wide. Keyboard users need
 * to be able to focus such a region to scroll it (WCAG 2.1.1, axe: scrollable-region-focusable),
 * so overflowing formulas get tabindex=0 + a group label; the attributes are removed when they fit.
 * `key` re-runs the effect when the article changes (the layout stays mounted across articles).
 */
export function useScrollableMath(ref: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const sync = (el: HTMLElement) => {
      if (el.scrollWidth > el.clientWidth + 1) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', '数式（横にスクロールできます）');
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
      }
    };
    const observer = new ResizeObserver((entries) => entries.forEach((e) => sync(e.target as HTMLElement)));
    root.querySelectorAll<HTMLElement>('.katex-display').forEach((el) => {
      sync(el);
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ref, key]);
}
