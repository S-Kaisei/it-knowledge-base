import { Info, Lightbulb, type LucideIcon, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export type CalloutType = 'note' | 'warn' | 'tip';

const VARIANTS: Record<CalloutType, { label: string; Icon: LucideIcon }> = {
  note: { label: '補足', Icon: Info },
  warn: { label: '注意', Icon: TriangleAlert },
  tip: { label: 'ポイント', Icon: Lightbulb },
};

export type CalloutProps = {
  type?: CalloutType;
  title?: string;
  children?: ReactNode;
};

/** Note / warning / tip box. The kind is always conveyed by a text label next to the icon, never by color alone. */
export function Callout({ type = 'note', title, children }: CalloutProps) {
  const variant = VARIANTS[type] ?? VARIANTS.note;
  const { label, Icon } = variant;
  const name = title ? `${label}：${title}` : label;
  return (
    <div className={`callout callout-${type in VARIANTS ? type : 'note'}`} role="note" aria-label={name}>
      <p className="callout-heading">
        <Icon className="callout-icon" aria-hidden="true" size={18} strokeWidth={2} />
        <span className="callout-label">{label}</span>
        {title ? <span className="callout-title">{title}</span> : null}
      </p>
      <div className="callout-body">{children}</div>
    </div>
  );
}
