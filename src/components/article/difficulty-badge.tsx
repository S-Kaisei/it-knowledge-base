import { DIFFICULTY_LABEL, type Difficulty } from '~/lib/content-schema';
import { cn } from '~/lib/utils';

const LEVEL: Record<Difficulty, number> = { beginner: 1, intermediate: 2, advanced: 3 };

/** Difficulty shown as filled bars AND a text label (never color alone). */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const level = LEVEL[difficulty];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-0.5 text-muted">
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <i key={i} className={cn('h-2.5 w-1.5 rounded-[1px]', i <= level ? 'bg-accent' : 'bg-border')} />
        ))}
      </span>
      難易度：{DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}
