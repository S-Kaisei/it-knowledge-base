import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit (node) and component (jsdom) tests run as separate projects so verify.mjs can report them separately.
const alias = { '~': path.resolve(import.meta.dirname, 'src') };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.{ts,mjs}', 'tests/harness/**/*.test.{ts,mjs}'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['tests/components/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/components/setup.ts'],
        },
      },
    ],
  },
});
