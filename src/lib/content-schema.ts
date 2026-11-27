// Content schema (single source of truth for frontmatter and the generated content index).
// Imported by build scripts (Node native type stripping) and by app code (types only).
// Keep this file free of non-erasable TypeScript syntax (no enums / namespaces / parameter properties).
import { z } from 'zod';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** YAML parsers turn unquoted 2026-11-28 into a Date; normalize to YYYY-MM-DD. */
const isoDate = z.preprocess(
  (v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で記述してください')
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), '存在しない日付です'),
);

export const slugSchema = z.string().regex(SLUG_RE, 'slug は小文字英数字とハイフンのみ（例: cache-memory）');

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
};

export const referenceSchema = z
  .object({
    title: z.string().min(1),
    url: z.url({ protocol: /^https?$/ }),
    publisher: z.string().min(1).optional(),
    accessed: isoDate,
  })
  .strict();
export type Reference = z.infer<typeof referenceSchema>;

export const frontmatterSchema = z
  .object({
    title: z.string().min(1).max(80),
    description: z.string().min(10).max(200),
    slug: slugSchema,
    category: slugSchema,
    difficulty: difficultySchema,
    tags: z.array(z.string().min(1)).default([]),
    prerequisites: z.array(slugSchema).default([]),
    related: z.array(slugSchema).default([]),
    order: z.number().int().nonnegative().default(100),
    draft: z.boolean().default(false),
    lastUpdated: isoDate,
    lastVerified: isoDate.optional(),
    references: z.array(referenceSchema).default([]),
  })
  .strict();
export type Frontmatter = z.infer<typeof frontmatterSchema>;

export const categorySchema = z
  .object({
    slug: slugSchema,
    name: z.string().min(1),
    nameEn: z.string().min(1),
    description: z.string().min(1),
    topics: z.string().min(1),
    icon: z.string().min(1),
    order: z.number().int(),
  })
  .strict();
export type Category = z.infer<typeof categorySchema>;

export const categoriesFileSchema = z.array(categorySchema).min(1);

export type TocItem = { depth: 2 | 3; id: string; text: string };

export type ArticleLink = { slug: string; title: string; path: string; category: string };

export type ArticleMeta = Frontmatter & {
  /** URL path without base path, with trailing slash: /<category>/<slug>/ */
  path: string;
  /** Source file relative to the content directory: <category>/<slug>.mdx */
  file: string;
  toc: TocItem[];
  readingMinutes: number;
  prev: ArticleLink | null;
  next: ArticleLink | null;
};

export type CategorySummary = Category & { articleCount: number; path: string };

export type ContentIndex = {
  includeDrafts: boolean;
  categories: CategorySummary[];
  articles: ArticleMeta[];
};
