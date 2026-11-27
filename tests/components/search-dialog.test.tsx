import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PagefindUnavailableError } from '~/components/search/pagefind';
import { SearchProvider } from '~/components/search/search-provider';
import { HeroSearchButton, SearchTrigger } from '~/components/search/search-trigger';
import type { PagefindApi, PagefindResultData } from '~/lib/search';

const BASICS: PagefindResultData = {
  url: '/fundamentals/fixture-basics/',
  excerpt: 'この記事は検索テスト用の固有語「<mark>キャッシュヒット率</mark>」を含みます。&lt;b&gt;',
  meta: { title: 'テスト用記事（基礎）', category: 'IT基礎' },
  sub_results: [{ title: '概要', url: '/fundamentals/fixture-basics/#概要', excerpt: '固有語「<mark>キャッシュヒット率</mark>」' }],
};
const NETWORK: PagefindResultData = {
  url: '/network/fixture-network/',
  excerpt: '<mark>名前解決</mark>と呼びます。<script>alert(1)</script>',
  meta: { title: 'テスト用記事（ネットワーク）', category: 'ネットワーク' },
};

function fakePagefind() {
  const search = vi.fn((term: string) => {
    const hits = [BASICS, NETWORK].filter((d) => d.excerpt.includes(term));
    return Promise.resolve({ results: hits.map((d, i) => ({ id: `ja_${i}`, data: () => Promise.resolve(d) })) });
  });
  const api: PagefindApi = { options: () => Promise.resolve(), init: () => Promise.resolve(), search };
  return { api, search };
}

function renderSearch(loader: () => Promise<PagefindApi>) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SearchProvider loader={loader}>
        <SearchTrigger />
        <Routes>
          <Route path="/" element={<HeroSearchButton />} />
          <Route path="/fundamentals/fixture-basics/" element={<h1>基礎ページ</h1>} />
          <Route path="/network/fixture-network/" element={<h1>ネットワークページ</h1>} />
        </Routes>
      </SearchProvider>
    </MemoryRouter>,
  );
}

describe('SearchDialog', () => {
  it('opens from the header trigger, shows marked results and returns focus on Esc', async () => {
    const user = userEvent.setup();
    const { api } = fakePagefind();
    renderSearch(() => Promise.resolve(api));

    const trigger = screen.getByRole('button', { name: 'サイト内検索を開く' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'サイト内検索' });
    const input = within(dialog).getByRole('combobox', { name: '検索キーワード' });
    expect(input).toHaveFocus();
    expect(within(dialog).getByText('記事のタイトルや本文をキーワードで検索できます。')).toBeInTheDocument();

    await user.type(input, 'キャッシュヒット率');
    const option = await within(dialog).findByRole('option', { name: /テスト用記事（基礎）/ });
    expect(option).toHaveTextContent('IT基礎');
    const marks = option.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('キャッシュヒット率');
    // Entities in the excerpt are shown as text, not parsed as markup.
    expect(option).toHaveTextContent('<b>');
    expect(option.querySelector('b')).toBeNull();
    expect(within(dialog).getByRole('option', { name: /概要/ })).toHaveAttribute('href', '/fundamentals/fixture-basics/#概要');
    expect(screen.getByRole('status')).toHaveTextContent('1件の記事が見つかりました');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('opens with Ctrl+K and "/" and navigates with the keyboard', async () => {
    const user = userEvent.setup();
    const { api } = fakePagefind();
    renderSearch(() => Promise.resolve(api));

    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('combobox', { name: '検索キーワード' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.keyboard('/');
    const input = await screen.findByRole('combobox', { name: '検索キーワード' });
    expect(input).toHaveValue('');

    await user.type(input, '名前解決');
    const option = await screen.findByRole('option', { name: /テスト用記事（ネットワーク）/ });
    // Script tags in an excerpt are rendered as inert text.
    expect(option.querySelector('script')).toBeNull();
    expect(option).toHaveTextContent('<script>alert(1)</script>');

    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);
    expect(option).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}'); // wraps (single option)
    expect(option).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'ネットワークページ' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens from the home hero button', async () => {
    const user = userEvent.setup();
    const { api } = fakePagefind();
    renderSearch(() => Promise.resolve(api));
    await user.click(screen.getByRole('button', { name: 'キーワードで検索（例: DNS 名前解決）' }));
    expect(screen.getByRole('dialog', { name: 'サイト内検索' })).toBeInTheDocument();
  });

  it('shows the no-results message', async () => {
    const user = userEvent.setup();
    const { api } = fakePagefind();
    renderSearch(() => Promise.resolve(api));
    await user.click(screen.getByRole('button', { name: 'サイト内検索を開く' }));
    await user.type(screen.getByRole('combobox'), 'ドラフト専用キーワード');
    expect(await screen.findByText('一致する記事が見つかりませんでした')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('shows the dev-server message when pagefind.js cannot be loaded', async () => {
    const user = userEvent.setup();
    renderSearch(() => Promise.reject(new PagefindUnavailableError(new TypeError('Failed to fetch dynamically imported module'))));
    await user.click(screen.getByRole('button', { name: 'サイト内検索を開く' }));
    expect(await screen.findByText('検索インデックスは本番ビルド後に利用できます（bun run build）')).toBeInTheDocument();
  });

  it('shows an error state when the search fails', async () => {
    const user = userEvent.setup();
    const api: PagefindApi = { options: () => Promise.resolve(), init: () => Promise.resolve(), search: () => Promise.reject(new Error('boom')) };
    renderSearch(() => Promise.resolve(api));
    await user.click(screen.getByRole('button', { name: 'サイト内検索を開く' }));
    await user.type(screen.getByRole('combobox'), 'x');
    expect(await screen.findByText(/検索中にエラーが発生しました/)).toBeInTheDocument();
  });

  it('waits for IME composition to end before searching', async () => {
    const user = userEvent.setup();
    const { api, search } = fakePagefind();
    renderSearch(() => Promise.resolve(api));
    await user.click(screen.getByRole('button', { name: 'サイト内検索を開く' }));
    const input = screen.getByRole('combobox');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'めいぜ' } });
    // Enter during composition confirms the IME candidate; it must not navigate.
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    await act(() => new Promise((r) => setTimeout(r, 250)));
    expect(search).not.toHaveBeenCalled();
    expect(input).toHaveValue('めいぜ');

    fireEvent.change(input, { target: { value: '名前解決' } });
    fireEvent.compositionEnd(input);
    await screen.findByRole('option', { name: /テスト用記事（ネットワーク）/ });
    expect(search).toHaveBeenCalledWith('名前解決');
  });
});
