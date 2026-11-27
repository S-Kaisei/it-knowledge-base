import { expect, test } from '@playwright/test';
import { hasHorizontalOverflow, trackErrors } from './helpers';

const PATH = '/fundamentals/fixture-simulator/';

test.describe('実効アクセス時間シミュレーター', () => {
  test('prerender 済み HTML に既定の結果が含まれる', async ({ request }) => {
    const html = await (await request.get(PATH)).text();
    expect(html).toContain('実効アクセス時間シミュレーター');
    expect(html).toContain('19.0');
  });

  test('ヒット率スライダーをキーボードで操作すると結果が変わる', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto(PATH);
    const sim = page.getByRole('region', { name: '実効アクセス時間シミュレーター' });
    const live = sim.locator('[aria-live="polite"]');
    await expect(live).toContainText('19.0');

    const hit = sim.getByRole('slider', { name: 'ヒット率 h' });
    await hit.focus();
    await expect(hit).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(hit).toHaveValue('89');
    // 0.89×10 + 0.11×100 = 19.9
    await expect(live).toContainText('19.9');
    await expect(live).toContainText('0.89×10 + 0.11×100');
    await expect(sim.locator('output').first()).toHaveText('89%');
    t.expectNone();
  });

  test('モバイル幅で横スクロールしない', async ({ page }) => {
    const t = trackErrors(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(PATH);
    const sim = page.getByRole('region', { name: '実効アクセス時間シミュレーター' });
    await expect(sim).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    // The box itself must fit (body has overflow-x: hidden, which could mask a wide child).
    const fits = await sim.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return el.scrollWidth <= el.clientWidth + 1 && box.right <= document.documentElement.clientWidth + 1;
    });
    expect(fits).toBe(true);
    t.expectNone();
  });
});
