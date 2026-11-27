import type { Config } from '@react-router/dev/config';
import { basePath, buildDir, listArticles, loadCategories } from './scripts/lib/content.mjs';

// Fully static site: no runtime server. Every public page is pre-rendered at build time (ADR-0001).
export default {
  appDirectory: 'src',
  buildDirectory: buildDir(),
  ssr: false,
  basename: basePath(),
  async prerender() {
    const articles = listArticles();
    const { categories } = loadCategories();
    return ['/', ...categories.map((c) => `/${c.slug}/`), ...articles.map((a) => a.path), '/404'];
  },
} satisfies Config;
