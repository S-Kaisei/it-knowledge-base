import path from 'node:path';
import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';
import { listArticles, loadCategories } from '../scripts/lib/content.mjs';

// Article routes are generated from the content directory: adding an MDX file adds a route.
// Each article is its own route module (code-split, pre-rendered without loaders). See ADR-0004.
const appDir = import.meta.dirname;
const articleRoutes = listArticles().map((a) =>
  route(a.path.slice(1, -1), path.relative(appDir, a.abs).split(path.sep).join('/'), { id: `article/${a.slug}` }),
);

// Category routes are static too (one per categories.json entry). A dynamic ":category" segment would
// also match unknown URLs, so 404.html (pre-rendered at /404) would hydrate against a different route.
const categoryRoutes = loadCategories().categories.map((c) => route(c.slug, 'routes/category.tsx', { id: `category/${c.slug}` }));

export default [
  layout('routes/site-layout.tsx', [
    index('routes/home.tsx'),
    layout('routes/article-layout.tsx', articleRoutes),
    ...categoryRoutes,
    // "/404" is pre-rendered through the same catch-all route that unknown URLs match on the client,
    // so 404.html hydrates without a mismatch wherever the static host serves it.
    route('*', 'routes/not-found.tsx', { id: 'catch-all' }),
  ]),
] satisfies RouteConfig;
