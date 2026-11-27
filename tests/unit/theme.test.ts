import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT, nextPreference, parsePreference, resolveTheme } from '~/lib/theme';

describe('theme', () => {
  it('parses stored preferences, defaulting to system', () => {
    expect(parsePreference('dark')).toBe('dark');
    expect(parsePreference('light')).toBe('light');
    expect(parsePreference(null)).toBe('system');
    expect(parsePreference('purple')).toBe('system');
  });

  it('resolves system preference using the OS setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('cycles system → light → dark → system', () => {
    expect(nextPreference('system')).toBe('light');
    expect(nextPreference('light')).toBe('dark');
    expect(nextPreference('dark')).toBe('system');
  });

  it('init script is self-contained and guarded by try/catch', () => {
    expect(THEME_INIT_SCRIPT).toContain('try{');
    expect(THEME_INIT_SCRIPT).toContain('ikb-theme');
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });
});
