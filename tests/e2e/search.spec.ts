import { type Page, expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

// Full-text search against the real Pagefind index of the fixture build (root base "/").
async function openSearch(page: Page) {
  await page.getByRole('button', { name: 'サイト内検索を開く' }).click();
  const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('全文検索（Pagefind）', () => {
  test('日本語の固有語で記事が見つかり、結果から遷移できる', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/');
    const dialog = await openSearch(page);
    await dialog.getByRole('combobox', { name: '検索キーワード' }).fill('キャッシュヒット率');
    const option = dialog.getByRole('option', { name: /テスト用記事（基礎）/ }).first();
    await expect(option).toBeVisible();
    // Title comes from the article h1 (not the <title> suffix); category meta and <mark> highlight are shown.
    await expect(option).not.toContainText('IT Knowledge Base');
    await expect(option).toContainText('IT基礎');
    await expect(option.locator('mark').first()).toHaveText(/キャッシュヒット率/);
    await expect(dialog.getByRole('status')).toContainText(/\d+件の記事が見つかりました/);
    await option.click();
    await expect(page).toHaveURL(/\/fundamentals\/fixture-basics\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('テスト用記事（基礎）');
    await expect(dialog).toBeHidden();
    t.expectNone();
  });

  test('文中の日本語の語（名前解決）で別カテゴリの記事が見つかる', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/fundamentals/fixture-basics/');
    const dialog = await openSearch(page);
    await dialog.getByRole('combobox').fill('名前解決');
    const option = dialog.getByRole('option', { name: /テスト用記事（ネットワーク）/ }).first();
    await expect(option).toBeVisible();
    await expect(option).toContainText('ネットワーク');
    await option.click();
    await expect(page).toHaveURL(/\/network\/fixture-network\/$/);
    t.expectNone();
  });

  test('下書き記事の語は検索結果に出ない', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/');
    const dialog = await openSearch(page);
    await dialog.getByRole('combobox').fill('ドラフト専用キーワード');
    await expect(dialog.getByText('一致する記事が見つかりませんでした')).toBeVisible();
    await expect(dialog.getByRole('option')).toHaveCount(0);
    t.expectNone();
  });

  test('キーボードだけで検索して記事を開ける（Ctrl+K → 入力 → ↓ → Enter）', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/network/fixture-network/');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    const input = dialog.getByRole('combobox', { name: '検索キーワード' });
    await expect(input).toBeFocused();
    await page.keyboard.type('キャッシュヒット率');
    const first = dialog.getByRole('option').first();
    await expect(first).toContainText('テスト用記事（基礎）');
    await page.keyboard.press('ArrowDown');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id')) ?? '');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/fundamentals\/fixture-basics\/$/);
    await expect(dialog).toBeHidden();
    t.expectNone();
  });

  test('見出し単位の結果からアンカー付きで移動できる', async ({ page }) => {
    await page.goto('/');
    const dialog = await openSearch(page);
    await dialog.getByRole('combobox').fill('キャッシュヒット率');
    const section = dialog.getByRole('option', { name: /^概要/ }).first();
    await expect(section).toHaveAttribute('href', /\/fundamentals\/fixture-basics\/#/);
    await section.click();
    await expect(page).toHaveURL(/\/fundamentals\/fixture-basics\/#/);
    await expect(page.getByRole('heading', { name: '概要', level: 2 })).toBeInViewport();
  });

  test('「/」で開き、Esc で閉じるとフォーカスが戻る', async ({ page }) => {
    await page.goto('/fundamentals/fixture-basics/');
    const trigger = page.getByRole('button', { name: 'サイト内検索を開く' });
    await trigger.focus();
    await page.keyboard.press('/');
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    await expect(dialog.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('トップのヒーロー検索から同じダイアログが開く', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/');
    await page.getByRole('main').getByRole('button', { name: 'キーワードで検索（例: DNS 名前解決）' }).click();
    const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
    await expect(dialog.getByRole('combobox')).toBeFocused();
    await dialog.getByRole('combobox').fill('名前解決');
    await expect(dialog.getByRole('option', { name: /テスト用記事（ネットワーク）/ }).first()).toBeVisible();
    t.expectNone();
  });

  test('記事本文以外（フッター・サイト名など）は索引に含まれない', async ({ page }) => {
    await page.goto('/');
    const dialog = await openSearch(page);
    // Both appear on every article page (site name in header/footer, updated date label), but only outside the indexed body.
    for (const q of ['Knowledge', '最終更新']) {
      await dialog.getByRole('combobox').fill(q);
      await expect(dialog.getByText('一致する記事が見つかりませんでした')).toBeVisible();
    }
  });
});
