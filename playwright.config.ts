import { defineConfig, devices } from '@playwright/test';

// E2E runs against static builds served with GitHub Pages semantics (scripts/serve-static.mjs).
//   site     : the real site (build/client at /)                    — `bun run build` must run first
//   fixture  : fixture content (build-e2e/client at /)              — feature coverage with stable content
//   mobile   : fixture content on a phone viewport
//   subpath  : fixture content at /it-knowledge-base/ (GitHub Pages)
// `bun run test:e2e` builds the fixture sites itself (build:e2e).
const SITE_PORT = 4173;
const FIXTURE_PORT = 4175;
const SUBPATH_PORT = 4176;
const SUBPATH_BASE = '/it-knowledge-base/';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ja-JP',
  },
  projects: [
    { name: 'site', testMatch: /site\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${SITE_PORT}` } },
    {
      name: 'fixture',
      testIgnore: /(site|subpath|search-subpath|mobile)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: `http://127.0.0.1:${FIXTURE_PORT}` },
    },
    { name: 'mobile', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'], baseURL: `http://127.0.0.1:${FIXTURE_PORT}` } },
    {
      name: 'subpath',
      testMatch: /(subpath|search-subpath)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${SUBPATH_PORT}${SUBPATH_BASE}` },
    },
  ],
  webServer: [
    {
      command: `node scripts/serve-static.mjs --dir build/client --port ${SITE_PORT} --base /`,
      url: `http://127.0.0.1:${SITE_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `node scripts/serve-static.mjs --dir build-e2e/client --port ${FIXTURE_PORT} --base /`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `node scripts/serve-static.mjs --dir build-e2e-subpath/client --port ${SUBPATH_PORT} --base ${SUBPATH_BASE}`,
      url: `http://127.0.0.1:${SUBPATH_PORT}${SUBPATH_BASE}`,
      reuseExistingServer: false,
    },
  ],
});
