import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DifficultyBadge } from '~/components/article/difficulty-badge';

describe('DifficultyBadge', () => {
  it.each([
    ['beginner', '難易度：初級'],
    ['intermediate', '難易度：中級'],
    ['advanced', '難易度：上級'],
  ] as const)('shows a text label for %s (not color alone)', (difficulty, label) => {
    render(<DifficultyBadge difficulty={difficulty} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
