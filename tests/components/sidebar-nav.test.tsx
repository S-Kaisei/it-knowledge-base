import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SidebarNav } from '~/components/layout/sidebar-nav';
import type { ContentIndex } from '~/lib/content-schema';

const index: ContentIndex = {
  includeDrafts: false,
  categories: [
    {
      slug: 'fundamentals',
      name: 'IT基礎',
      nameEn: 'Fundamentals',
      description: 'd',
      topics: 't',
      icon: 'cpu',
      order: 1,
      articleCount: 1,
      path: '/fundamentals/',
    },
    {
      slug: 'security',
      name: 'セキュリティ',
      nameEn: 'Security',
      description: 'd',
      topics: 't',
      icon: 'shield',
      order: 2,
      articleCount: 0,
      path: '/security/',
    },
  ],
  articles: [
    {
      title: 'キャッシュメモリ',
      description: 'description for tests',
      slug: 'cache-memory',
      category: 'fundamentals',
      difficulty: 'intermediate',
      tags: [],
      prerequisites: [],
      related: [],
      order: 1,
      draft: false,
      lastUpdated: '2026-11-28',
      references: [],
      path: '/fundamentals/cache-memory/',
      file: 'fundamentals/cache-memory.mdx',
      toc: [],
      readingMinutes: 5,
      prev: null,
      next: null,
    },
  ],
};

describe('SidebarNav', () => {
  it('lists published categories and marks the current article', () => {
    render(
      <MemoryRouter initialEntries={['/fundamentals/cache-memory/']}>
        <SidebarNav index={index} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: '記事ナビゲーション' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'キャッシュメモリ' })).toHaveAttribute('aria-current', 'page');
  });

  it('hides categories without published articles', () => {
    render(
      <MemoryRouter>
        <SidebarNav index={index} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('セキュリティ')).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing is published', () => {
    render(
      <MemoryRouter>
        <SidebarNav index={{ ...index, categories: index.categories.map((c) => ({ ...c, articleCount: 0 })), articles: [] }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('公開中の記事はまだありません。')).toBeInTheDocument();
  });
});
