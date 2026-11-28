import fs from 'node:fs';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { hasHorizontalOverflow, trackErrors } from './helpers';

const ARTICLE = '/fundamentals/fixture-basics/';
const SCREENSHOT_DIR = path.join('test-results', 'screenshots');

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Waits until every Mermaid diagram has finished (rendered or failed). */
async function waitForDiagrams(page: Page) {
  await expect(page.locator('[data-mermaid="pending"]')).toHaveCount(0);
}

test.describe('記事の表示機能（fixture）', () => {
  test('Mermaid が SVG として描画され、描画エラーがない', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto(ARTICLE);
    const figure = page.locator('[data-mermaid]').first();
    await expect(figure.locator('svg')).toBeVisible();
    await expect(figure.getByRole('img')).toBeVisible();
    await expect(figure.locator('svg')).toContainText('Cache');
    await expect(page.locator('[data-mermaid-error]')).toHaveCount(0);
    await expect(page.locator('[data-mermaid-source]')).toHaveCount(0);
    t.expectNone();
  });

  test('JavaScript 実行前の HTML には Mermaid のソースが含まれる', async ({ request }) => {
    const html = await (await request.get(ARTICLE)).text();
    expect(html).toContain('data-mermaid-source');
    expect(html).toContain('CPU --&gt; Cache --&gt; Memory');
  });

  test('テーマを切り替えると Mermaid が再描画される', async ({ page }) => {
    const t = trackErrors(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ARTICLE);
    const svg = page.locator('[data-mermaid] svg').first();
    await expect(svg).toBeVisible();
    const lightId = await svg.getAttribute('id');
    await setTheme(page, 'dark');
    await expect(svg).not.toHaveAttribute('id', lightId ?? '');
    await expect(svg).toBeVisible();
    await expect(page.locator('[data-mermaid-error]')).toHaveCount(0);
    t.expectNone();
  });

  test('KaTeX の数式が描画され、長い数式でもページが横にはみ出さない', async ({ page }) => {
    await page.goto(ARTICLE);
    await expect(page.locator('.katex').first()).toBeVisible();
    const displays = page.locator('.katex-display');
    await expect(displays).toHaveCount(2);
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await hasHorizontalOverflow(page)).toBe(false);
    // The long formula scrolls inside its own container instead.
    const scrolls = await displays.nth(1).evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(true);
  });

  test('コードブロックはハイライトされ、ファイル名ヘッダーとコピーボタンを持つ', async ({ page, context }) => {
    const t = trackErrors(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(ARTICLE);
    const block = page.locator('.code-block').filter({ hasText: 'example.ts' });
    await expect(block.locator('.code-block-title')).toHaveText('example.ts');
    await expect(block.locator('.code-block-lang')).toHaveText('TypeScript');
    expect(await block.locator('pre.shiki span[style*="--shiki-light"]').count()).toBeGreaterThan(3);

    const button = block.getByRole('button', { name: 'コードをコピー' });
    await button.click();
    await expect(block.getByRole('button', { name: 'コピーしました' })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('export function add(a: number, b: number): number {');
    expect(copied).not.toContain('コピー');
    await expect(block.getByRole('button', { name: 'コードをコピー' })).toBeVisible();

    // Keyboard: the copy button is reachable and works with Enter.
    await block.getByRole('button', { name: 'コードをコピー' }).focus();
    await page.keyboard.press('Enter');
    await expect(block.getByRole('button', { name: 'コピーしました' })).toBeVisible();
    t.expectNone();
  });

  test('ダークモードでコードの配色が切り替わる', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ARTICLE);
    const token = page.locator('.code-block pre.shiki span[style*="--shiki-light"]').filter({ hasText: 'export' }).first();
    await expect(token).toBeVisible();
    const light = await token.evaluate((el) => getComputedStyle(el).color);
    await setTheme(page, 'dark');
    const dark = await token.evaluate((el) => getComputedStyle(el).color);
    expect(dark).not.toBe(light);
    const expected = await token.evaluate((el) => el.style.getPropertyValue('--shiki-dark'));
    const probe = await page.evaluate((c) => {
      const s = document.createElement('span');
      s.style.color = c;
      document.body.append(s);
      const v = getComputedStyle(s).color;
      s.remove();
      return v;
    }, expected);
    expect(dark).toBe(probe);
  });

  test('コールアウトはアイコンとラベル文字で種類を示す', async ({ page }) => {
    await page.goto(ARTICLE);
    for (const label of ['補足', '注意：キャッシュの無効化', 'ポイント']) {
      const note = page.getByRole('note', { name: label });
      await expect(note).toBeVisible();
      await expect(note.locator('.callout-label')).toHaveText(label.split('：')[0] ?? label);
    }
  });

  test('Figure はキャプション付きで表示される', async ({ page }) => {
    await page.goto(ARTICLE);
    const figure = page.getByRole('figure', { name: /図1: 記憶階層の模式図/ });
    await expect(figure).toBeVisible();
    await expect(figure.getByRole('img', { name: /レジスタ、キャッシュ、メモリ/ })).toBeVisible();
  });

  test('見出しのアンカーリンクで見出しへ移動できる', async ({ page }) => {
    await page.goto(ARTICLE);
    const heading = page.getByRole('heading', { level: 2, name: /^数式/ });
    const anchor = heading.getByRole('link', { name: 'この見出しへのリンク' });
    await anchor.focus();
    await expect(anchor).toBeVisible();
    await anchor.click();
    await expect(page).toHaveURL(new RegExp(`#${encodeURIComponent('数式')}$`));
    const top = await heading.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(200);
  });

  test('過去問は「過去問 N」の名前・出典・行頭記号なしの選択肢で表示され、正解は開くまで隠れている', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto(ARTICLE);
    // N comes from a CSS counter in document order; the group's accessible name includes it.
    const first = page.getByRole('group', { name: '過去問 1' });
    const second = page.getByRole('group', { name: '過去問 2' });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(first.getByText('出典：令和7年度 秋期 応用情報技術者試験 午前 問1', { exact: true })).toBeVisible();
    await expect(second.getByText('出典：平成31年度 春期 基本情報技術者試験 午前 問2（一部改変）', { exact: true })).toBeVisible();
    // Markdown (table, inline KaTeX) works inside the question.
    await expect(first.locator('.katex').first()).toBeVisible();
    await expect(first.getByRole('region', { name: '表' })).toBeVisible();

    const choices = first.locator('.past-exam-body > ul');
    await expect(choices.getByRole('listitem')).toHaveCount(4);
    expect(await choices.evaluate((el) => getComputedStyle(el).listStyleType)).toBe('none');

    // The answer is closed by default and opens with the summary (also from the keyboard).
    const correct = first.getByText('正解：イ');
    await expect(correct).toBeHidden();
    await first.getByText('正解と解説').click();
    await expect(correct).toBeVisible();
    await expect(first.locator('details')).toHaveAttribute('open', '');

    const secondCorrect = second.getByText('正解：ウ');
    await expect(secondCorrect).toBeHidden();
    await second.getByText('正解と解説').focus();
    await page.keyboard.press('Enter');
    await expect(secondCorrect).toBeVisible();
    t.expectNone();
  });

  test('狭い画面でも過去問がページを横にはみ出さない', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(ARTICLE);
    const exam = page.getByRole('group', { name: '過去問 1' });
    await exam.getByText('正解と解説').click();
    await expect(exam.getByText('正解：イ')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('記事ページでコンソールエラーが出ない', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto(ARTICLE);
    await waitForDiagrams(page);
    await page.reload();
    await waitForDiagrams(page);
    t.expectNone();
  });

  test('狭い画面でも Mermaid の文字が縮みすぎず、図の枠内で横スクロールする', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(ARTICLE);
    const box = page.locator('.mermaid-svg').first();
    await expect(box.locator('svg')).toBeVisible();
    const { rendered, natural } = await box.evaluate((el) => {
      const svg = el.querySelector('svg');
      return { rendered: svg?.getBoundingClientRect().width ?? 0, natural: svg?.viewBox.baseVal.width ?? 0 };
    });
    expect(natural).toBeGreaterThan(0);
    expect(rendered).toBeGreaterThanOrEqual(natural * 0.8 - 1);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('代表画面のスクリーンショット（ライト / ダーク × デスクトップ / モバイル）', async ({ page }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    for (const [device, viewport] of [
      ['desktop', { width: 1440, height: 900 }],
      ['mobile', { width: 390, height: 844 }],
    ] as const) {
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(ARTICLE);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await waitForDiagrams(page);
        await expect(page.locator('[data-mermaid] svg').first()).toBeVisible();
        expect(await hasHorizontalOverflow(page)).toBe(false);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `article-${theme}-${device}.png`), fullPage: true });
      }
    }
  });
});
