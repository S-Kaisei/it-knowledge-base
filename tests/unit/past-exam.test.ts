import path from 'node:path';
import { evaluate } from '@mdx-js/mdx';
import { createElement } from 'react';
import * as runtime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../../scripts/lib/content.mjs';
import { mdxOptions } from '../../scripts/lib/mdx-options.mjs';
import { checkPastExams, validateContent } from '../../scripts/lib/validate.mjs';
import { PastExam, PastExamAnswer } from '~/components/article/past-exam';
import { PAST_EXAM_ANSWERS, formatPastExamSource, isPastExamAnswer, isValidPastExamSource, normalizePastExamSource } from '~/lib/past-exam';

const NOW = '2026-11-28';
const fixture = (name: string) => path.join(PROJECT_ROOT, 'tests', 'fixtures', 'content', name);
const check = (name: string) => validateContent({ dir: fixture(name), now: NOW });

const FM = '---\ntitle: x\n---\n\n';
const question = (source: string, answer = 'エ', attrs = '') =>
  `<PastExam source="${source}"${attrs}>\n問題文です。\n\n- ア\u3000a\n- イ\u3000b\n- ウ\u3000c\n- エ\u3000d\n\n<PastExamAnswer answer="${answer}">\n解説です。\n</PastExamAnswer>\n</PastExam>\n`;

describe('過去問の出典（src/lib/past-exam）', () => {
  it.each([
    '令和7年度 秋期 応用情報技術者試験 午前 問1',
    '令和元年度 秋期 情報処理安全確保支援士試験 午後I 問2',
    '平成31年度 春期 基本情報技術者試験 午前 問80',
    '令和2年度 10月 応用情報技術者試験 午前 問12',
    '令和6年度 春期 データベーススペシャリスト試験 午前II 問3',
    '令和7年度　秋期　応用情報技術者試験　午前　問1', // full-width spaces
  ])('正しい形式: %s', (source) => {
    expect(isValidPastExamSource(source)).toBe(true);
  });

  it.each([
    '',
    'R7 秋 AP 午前 問1',
    '令和7年度 秋期 応用情報技術者試験 午前', // no question number
    '応用情報技術者試験 令和7年度 問1', // year not first
    '昭和60年度 春期 情報処理技術者試験 問1', // era
    '令和7年度 試験 問1', // no exam name
    '令和7年度 秋期 応用情報技術者 午前 問1', // no 試験
    '令和7年度秋期応用情報技術者試験午前問1', // no separators
    '令和7年度 秋期 応用情報技術者試験 午前 問0',
  ])('不正な形式: %s', (source) => {
    expect(isValidPastExamSource(source)).toBe(false);
  });

  it('空白の揺れをそろえ、改変時は「（一部改変）」を付ける', () => {
    expect(normalizePastExamSource('  令和7年度　秋期  応用情報技術者試験 午前 問1 ')).toBe('令和7年度 秋期 応用情報技術者試験 午前 問1');
    expect(formatPastExamSource('令和7年度 秋期 応用情報技術者試験 午前 問1')).toBe('出典：令和7年度 秋期 応用情報技術者試験 午前 問1');
    expect(formatPastExamSource('令和7年度 秋期 応用情報技術者試験 午前 問1', true)).toBe('出典：令和7年度 秋期 応用情報技術者試験 午前 問1（一部改変）');
  });

  it('正解はア〜コのみ', () => {
    expect(PAST_EXAM_ANSWERS).toHaveLength(10);
    for (const a of ['ア', 'エ', 'オ', 'コ']) expect(isPastExamAnswer(a)).toBe(true);
    for (const a of ['サ', 'a', '1', '', undefined, true]) expect(isPastExamAnswer(a)).toBe(false);
  });
});

describe('checkPastExams（MDX の構文木で検査）', () => {
  it('正しい過去問は問題なしで数だけ返す（数式・表・改変ありを含む）', () => {
    const body =
      question('令和7年度 秋期 応用情報技術者試験 午前 問1') +
      '\n' +
      question('令和7年度 秋期 応用情報技術者試験 午前 問2', 'コ', ' modified') +
      '\n<PastExam source="令和7年度 春期 応用情報技術者試験 午前 問3">\n$x^{2}$ を含む。\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n<PastExamAnswer answer="ア">\n$\\frac{1}{2}$\n</PastExamAnswer>\n</PastExam>\n';
    expect(checkPastExams(FM + body)).toEqual({ count: 3, problems: [] });
  });

  it('過去問がない記事は 0 問', () => {
    expect(checkPastExams(`${FM}## 見出し\n\n本文です。\n`)).toEqual({ count: 0, problems: [] });
  });

  it('source がない・式で書かれている場合はエラー（行番号はファイルの行）', () => {
    const src = `${FM}<PastExam>\nx\n\n<PastExamAnswer answer="ア">y</PastExamAnswer>\n</PastExam>\n\n<PastExam source={"令和7年度 秋期 応用情報技術者試験 午前 問1"}>\n<PastExamAnswer answer="ア">y</PastExamAnswer>\n</PastExam>\n`;
    const { problems } = checkPastExams(src);
    expect(problems).toEqual([
      { line: 5, message: expect.stringContaining('source（出典）がありません') },
      { line: 11, message: expect.stringContaining('文字列リテラル') },
    ]);
  });

  it('入れ子の過去問の正解は内側の過去問だけに数える', () => {
    const inner = question('令和7年度 秋期 応用情報技術者試験 午前 問2');
    const src = `${FM}<PastExam source="令和7年度 秋期 応用情報技術者試験 午前 問1">\n${inner}\n</PastExam>\n`;
    const { count, problems } = checkPastExams(src);
    expect(count).toBe(2);
    expect(problems).toEqual([{ line: 5, message: expect.stringContaining('ちょうど 1 つ必要です（0 個あります）') }]);
  });

  it('answer の欠落はエラー', () => {
    const src = `${FM}<PastExam source="令和7年度 秋期 応用情報技術者試験 午前 問1">\n<PastExamAnswer>y</PastExamAnswer>\n</PastExam>\n`;
    expect(checkPastExams(src).problems).toEqual([{ line: 6, message: expect.stringContaining('answer が不正です（なし）') }]);
  });
});

describe('content:check の過去問ルール（fixture）', () => {
  it('正常系：エラーなし。公開記事で 10 問未満なら警告し、下書きは警告しない', async () => {
    const { errors, warnings } = await check('valid');
    expect(errors).toEqual([]);
    const pastExam = warnings.filter((w) => w.message.startsWith('過去問が'));
    expect(pastExam).toContainEqual({ file: 'fundamentals/fixture-basics.mdx', message: '過去問が 2 問です（目標 10 問）' });
    expect(pastExam).toContainEqual({ file: 'network/fixture-network.mdx', message: '過去問が 0 問です（目標 10 問）' });
    expect(pastExam.some((w) => w.file === 'network/fixture-draft.mdx')).toBe(false);
  }, 60_000);

  it('出典の欠落・形式不正・重複を行番号つきで検出する', async () => {
    const { errors } = await check('invalid/past-exam-source');
    const file = 'fundamentals/past-exam-source.mdx';
    expect(errors).toEqual([
      { file, line: 22, message: expect.stringContaining('source（出典）がありません') },
      { file, line: 30, message: expect.stringContaining('source の形式が不正です: 「R7 秋 AP 午前 問1」') },
      { file, line: 46, message: expect.stringContaining('同じ出典の過去問が重複しています: 「令和7年度 秋期 応用情報技術者試験 午前 問2」（38 行目と同じ）') },
    ]);
  }, 60_000);

  it('正解ブロックの数・不正な answer・過去問の外の正解ブロックを検出する', async () => {
    const { errors } = await check('invalid/past-exam-answer');
    const file = 'fundamentals/past-exam-answer.mdx';
    expect(errors).toEqual([
      { file, line: 22, message: expect.stringContaining('ちょうど 1 つ必要です（0 個あります）') },
      { file, line: 26, message: expect.stringContaining('ちょうど 1 つ必要です（2 個あります）') },
      { file, line: 41, message: expect.stringContaining('answer が不正です（「サ」）') },
      { file, line: 46, message: expect.stringContaining('<PastExamAnswer> が <PastExam> の外にあります') },
    ]);
  }, 60_000);
});

describe('MDX パイプラインでの描画（prerender 相当）', () => {
  async function renderMdx(source: string) {
    const { providerImportSource: _ignored, ...options } = mdxOptions();
    const { default: Content } = await evaluate(source, { ...options, ...runtime, baseUrl: import.meta.url });
    return renderToStaticMarkup(createElement(Content, { components: { PastExam, PastExamAnswer } }));
  }

  it('出現順に「過去問 N」の名前を付け、選択肢リストは本文直下、正解は閉じた details に入る', async () => {
    const html = await renderMdx(
      `${question('令和7年度 秋期 応用情報技術者試験 午前 問1')}\n${question('令和7年度 秋期 応用情報技術者試験 午前 問2', 'ア', ' modified number="99"')}`,
    );
    // Author-written `number` is ignored; numbering always follows document order.
    expect(html.match(/role="group" aria-label="過去問 \d+"/g)).toEqual(['role="group" aria-label="過去問 1"', 'role="group" aria-label="過去問 2"']);
    expect(html).toContain('出典：令和7年度 秋期 応用情報技術者試験 午前 問1</p>');
    expect(html).toContain('出典：令和7年度 秋期 応用情報技術者試験 午前 問2（一部改変）</p>');
    expect(html).toMatch(/<div class="past-exam-body"><p>問題文です。<\/p>\s*<ul>/);
    expect(html).toContain('<details class="past-exam-answer"><summary>正解と解説</summary>');
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('正解：<strong>エ</strong>');
  });
});
