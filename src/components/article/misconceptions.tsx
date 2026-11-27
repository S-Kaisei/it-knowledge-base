import type { ReactNode } from 'react';

export type Misconception = { myth: ReactNode; fact: ReactNode };

/** "よくある誤解" list. Each pair is labelled with the text 「誤解」「実際」 (not by color alone). */
export function Misconceptions({ items }: { items: Misconception[] }) {
  if (!items?.length) return null;
  return (
    <ul className="misconceptions">
      {items.map((item, i) => (
        <li key={i}>
          <p>
            <span className="misconception-label misconception-myth">誤解</span>
            <span>{item.myth}</span>
          </p>
          <p>
            <span className="misconception-label misconception-fact">実際</span>
            <span>{item.fact}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
