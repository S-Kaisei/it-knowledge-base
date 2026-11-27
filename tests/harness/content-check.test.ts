import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../../scripts/lib/content.mjs';
import { validateContent } from '../../scripts/lib/validate.mjs';

// H1 正常系 → 'valid' / H2 → bad-frontmatter, bad-date / H3 → broken-link / H4 → duplicate-slug / H5 → bad-math, bad-mermaid
// H6（draft 非公開）→ draft-link（ここ）+ tests/e2e/navigation.spec.ts（ルート・sitemap・検索）
// content:check against fixture content: the valid set passes, each invalid set is rejected with file + line.
const NOW = '2026-11-28';
const fixture = (name: string) => path.join(PROJECT_ROOT, 'tests', 'fixtures', 'content', name);
const check = (name: string) => validateContent({ dir: fixture(name), now: NOW });

describe('content:check（fixture）', () => {
  it('正常系の fixture はエラーなしで通過する', async () => {
    const { errors, stats } = await check('valid');
    expect(errors).toEqual([]);
    expect(stats.published).toBeGreaterThan(0);
  }, 60_000);

  it('未登録の MDX コンポーネントを検出する（実行時エラーになる前に止める）', async () => {
    const { errors } = await check('invalid/unknown-component');
    const unknown = errors.filter((e) => e.message.startsWith('未登録の MDX コンポーネント'));
    expect(unknown).toHaveLength(1);
    expect(unknown[0]).toMatchObject({ file: 'fundamentals/unknown-component.mdx', line: 22 });
    expect(unknown[0]?.message).toContain('<NotRegisteredWidget>');
  }, 60_000);

  it('Mermaid の構文エラーをファイルと行番号つきで検出する', async () => {
    const { errors } = await check('invalid/bad-mermaid');
    const mermaid = errors.filter((e) => e.message.startsWith('Mermaid の構文エラー'));
    // Only the broken diagram is reported (the valid sequenceDiagram passes).
    expect(mermaid).toHaveLength(1);
    expect(mermaid[0]).toMatchObject({ file: 'fundamentals/bad-mermaid.mdx', line: 34 });
  }, 60_000);

  it('KaTeX でレンダリングできない数式を検出する', async () => {
    const { errors } = await check('invalid/bad-math');
    const math = errors.filter((e) => e.file === 'fundamentals/bad-math.mdx' && e.message.startsWith('数式をレンダリングできません'));
    // Undefined command (rendered in red by the lenient site build) and a parse error, each with its line.
    expect(math.map((e) => e.line)).toEqual([24, 28]);
    expect(math[0]?.message).toContain('undefinedcommand');
  }, 60_000);

  it('内部リンク切れと存在しない画像を行番号つきで検出する', async () => {
    const { errors } = await check('invalid/broken-link');
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'fundamentals/broken-link.mdx', line: 22, message: expect.stringContaining('内部リンク切れ') }),
        expect.objectContaining({ file: 'fundamentals/broken-link.mdx', line: 24, message: expect.stringContaining('画像に代替テキストがありません') }),
        expect.objectContaining({ file: 'fundamentals/broken-link.mdx', line: 24, message: expect.stringContaining('画像が見つかりません') }),
      ]),
    );
  }, 60_000);

  it('slug の重複を検出する', async () => {
    const { errors } = await check('invalid/duplicate-slug');
    expect(errors.some((e) => e.message.includes('slug が重複しています: same-slug'))).toBe(true);
  }, 60_000);

  it('フロントマターの不備を検出する', async () => {
    const { errors } = await check('invalid/bad-frontmatter');
    const fm = errors.filter((e) => e.file === 'fundamentals/bad-frontmatter.mdx');
    expect(fm.some((e) => e.message.includes('description'))).toBe(true);
    expect(fm.some((e) => e.message.includes('difficulty'))).toBe(true);
  }, 60_000);

  it('不正な日付（存在しない日付・未来日）を検出する', async () => {
    const { errors } = await check('invalid/bad-date');
    const own = errors.filter((e) => e.file === 'fundamentals/bad-date.mdx');
    expect(own.length).toBeGreaterThanOrEqual(1);
    expect(own.some((e) => /lastUpdated|lastVerified|日付/.test(e.message))).toBe(true);
  }, 60_000);

  it('公開記事から下書き記事へのリンクと related を検出する', async () => {
    const { errors } = await check('invalid/draft-link');
    const own = errors.filter((e) => e.file === 'fundamentals/published.mdx');
    expect(own.some((e) => e.message.includes('公開記事から下書き記事へのリンクがあります'))).toBe(true);
    expect(own.some((e) => e.message.includes('下書き記事（draft-only）を参照しています'))).toBe(true);
    // The draft itself is not an error source.
    expect(errors.some((e) => e.file === 'fundamentals/draft-only.mdx')).toBe(false);
  }, 60_000);
});
