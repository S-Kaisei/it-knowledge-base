import path from 'node:path';
import mdx from '@mdx-js/rollup';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type PluginOption } from 'vite';
import { basePath, contentIndexFile } from './scripts/lib/content.mjs';
import { mdxOptions } from './scripts/lib/mdx-options.mjs';
import { contentDevPlugin } from './scripts/lib/vite-content-plugin.mjs';

export default defineConfig({
  base: basePath(),
  plugins: [
    tailwindcss(),
    // MDX must be compiled before React Router analyses route modules.
    { enforce: 'pre', ...mdx(mdxOptions()) } as PluginOption,
    reactRouter(),
    contentDevPlugin(),
  ],
  resolve: {
    // The generated index is chosen by CONTENT_DIR (fixtures use their own file); must precede the "~" alias.
    alias: [
      { find: /^~\/generated\/content-index\.json$/, replacement: contentIndexFile() },
      { find: '~', replacement: path.resolve(import.meta.dirname, 'src') },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.VITE_USE_POLLING === 'true',
      interval: 300,
    },
  },
});
