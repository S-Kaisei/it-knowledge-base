import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mdxComponents } from '~/components/article/mdx-components';
import { PastExam, PastExamAnswer } from '~/components/article/past-exam';

const SOURCE = '令和7年度 秋期 応用情報技術者試験 午前 問1';

function renderQuestion({ modified = false }: { modified?: boolean } = {}) {
  return render(
    <PastExam source={SOURCE} modified={modified}>
      <p>実効アクセス時間は何ナノ秒か。</p>
      <ul>
        <li>{'ア　10'}</li>
        <li>{'イ　15'}</li>
      </ul>
      <PastExamAnswer answer="イ">
        <p>0.9 × 10 + 0.1 × 60 = 15 です。</p>
      </PastExamAnswer>
    </PastExam>,
  );
}

describe('PastExam', () => {
  it('出典を「出典：…」の形で表示する', () => {
    renderQuestion();
    expect(screen.getByText(`出典：${SOURCE}`)).toBeVisible();
    expect(screen.queryByText(/一部改変/)).not.toBeInTheDocument();
  });

  it('modified のときは出典に「（一部改変）」を付ける', () => {
    renderQuestion({ modified: true });
    expect(screen.getByText(`出典：${SOURCE}（一部改変）`)).toBeVisible();
  });

  it('「過去問」ラベルを名前に持つグループで、問題文と選択肢を含む', () => {
    renderQuestion();
    // Without the build-time number (not rendered through MDX) the group is named by the label element.
    // The visible N is a CSS counter; 「過去問 1」「過去問 2」 via MDX are asserted by the unit pipeline test and E2E.
    const group = screen.getByRole('group', { name: '過去問' });
    const label = screen.getByText('過去問');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(label.id).not.toBe('');
    expect(within(group).getByText('実効アクセス時間は何ナノ秒か。')).toBeInTheDocument();
    expect(within(group).getAllByRole('listitem')).toHaveLength(2);
  });

  it('ビルド時に付いた番号があれば「過去問 N」をグループ名にする', () => {
    render(
      <PastExam source={SOURCE} number="3">
        <p>a</p>
      </PastExam>,
    );
    expect(screen.getByRole('group', { name: '過去問 3' })).toBeInTheDocument();
  });

  it('複数の過去問のラベル id は重複しない', () => {
    render(
      <>
        <PastExam source={SOURCE}>
          <p>a</p>
        </PastExam>
        <PastExam source="令和7年度 秋期 応用情報技術者試験 午前 問2">
          <p>b</p>
        </PastExam>
      </>,
    );
    const ids = screen.getAllByRole('group').map((g) => g.getAttribute('aria-labelledby'));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('PastExamAnswer', () => {
  it('既定では閉じていて、開くと正解と解説が見える', async () => {
    const user = userEvent.setup();
    renderQuestion();
    const details = screen.getByText('正解と解説').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('正解：', { exact: false })).not.toBeVisible();
    expect(screen.getByText('0.9 × 10 + 0.1 × 60 = 15 です。')).not.toBeVisible();

    await user.click(screen.getByText('正解と解説'));
    expect(details).toHaveAttribute('open');
    const correct = screen.getByText('正解：', { exact: false });
    expect(correct).toBeVisible();
    expect(correct).toHaveTextContent('正解：イ');
    expect(screen.getByText('0.9 × 10 + 0.1 × 60 = 15 です。')).toBeVisible();
  });
});

describe('MDX 登録', () => {
  it('PastExam / PastExamAnswer が MDX コンポーネントとして登録されている', () => {
    expect(mdxComponents.PastExam).toBe(PastExam);
    expect(mdxComponents.PastExamAnswer).toBe(PastExamAnswer);
  });
});
