import { SITE } from '~/lib/site';

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap justify-between gap-3 border-t border-border px-4 py-6 text-[13px] text-subtle">
      <span>
        {SITE.name} — {SITE.tagline}
      </span>
      <span>
        コンテンツは独自に作成しています ·{' '}
        <a href={SITE.repoUrl} rel="noopener noreferrer" className="text-subtle">
          GitHub
        </a>
      </span>
    </footer>
  );
}
