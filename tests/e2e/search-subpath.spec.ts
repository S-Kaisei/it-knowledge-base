import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

// baseURL is http://127.0.0.1:4176/it-knowledge-base/ — use relative paths (no leading slash).
test.describe('全文検索（GitHub Pages サブパス /it-knowledge-base/）', () => {
  test('検索結果のリンクと遷移先にベースパスが付く', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('./');
    await page.getByRole('button', { name: 'サイト内検索を開く' }).click();
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    await dialog.getByRole('combobox', { name: '検索キーワード' }).fill('キャッシュヒット率');
    const option = dialog.getByRole('option', { name: /テスト用記事（基礎）/ }).first();
    await expect(option).toHaveAttribute('href', '/it-knowledge-base/fundamentals/fixture-basics/');
    const hrefs = await dialog.getByRole('option').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    for (const h of hrefs) {
      expect(h.startsWith('/it-knowledge-base/') && !h.startsWith('/it-knowledge-base/it-knowledge-base/'), h).toBe(true);
    }
    await option.click();
    await expect(page).toHaveURL(/\/it-knowledge-base\/fundamentals\/fixture-basics\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('テスト用記事（基礎）');
    t.expectNone();
  });

  test('キーボード操作で記事を開き、リロードしても表示される', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('fundamentals/fixture-advanced/');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    await expect(dialog.getByRole('combobox')).toBeFocused();
    await page.keyboard.type('名前解決');
    await expect(dialog.getByRole('option').first()).toContainText('テスト用記事（ネットワーク）');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/it-knowledge-base\/network\/fixture-network\/$/);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('テスト用記事（ネットワーク）');
    t.expectNone();
  });

  test('下書き記事の語は検索結果に出ない', async ({ page }) => {
    await page.goto('./');
    await page.keyboard.press('/');
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    await dialog.getByRole('combobox').fill('ドラフト専用キーワード');
    await expect(dialog.getByText('一致する記事が見つかりませんでした')).toBeVisible();
  });
});
