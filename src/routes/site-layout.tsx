import { Outlet } from 'react-router';
import { SiteFooter } from '~/components/layout/site-footer';
import { SiteHeader } from '~/components/layout/site-header';
import { SidebarNav } from '~/components/layout/sidebar-nav';
import { SearchProvider } from '~/components/search/search-provider';
import { SearchTrigger } from '~/components/search/search-trigger';

export default function SiteLayout() {
  return (
    <SearchProvider>
      <a href="#main" className="sr-only z-50 rounded-md bg-bg px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        本文へスキップ
      </a>
      <SiteHeader search={<SearchTrigger />} />
      <div className="mx-auto flex max-w-[1360px]">
        <aside className="sticky top-[var(--header-h)] hidden h-[calc(100vh-var(--header-h))] w-[260px] shrink-0 overflow-y-auto border-r border-border py-5 pr-3 pl-4 nav:block">
          <SidebarNav />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <SiteFooter />
    </SearchProvider>
  );
}
