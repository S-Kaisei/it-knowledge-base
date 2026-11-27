// Pure WCAG 2.x contrast helpers (no dependencies).
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`Unsupported color: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Extract `--name: value;` declarations from the body of the first block opened by `selectorRegex`. */
export function parseTokenBlock(css: string, selectorRegex: RegExp): Record<string, string> {
  const m = selectorRegex.exec(css);
  if (!m) throw new Error(`Block not found: ${selectorRegex}`);
  const start = css.indexOf('{', m.index);
  const end = css.indexOf('}', start);
  const body = css.slice(start + 1, end);
  const tokens: Record<string, string> = {};
  for (const d of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (d[1] && d[2]) tokens[d[1]] = d[2].trim();
  }
  return tokens;
}

/** Token lookup that fails loudly when a token is missing. */
export function token(tokens: Record<string, string>, name: string): string {
  const v = tokens[name];
  if (!v) throw new Error(`Missing token --${name}`);
  return v;
}
