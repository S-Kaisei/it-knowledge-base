// IPA 情報処理技術者試験の過去問（<PastExam> / <PastExamAnswer>）の共通ルール。
// UI（src/components/article/past-exam.tsx）と content:check（scripts/lib/validate.mjs）の両方から使う。
// Node が型ストリップで直接 import するため、JSX・import・型ストリップできない TypeScript 構文を書かない。

/** 正解として使える記号。通常はア〜エ、選択肢が多い試験区分に備えてオ〜コも許可する。 */
export const PAST_EXAM_ANSWERS = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ'] as const;

export type PastExamAnswerChoice = (typeof PAST_EXAM_ANSWERS)[number];

/** 公開記事あたりの過去問の目標数（下回ると content:check が警告する）。 */
export const PAST_EXAM_TARGET = 10;

/**
 * 出典の形式：「{平成|令和}{元|N}年度 [期など] {試験区分}試験 [時間区分など] 問N」。
 * 期（春期・秋期・10月 など）と時間区分（午前・午前II・午後I・科目A など）は任意で、空白区切りなら何でもよい。
 * 例：「令和7年度 秋期 応用情報技術者試験 午前 問1」「令和元年度 秋期 情報処理安全確保支援士試験 午後I 問2」
 */
export const PAST_EXAM_SOURCE_RE = /^(?:平成|令和)(?:元|[1-9]\d*)年度\s+(?:\S+\s+)*\S+試験(?:\s+\S+)*\s+問[1-9]\d*$/;

export const PAST_EXAM_SOURCE_EXAMPLE = '令和7年度 秋期 応用情報技術者試験 午前 問1';

/** 空白の揺れ（全角空白・連続空白・前後の空白）をそろえる。重複判定と表示に使う。 */
export function normalizePastExamSource(source: string): string {
  return source.trim().replace(/\s+/g, ' ');
}

export function isValidPastExamSource(source: string): boolean {
  return PAST_EXAM_SOURCE_RE.test(normalizePastExamSource(source));
}

export function isPastExamAnswer(value: unknown): value is PastExamAnswerChoice {
  return typeof value === 'string' && (PAST_EXAM_ANSWERS as readonly string[]).includes(value);
}

/** 出典の表示文字列。改変した問題には「（一部改変）」を付ける（IPA の利用条件）。 */
export function formatPastExamSource(source: string, modified = false): string {
  return `出典：${normalizePastExamSource(source)}${modified ? '（一部改変）' : ''}`;
}
