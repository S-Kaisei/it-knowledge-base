// Vite plugin (dev only): regenerate the content index when articles change, and
// make React Router re-read routes.ts when the set of article routes changes.
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, contentDir, formatErrors, listArticles } from './content.mjs';

export function contentDevPlugin() {
  const dir = contentDir();
  const routesFile = path.join(PROJECT_ROOT, 'src', 'routes.ts');
  const routeKey = () =>
    listArticles({ dir, includeDrafts: true })
      .map((a) => `${a.path}:${a.file}`)
      .join('|');
  let lastKey = '';
  let running = Promise.resolve();

  return {
    name: 'ikb:content-dev',
    apply: 'serve',
    configureServer(server) {
      lastKey = routeKey();
      server.watcher.add(dir);
      const onChange = (file) => {
        if (!file.startsWith(dir) || !/\.(mdx?|json)$/.test(file)) return;
        running = running.then(async () => {
          const { generate } = await import('../generate-content.mjs');
          const { errors } = await generate({ includeDrafts: true, dir });
          if (errors.length) server.config.logger.warn(`[content] ${errors.length} problem(s):\n${formatErrors(errors)}`);
          const key = routeKey();
          if (key !== lastKey) {
            lastKey = key;
            const now = new Date();
            fs.utimesSync(routesFile, now, now); // routes changed → React Router reloads route config
          }
        });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
