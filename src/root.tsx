import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from 'react-router';
import type { Route } from './+types/root';
import { SITE, pageTitle } from '~/lib/site';
import { THEME_INIT_SCRIPT } from '~/lib/theme';
import { withBase } from '~/lib/utils';
import './styles/app.css';

export const links: Route.LinksFunction = () => [{ rel: 'icon', href: withBase('/favicon.svg'), type: 'image/svg+xml' }];

export const meta: Route.MetaFunction = () => [{ title: pageTitle() }, { name: 'description', content: SITE.description }];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        {/* Applies the stored theme before first paint (no flash). Static string, no user input. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? 'ページが見つかりません' : 'エラーが発生しました';
  const detail = notFound
    ? 'お探しのページは移動または削除された可能性があります。'
    : import.meta.env.DEV && error instanceof Error
      ? error.message
      : 'ページの表示中に問題が発生しました。時間をおいて再度お試しください。';
  return (
    <main className="mx-auto max-w-[720px] px-4 py-24">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-4 text-muted">{detail}</p>
      <p className="mt-8">
        <a href={withBase('/')}>トップページへ戻る</a>
      </p>
    </main>
  );
}
