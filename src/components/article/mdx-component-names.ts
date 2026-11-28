// Single source of truth for the custom (capitalised) components usable in article MDX.
// Imported by mdx-components.tsx (type-checked against the actual map) and by content:check
// (scripts/lib/validate.mjs) so an unregistered <Component /> is caught before it breaks a page at runtime.
// Keep this file free of JSX and non-erasable TypeScript syntax (Node imports it via type stripping).
export const MDX_COMPONENT_NAMES = ['Callout', 'EffectiveAccessTimeSimulator', 'Figure', 'Mermaid', 'Misconceptions', 'PastExam', 'PastExamAnswer'] as const;

export type MdxComponentName = (typeof MDX_COMPONENT_NAMES)[number];
