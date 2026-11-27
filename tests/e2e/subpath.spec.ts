import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

// baseURL is http://127.0.0.1:4176/it-knowledge-base/ — use relative paths (no leading slash).
test.describe('GitHub Pages サブパス配信（/it-knowledge-base/）', () => {
  test('トップページとアセットがサブパスで読み込まれる', async ({ page }) => {
    const t = trackErrors(page);
    const res = await page.goto('./');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ITの仕組みを、基礎から実践まで。');
    t.expectNone();
  });

  test('記事への直接アクセス・クライアント遷移・リロード', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('fundamentals/fixture-basics/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('テスト用記事（基礎）');
    await page.getByRole('main').getByRole('link', { name: '応用編' }).click();
    await expect(page).toHaveURL(/\/it-knowledge-base\/fundamentals\/fixture-advanced\/$/);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('テスト用記事（応用）');
    t.expectNone();
  });

  test('内部リンクはすべてベースパス付き', async ({ page }) => {
    await page.goto('fundamentals/fixture-basics/');
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h.startsWith('/it-knowledge-base/'), h).toBe(true);
  });

  test('存在しない URL は 404', async ({ page }) => {
    const res = await page.goto('no-such-page/');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ページが見つかりません');
  });
});
