import { expect, test } from '@playwright/test';
import { hasHorizontalOverflow, trackErrors } from './helpers';

test.describe('モバイル表示', () => {
  test('ドロワーナビゲーションを開閉できる（Esc で閉じてフォーカスが戻る）', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/fundamentals/fixture-basics/');
    const open = page.getByRole('button', { name: 'ナビゲーションを開く' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'ナビゲーション' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    t.expectNone();
  });

  test('ドロワーから記事へ遷移するとドロワーが閉じる', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'ナビゲーションを開く' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'テスト用記事（ネットワーク）' }).click();
    await expect(page).toHaveURL(/\/network\/fixture-network\/$/);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('ページ全体が横スクロールしない', async ({ page }) => {
    for (const path of ['/', '/fundamentals/', '/fundamentals/fixture-basics/']) {
      await page.goto(path);
      expect(await hasHorizontalOverflow(page), path).toBe(false);
    }
  });

  test('記事内目次は折りたたまれて表示される', async ({ page }) => {
    await page.goto('/fundamentals/fixture-basics/');
    const summary = page.getByText('この記事の目次').first();
    await expect(summary).toBeVisible();
    await summary.click();
    await expect(page.getByRole('link', { name: '数式' }).first()).toBeVisible();
  });
});
