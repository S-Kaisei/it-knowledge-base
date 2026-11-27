import type { MDXComponents } from 'mdx/types';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { withBase } from '~/lib/utils';

/** Internal links go through React Router (applies the base path); external links open normally. */
function Anchor({ href = '', children, ...rest }: ComponentProps<'a'>) {
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  const external = /^https?:\/\//.test(href);
  return (
    <a href={href} {...rest} {...(external ? { rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

function Img({ src = '', alt = '', ...rest }: ComponentProps<'img'>) {
  return <img src={typeof src === 'string' ? withBase(src) : src} alt={alt} loading="lazy" decoding="async" {...rest} />;
}

function Table(props: ComponentProps<'table'>) {
  return (
    <div className="table-wrap" role="region" aria-label="表" tabIndex={0}>
      <table {...props} />
    </div>
  );
}

/** Pre-rendered fallback for ```mermaid fences; replaced by the client renderer in Phase 2. */
function Mermaid({ chart }: { chart: string }) {
  return (
    <pre className="mermaid-source" data-mermaid-source="">
      <code>{chart}</code>
    </pre>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const mdxComponents: MDXComponents = {
  a: Anchor,
  img: Img,
  table: Table,
  Mermaid,
  wrapper: Wrapper,
};
