import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { THEME_LABEL, THEME_STORAGE_KEY, type ThemePreference, nextPreference, parsePreference, resolveTheme } from '~/lib/theme';

const CHANGE_EVENT = 'ikb-theme-change';

function readPreference(): ThemePreference {
  try {
    return parsePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function apply(pref: ThemePreference) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', resolveTheme(pref, dark));
}

function store(pref: ThemePreference) {
  try {
    if (pref === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage may be unavailable (private mode); the choice still applies to this page view.
  }
  apply(pref);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle() {
  // Server snapshot is "system": the stored preference is unknown during pre-rendering.
  const current = useSyncExternalStore(subscribe, readPreference, () => 'system' as const);

  // Follow OS changes while the preference is "system".
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readPreference() === 'system') apply('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const next = nextPreference(current);
  const Icon = current === 'light' ? Sun : current === 'dark' ? Moon : Monitor;

  return (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
      aria-label={`テーマ: ${THEME_LABEL[current]}（クリックで${THEME_LABEL[next]}に切り替え）`}
      title={`テーマ: ${THEME_LABEL[current]}`}
      data-theme-preference={current}
      onClick={() => store(next)}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  );
}
