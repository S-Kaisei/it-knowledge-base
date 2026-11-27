import { Link } from 'react-router';
import type { Route } from './+types/not-found';
import { pageTitle } from '~/lib/site';

export const meta: Route.MetaFunction = () => [{ title: pageTitle('ページが見つかりません') }, { name: 'robots', content: 'noindex' }];

export function NotFoundContent() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-24 nav:px-0" data-testid="not-found">
      <p className="font-mono text-sm text-subtle">404</p>
      <h1 className="mt-2 text-3xl font-bold">ページが見つかりません</h1>
      <p className="mt-4 text-muted">お探しのページは移動または削除された可能性があります。URL をご確認いただくか、トップページから記事を探してください。</p>
      <p className="mt-8">
        <Link to="/">トップページへ戻る</Link>
      </p>
    </div>
  );
}

export default function NotFound() {
  return <NotFoundContent />;
}
