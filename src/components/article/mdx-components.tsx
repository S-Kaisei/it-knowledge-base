import type { MDXComponents } from 'mdx/types';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { Mermaid } from '~/components/diagrams/mermaid';
import { withBase } from '~/lib/utils';
import { Callout } from './callout';
import { CodeBlock } from './code-block';
import { Figure } from './figure';
import { Misconceptions } from './misconceptions';

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

/** "#" link after h2/h3 (ids come from rehype-slug, the same ids as the TOC). */
function HeadingAnchor({ id }: { id: string | undefined }) {
  if (!id) return null;
  return (
    <a href={`#${id}`} className="heading-anchor" aria-label="この見出しへのリンク" data-pagefind-ignore="">
      #
    </a>
  );
}

function H2({ id, children, ...rest }: ComponentProps<'h2'>) {
  return (
    <h2 id={id} {...rest}>
      {children}
      <HeadingAnchor id={id} />
    </h2>
  );
}

function H3({ id, children, ...rest }: ComponentProps<'h3'>) {
  return (
    <h3 id={id} {...rest}>
      {children}
      <HeadingAnchor id={id} />
    </h3>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const mdxComponents: MDXComponents = {
  a: Anchor,
  img: Img,
  table: Table,
  h2: H2,
  h3: H3,
  pre: CodeBlock,
  Callout,
  Figure,
  Mermaid,
  Misconceptions,
  wrapper: Wrapper,
};
