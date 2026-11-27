import { expect, test } from '@playwright/test';
import { hasHorizontalOverflow, trackErrors } from './helpers';

// Health check of the REAL site build (build/client): every URL in sitemap.xml renders without errors.
test('実サイトの全公開ページがエラーなく表示される', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] ?? '/').pathname);
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) {
    const t = trackErrors(page);
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await hasHorizontalOverflow(page), `${path} overflows horizontally`).toBe(false);
    t.expectNone();
    page.removeAllListeners();
  }
});

test('実サイトの 404 ページ', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId('not-found')).toBeVisible();
});
