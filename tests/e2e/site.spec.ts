import { expect, test } from '@playwright/test';
import { hasHorizontalOverflow, trackErrors } from './helpers';

// Health check of the REAL site build (build/client): every URL in sitemap.xml renders without errors.
test('実サイトの全公開ページがエラーなく表示される', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  // <loc> values are absolute URLs built from SITE_URL (in CI: the GitHub Pages URL with /it-knowledge-base/),
  // while this build is served at "/". The first entry is the home page, so its path is the site's base.
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] ?? '/').pathname);
  expect(locs.length).toBeGreaterThan(0);
  const sitemapBase = locs[0] ?? '/';
  const paths = locs.map((p) => `/${p.slice(sitemapBase.length)}`);
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
  const t = trackErrors(page);
  const res = await page.goto('/this-page-does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId('not-found')).toHaveCount(1);
  await expect(page.getByTestId('not-found')).toBeVisible();
  // Hydration of 404.html at an unrelated URL must not raise errors (e.g. hydration mismatch).
  await page.waitForLoadState('networkidle');
  t.expectNone();
});
