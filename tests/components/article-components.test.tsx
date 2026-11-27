import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Callout } from '~/components/article/callout';
import { CodeBlock, languageLabel } from '~/components/article/code-block';
import { Figure } from '~/components/article/figure';
import { mdxComponents } from '~/components/article/mdx-components';
import { Misconceptions } from '~/components/article/misconceptions';

describe('Callout', () => {
  it.each([
    ['note', '補足'],
    ['warn', '注意'],
    ['tip', 'ポイント'],
  ] as const)('%s は「%s」のラベル文字を表示する', (type, label) => {
    render(<Callout type={type}>本文</Callout>);
    const note = screen.getByRole('note', { name: label });
    expect(within(note).getByText(label)).toBeVisible();
    expect(within(note).getByText('本文')).toBeInTheDocument();
    // The icon is decorative; the meaning is carried by the text label.
    expect(note.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('タイトルを表示し、アクセシブルネームに含める', () => {
    render(
      <Callout type="warn" title="キャッシュの無効化">
        本文
      </Callout>,
    );
    expect(screen.getByRole('note', { name: '注意：キャッシュの無効化' })).toBeInTheDocument();
    expect(screen.getByText('キャッシュの無効化')).toBeVisible();
  });

  it('type 省略時は補足になる', () => {
    render(<Callout>x</Callout>);
    expect(screen.getByRole('note', { name: '補足' })).toBeInTheDocument();
  });
});

describe('Figure', () => {
  it('children とキャプションを figure / figcaption で描画する', () => {
    render(
      <Figure caption="図1: 説明">
        <svg role="img" aria-label="模式図" />
      </Figure>,
    );
    // jsdom does not derive the figure's name from <figcaption> (browsers do; covered by E2E).
    const figure = screen.getByRole('figure');
    expect(figure.querySelector('figcaption')).toHaveTextContent('図1: 説明');
    expect(within(figure).getByRole('img', { name: '模式図' })).toBeInTheDocument();
  });

  it('src と alt から画像を描画する', () => {
    render(<Figure src="/images/x/a.svg" alt="構成図" caption="図2" />);
    expect(screen.getByRole('img', { name: '構成図' })).toHaveAttribute('src', '/images/x/a.svg');
  });
});

describe('CodeBlock / CopyButton', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  function renderBlock() {
    return render(
      <CodeBlock data-language="ts" data-title="example.ts" className="shiki" tabIndex={0}>
        <code>
          <span>const</span> x = 1;
        </code>
      </CodeBlock>,
    );
  }

  function mockClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  }

  it('ファイル名と言語ラベルを表示する', () => {
    renderBlock();
    expect(screen.getByText('example.ts')).toBeVisible();
    expect(screen.getByText('TypeScript')).toBeVisible();
  });

  it('コピーボタンでコードをクリップボードへ書き込み、結果を通知する', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    mockClipboard(writeText);
    renderBlock();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'コードをコピー' }));
    });
    expect(writeText).toHaveBeenCalledWith('const x = 1;');
    expect(screen.getByRole('button', { name: 'コピーしました' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('コピーしました');
  });

  it('一定時間後にボタン表示を元に戻す', async () => {
    vi.useFakeTimers();
    mockClipboard(() => Promise.resolve());
    renderBlock();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'コードをコピー' }));
    });
    expect(screen.getByRole('button', { name: 'コピーしました' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole('button', { name: 'コードをコピー' })).toBeInTheDocument();
  });

  it('クリップボードが使えない場合は失敗を通知する', async () => {
    mockClipboard(() => Promise.reject(new Error('denied')));
    renderBlock();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'コードをコピー' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('コピーできませんでした');
  });

  it('Clipboard API がない環境でも例外を出さずに失敗を通知する', async () => {
    renderBlock();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'コードをコピー' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('コピーできませんでした');
  });

  it('言語ラベルは text では表示しない', () => {
    expect(languageLabel('text')).toBeUndefined();
    expect(languageLabel('bash')).toBe('Bash');
    expect(languageLabel('kotlin')).toBe('kotlin');
  });
});

describe('heading anchors', () => {
  it('h2 / h3 に見出しへのリンクを付ける', () => {
    const H2 = mdxComponents.h2 as (p: { id?: string; children?: string }) => ReactElement;
    render(<H2 id="数式">数式</H2>);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).getByRole('link', { name: 'この見出しへのリンク' })).toHaveAttribute('href', '#数式');
  });
});

describe('Misconceptions', () => {
  it('各項目に「誤解」「実際」のラベル文字を付ける', () => {
    render(<Misconceptions items={[{ myth: '速いほど良い', fact: 'コストとの釣り合い' }]} />);
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('誤解')).toBeVisible();
    expect(within(item).getByText('実際')).toBeVisible();
    expect(within(item).getByText('速いほど良い')).toBeInTheDocument();
    expect(within(item).getByText('コストとの釣り合い')).toBeInTheDocument();
  });
});
