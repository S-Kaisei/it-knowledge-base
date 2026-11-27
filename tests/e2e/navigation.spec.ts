import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

test.describe('サイト基盤（fixture コンテンツ）', () => {
  test('トップ → カテゴリ → 記事へクライアント遷移できる', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/IT Knowledge Base/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ITの仕組みを、基礎から実践まで。');

    await page
      .getByRole('main')
      .getByRole('link', { name: /^IT基礎/ })
      .click();
    await expect(page).toHaveURL(/\/fundamentals\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IT基礎');

    await page
      .getByRole('main')
      .getByRole('link', { name: /テスト用記事（基礎）/ })
      .click();
    await expect(page).toHaveURL(/\/fundamentals\/fixture-basics\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('テスト用記事（基礎）');
    await expect(page).toHaveTitle('テスト用記事（基礎） | IT Knowledge Base');
    t.expectNone();
  });

  test('記事 URL への直接アクセスとリロードで本文が表示される', async ({ page }) => {
    const t = trackErrors(page);
    const res = await page.goto('/fundamentals/fixture-advanced/');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('テスト用記事（応用）');
    await page.reload();
    await expect(page.getByRole('heading', { name: '応用', level: 2 })).toBeVisible();
    t.expectNone();
  });

  test('JavaScript 実行前の HTML に本文が含まれる', async ({ request }) => {
    const html = await (await request.get('/fundamentals/fixture-basics/')).text();
    expect(html).toContain('キャッシュヒット率');
    expect(html).toContain('<h1');
  });

  test('前提記事・関連記事・前後の記事・出典が表示される', async ({ page }) => {
    await page.goto('/fundamentals/fixture-advanced/');
    const main = page.getByRole('main');
    await expect(main.getByText('前提：')).toBeVisible();
    await expect(page.getByRole('region', { name: '関連記事' }).getByRole('link', { name: /テスト用記事（基礎）/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '前後の記事' }).getByRole('link', { name: /前の記事/ })).toBeVisible();
    await expect(page.getByRole('region', { name: '参考資料・出典' }).getByRole('link', { name: 'RFC Editor' })).toHaveAttribute(
      'href',
      'https://www.rfc-editor.org/',
    );
  });

  test('サイドバーで現在の記事が示される', async ({ page }) => {
    await page.goto('/fundamentals/fixture-basics/');
    const nav = page.getByRole('navigation', { name: '記事ナビゲーション' });
    await expect(nav.getByRole('link', { name: 'テスト用記事（基礎）' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'テスト用記事（ネットワーク）' }).click();
    await expect(page).toHaveURL(/\/network\/fixture-network\/$/);
  });

  test('存在しない URL は 404 ステータスと 404 ページを返す', async ({ page }) => {
    const res = await page.goto('/no-such-page/');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ページが見つかりません');
    const res2 = await page.goto('/fundamentals/no-such-article/');
    expect(res2?.status()).toBe(404);
  });

  test('下書き記事は公開ビルドに含まれない', async ({ page, request }) => {
    const res = await request.get('/network/fixture-draft/');
    expect(res.status()).toBe(404);
    await page.goto('/network/');
    await expect(page.getByText('テスト用記事（下書き）')).toHaveCount(0);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('fixture-draft');
    expect(sitemap).toContain('/fundamentals/fixture-basics/');
  });

  test('テーマ切替が適用され、リロード後も保持される', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
    const toggle = page.getByRole('button', { name: /テーマ:/ });
    await toggle.click(); // system → light
    await toggle.click(); // light → dark
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: /テーマ: ダーク/ })).toBeVisible();
  });

  test('システムのダークモード設定に従う', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('キーボードで本文へスキップできる', async ({ page }) => {
    await page.goto('/fundamentals/fixture-basics/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: '本文へスキップ' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});
