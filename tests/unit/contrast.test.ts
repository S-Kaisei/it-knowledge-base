import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, parseTokenBlock, token } from './helpers/contrast';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/styles/app.css'), 'utf8');

const light = parseTokenBlock(css, /^:root\s*\{/m);
const dark = parseTokenBlock(css, /^:root\[data-theme='dark'\]\s*\{/m);
const darkMedia = parseTokenBlock(css, /:root:not\(\[data-theme='light'\]\)\s*\{/);

const themes = { light, dark } as const;

describe('デザイントークンのコントラスト比（WCAG 2.x）', () => {
  it('prefers-color-scheme の dark ブロックは data-theme=dark と同一の値', () => {
    expect(darkMedia).toEqual(dark);
    expect(Object.keys(dark).length).toBeGreaterThan(15);
  });

  for (const [name, t] of Object.entries(themes)) {
    const ratio = (a: string, b: string) => contrast(token(t, a), token(t, b));
    describe(name, () => {
      for (const bg of ['bg', 'surface', 'surface-2']) {
        for (const fg of ['fg', 'muted', 'subtle', 'accent-text']) {
          it(`${fg} on ${bg} >= 4.5`, () => {
            expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
      for (const kind of ['note', 'warn', 'tip']) {
        it(`${kind} on ${kind}-soft >= 4.5`, () => {
          expect(ratio(kind, `${kind}-soft`)).toBeGreaterThanOrEqual(4.5);
        });
      }
      it('accent-text on accent-soft >= 4.5', () => {
        expect(ratio('accent-text', 'accent-soft')).toBeGreaterThanOrEqual(4.5);
      });
      it('accent-fg on accent (button text) >= 4.5', () => {
        expect(ratio('accent-fg', 'accent')).toBeGreaterThanOrEqual(4.5);
      });
      it('accent on bg (focus ring, non-text) >= 3', () => {
        expect(ratio('accent', 'bg')).toBeGreaterThanOrEqual(3);
      });
      it('border on bg is faintly distinguishable (informational, >= 1.1)', () => {
        expect(ratio('border', 'bg')).toBeGreaterThanOrEqual(1.1);
      });
    });
  }
});
