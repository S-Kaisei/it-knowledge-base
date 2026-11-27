import path from 'node:path';
import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';
import { listArticles } from '../scripts/lib/content.mjs';

// Article routes are generated from the content directory: adding an MDX file adds a route.
// Each article is its own route module (code-split, pre-rendered without loaders). See ADR-0004.
const appDir = import.meta.dirname;
const articleRoutes = listArticles().map((a) =>
  route(a.path.slice(1, -1), path.relative(appDir, a.abs).split(path.sep).join('/'), { id: `article/${a.slug}` }),
);

export default [
  layout('routes/site-layout.tsx', [
    index('routes/home.tsx'),
    layout('routes/article-layout.tsx', articleRoutes),
    route('404', 'routes/not-found.tsx', { id: 'not-found-page' }),
    route(':category', 'routes/category.tsx'),
    route('*', 'routes/not-found.tsx', { id: 'catch-all' }),
  ]),
] satisfies RouteConfig;
