import { type ReactNode, useId } from 'react';
import { type PastExamAnswerChoice, formatPastExamSource } from '~/lib/past-exam';

export type PastExamProps = {
  /** 例：「令和7年度 秋期 応用情報技術者試験 午前 問1」（形式は content:check が検証する） */
  source: string;
  /** 問題文・選択肢を改変した場合に指定する。出典に「（一部改変）」を付ける。 */
  modified?: boolean;
  /**
   * 記事内の通し番号。記事では書かず、ビルド時に remarkPastExamNumbers（scripts/lib/mdx-options.mjs）が
   * 出現順に付ける。MDX の属性値なので文字列で渡ってくる。
   */
  number?: number | string;
  children?: ReactNode;
};

/**
 * IPA 情報処理技術者試験の過去問 1 問。
 * 表示上の「過去問 N」の N は CSS counter（app.css の past-exam）で出現順に採番する。
 * CSS の生成コンテンツはアクセシブルネームに確実には入らないため、グループ名はビルド時に付いた
 * number から aria-label で「過去問 N」とする（同じ出現順なので表示と一致する）。
 * number がない場合（MDX 以外から使った場合）はラベル要素を aria-labelledby で参照する。
 */
export function PastExam({ source, modified = false, number, children }: PastExamProps) {
  const labelId = useId();
  const hasNumber = number !== undefined && String(number).trim() !== '';
  const nameProps = hasNumber ? { 'aria-label': `過去問 ${String(number).trim()}` } : { 'aria-labelledby': labelId };
  return (
    <div className="past-exam" role="group" {...nameProps}>
      <div className="past-exam-header">
        <p className="past-exam-label" id={labelId}>
          過去問
        </p>
        <p className="past-exam-source">{formatPastExamSource(source, modified)}</p>
      </div>
      <div className="past-exam-body">{children}</div>
    </div>
  );
}

export type PastExamAnswerProps = {
  answer: PastExamAnswerChoice;
  children?: ReactNode;
};

/** 正解と解説。既定は閉じた <details>（JS なしでも開閉できる）。 */
export function PastExamAnswer({ answer, children }: PastExamAnswerProps) {
  return (
    <details className="past-exam-answer">
      <summary>正解と解説</summary>
      <div className="past-exam-answer-body">
        <p className="past-exam-correct">
          正解：<strong>{answer}</strong>
        </p>
        {children}
      </div>
    </details>
  );
}
