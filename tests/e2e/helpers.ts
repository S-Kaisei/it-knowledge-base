import { type Page, expect } from '@playwright/test';

/** Collect uncaught exceptions, console errors and failed same-origin requests during a test. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    // "Failed to load resource" duplicates HTTP failures without the URL; those are tracked (with URL)
    // by the response listener below, and a 404 document status is asserted by the 404 tests themselves.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(`console: ${msg.text()}`);
  });
  page.on('response', (res) => {
    const url = new URL(res.url());
    // A 404 for the document itself is asserted by the 404 tests; everything else must load.
    if (res.status() >= 400 && url.host === new URL(page.url() || res.url()).host && res.request().resourceType() !== 'document') {
      errors.push(`http ${res.status()}: ${url.pathname}`);
    }
  });
  return {
    errors,
    expectNone: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

/** True when the page body scrolls horizontally (layout overflow). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}
