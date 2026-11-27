import type { ReactNode } from 'react';
import { withBase } from '~/lib/utils';

export type FigureProps = {
  /** Caption shown under the figure (<figcaption>). */
  caption?: ReactNode;
  /** Image path under public/ (e.g. "/images/<slug>/x.svg"). Use either src+alt or children. */
  src?: string;
  /** Required with src. Describe what the image shows. */
  alt?: string;
  width?: number;
  height?: number;
  children?: ReactNode;
};

/** Figure with caption: an image (src/alt) or any children (SVG, table, interactive diagram). */
export function Figure({ caption, src, alt = '', width, height, children }: FigureProps) {
  return (
    <figure className="figure">
      <div className="figure-body">{src ? <img src={withBase(src)} alt={alt} width={width} height={height} loading="lazy" decoding="async" /> : children}</div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
