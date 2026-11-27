import { Link } from 'react-router';
import type { ArticleMeta } from '~/lib/content-schema';
import { getCategory, resolveArticles } from '~/lib/content';

export function RelatedArticles({ article }: { article: ArticleMeta }) {
  const related = resolveArticles(article.related);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-heading" className="mt-12">
      <h2 id="related-heading" className="mb-3.5 text-[23px] font-bold">
        関連記事
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {related.map((r) => (
          <li key={r.slug}>
            <Link to={r.path} className="block h-full rounded-lg border border-border px-3.5 py-3 leading-normal text-fg no-underline hover:border-accent">
              <small className="mb-0.5 block text-xs text-subtle">{getCategory(r.category)?.name}</small>
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReferenceList({ article }: { article: ArticleMeta }) {
  if (article.references.length === 0) return null;
  return (
    <section aria-labelledby="references-heading" className="mt-12">
      <h2 id="references-heading" className="mb-3.5 text-[23px] font-bold">
        参考資料・出典
      </h2>
      <ol className="list-decimal pl-5 text-sm text-muted">
        {article.references.map((ref) => (
          <li key={ref.url} className="my-1.5">
            <a href={ref.url} rel="noopener noreferrer">
              {ref.title}
            </a>
            {ref.publisher ? <span>（{ref.publisher}）</span> : null}
            <span className="text-[12.5px] text-subtle"> — 確認日 {ref.accessed}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ArticlePager({ article }: { article: ArticleMeta }) {
  if (!article.prev && !article.next) return null;
  return (
    <nav aria-label="前後の記事" className="mt-12 grid grid-cols-1 gap-3 border-t border-border pt-6 min-[521px]:grid-cols-2">
      {article.prev ? (
        <Link to={article.prev.path} rel="prev" className="rounded-lg border border-border px-4 py-3 leading-normal text-fg no-underline hover:border-accent">
          <small className="block text-xs text-subtle">← 前の記事</small>
          {article.prev.title}
        </Link>
      ) : (
        <span />
      )}
      {article.next ? (
        <Link
          to={article.next.path}
          rel="next"
          className="rounded-lg border border-border px-4 py-3 text-right leading-normal text-fg no-underline hover:border-accent"
        >
          <small className="block text-xs text-subtle">次の記事 →</small>
          {article.next.title}
        </Link>
      ) : null}
    </nav>
  );
}
