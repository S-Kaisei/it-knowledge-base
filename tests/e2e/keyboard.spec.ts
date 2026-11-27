import { type Locator, type Page, expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const ARTICLE = '/fundamentals/fixture-basics/';

/** Presses Tab until `target` has focus (max `limit` presses); returns the number of presses. */
async function tabUntilFocused(page: Page, target: Locator, limit = 60): Promise<number> {
  for (let i = 1; i <= limit; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return i;
  }
  throw new Error(`Tab did not reach the target within ${limit} presses`);
}

test.describe('キーボード操作', () => {
  test('Tab 順で 検索 → テーマ → サイドバー → 目次 の順に到達できる', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto(ARTICLE);
    const search = page.getByRole('button', { name: 'サイト内検索を開く' });
    const theme = page.getByRole('button', { name: /^テーマ:/ });
    const sidebarLink = page.getByRole('navigation', { name: '記事ナビゲーション' }).getByRole('link').first();
    const tocLink = page.getByRole('navigation', { name: 'この記事の目次' }).getByRole('link').first();

    const order = [await tabUntilFocused(page, search)];
    order.push(await tabUntilFocused(page, theme));
    order.push(await tabUntilFocused(page, sidebarLink));
    order.push(await tabUntilFocused(page, tocLink));
    expect(order.every((n) => n > 0)).toBe(true);
    t.expectNone();
  });

  test('フォーカスされた要素には可視のフォーカスリングがある', async ({ page }) => {
    await page.goto(ARTICLE);
    const targets = [
      page.getByRole('button', { name: 'サイト内検索を開く' }),
      page.getByRole('button', { name: /^テーマ:/ }),
      page.getByRole('navigation', { name: '記事ナビゲーション' }).getByRole('link').first(),
      page.getByRole('navigation', { name: 'この記事の目次' }).getByRole('link').first(),
    ];
    for (const target of targets) {
      await tabUntilFocused(page, target);
      const outline = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), matches: el.matches(':focus-visible') };
      });
      expect(outline.matches).toBe(true);
      expect(outline.style).not.toBe('none');
      expect(outline.width).toBeGreaterThanOrEqual(2);
    }
  });

  test('Esc で検索ダイアログが閉じ、フォーカスがトリガーに戻る', async ({ page }) => {
    await page.goto(ARTICLE);
    const trigger = page.getByRole('button', { name: 'サイト内検索を開く' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: '検索キーワード' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('目次リンクで Enter を押すと見出しへ移動する', async ({ page }) => {
    await page.goto(ARTICLE);
    const toc = page.getByRole('navigation', { name: 'この記事の目次' });
    const links = toc.getByRole('link');
    const link = links.nth((await links.count()) - 1);
    const id = decodeURIComponent(((await link.getAttribute('href')) ?? '').replace(/^.*#/, ''));
    expect(id).not.toBe('');
    await tabUntilFocused(page, link);
    await page.keyboard.press('Enter');
    expect(decodeURIComponent(new URL(page.url()).hash)).toBe(`#${id}`);
    const heading = page.locator(`[id="${id}"]`);
    await expect(heading).toBeInViewport();
    // Keyboard navigation continues from the heading, not from the top of the page.
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});
