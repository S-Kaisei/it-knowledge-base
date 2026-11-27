export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ikb-theme';

export function parsePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** Order used by the header toggle: system → light → dark → system. */
export function nextPreference(pref: ThemePreference): ThemePreference {
  return pref === 'system' ? 'light' : pref === 'light' ? 'dark' : 'system';
}

export const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'システム設定に合わせる',
  light: 'ライト',
  dark: 'ダーク',
};

/**
 * Inline script executed before first paint (in <head>) so the stored theme is applied
 * without a flash. Must stay tiny and dependency-free; failures fall back to the CSS media query.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;
