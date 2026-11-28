import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

// WCAG 2.x A/AA automated audit (axe-core) of representative pages in both color schemes.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

// Third-party rendering artifacts excluded from the audit (none at the moment; add the specific
// selector here with a comment explaining why if axe flags library-generated internals).
const EXCLUDE: string[] = [];

async function audit(page: Page) {
  // Wait for client-side Mermaid rendering so the final DOM is audited.
  await expect(page.locator('[data-mermaid="pending"]')).toHaveCount(0);
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const selector of EXCLUDE) builder = builder.exclude(selector);
  const { violations } = await builder.analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `  ${n.target.join(' ')} :: ${n.failureSummary?.split('\n').slice(0, 3).join(' ')}`).join('\n')}`,
  );
  expect(violations, summary.join('\n')).toEqual([]);
}

const PAGES: Array<{ name: string; path: string }> = [
  { name: 'ホーム', path: '/' },
  { name: 'カテゴリページ', path: '/fundamentals/' },
  { name: '記事（Mermaid / KaTeX / コード）', path: '/fundamentals/fixture-basics/' },
  { name: '記事（シミュレーター）', path: '/fundamentals/fixture-simulator/' },
  { name: '404', path: '/no-such-page/' },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`アクセシビリティ（axe, ${scheme}）`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    for (const { name, path } of PAGES) {
      test(`${name} に WCAG 違反がない`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await audit(page);
      });
    }

    test('検索ダイアログを開いた状態に WCAG 違反がない', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'サイト内検索を開く' }).click();
      const dialog = page.getByRole('dialog', { name: 'サイト内検索' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('combobox', { name: '検索キーワード' }).fill('キャッシュ');
      await expect(dialog.getByRole('option').first()).toBeVisible();
      await audit(page);
    });

    test('過去問の正解と解説を開いた状態に WCAG 違反がない', async ({ page }) => {
      await page.goto('/fundamentals/fixture-basics/');
      for (const summary of await page.locator('.past-exam-answer > summary').all()) await summary.click();
      await expect(page.getByRole('group', { name: '過去問 1' }).getByText('正解：イ')).toBeVisible();
      await expect(page.getByRole('group', { name: '過去問 2' }).getByText('正解：ウ')).toBeVisible();
      await audit(page);
    });

    test.describe('モバイル幅', () => {
      test.use({ viewport: { width: 375, height: 800 } });

      test('ドロワーを開いた状態に WCAG 違反がない', async ({ page }) => {
        await page.goto('/fundamentals/fixture-basics/');
        await page.getByRole('button', { name: 'ナビゲーションを開く' }).click();
        await expect(page.getByRole('dialog', { name: 'ナビゲーション' })).toBeVisible();
        await audit(page);
      });
    });
  });
}
