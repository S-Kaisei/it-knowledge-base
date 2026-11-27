# 0004. MDX をルートモジュールとするコンテンツパイプライン

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- 記事追加時にルーティングの手動更新を不要にしたい。
- frontmatter を Zod で検証し、目次・関連記事・前後記事・sitemap を生成する必要がある。
- `ssr: false` 構成で loader を使うと、prerender 時に `.data` ファイルが生成され、配信・base path の考慮点が増える。

## 決定

1. `scripts/generate-content.mjs` が `src/content/**/*.mdx` を gray-matter で読み、`src/lib/content-schema.ts`（Zod）で検証し、`src/generated/content-index.json`（git 管理外）を出力する。
2. `src/routes.ts` が content index を読み、公開記事ごとに `route("<category>/<slug>", "content/<category>/<slug>.mdx", { id: "article:<slug>" })` を `layout("routes/article-layout.tsx", ...)` 配下に生成する。
3. MDX は `@mdx-js/rollup`（remark-gfm、remark-math、rehype-katex、rehype-slug、shiki）でコンパイルする。
4. 記事レイアウトはメタデータを content index から取得する（loader なし）。
5. カテゴリは `src/content/categories.json` のみで定義する。

## 理由

- MDX ファイル自体がルートモジュールになり、記事単位のコード分割と prerender が自然に得られる。
- loader を使わないため `.data` が不要で、静的ファイルだけで完結する。
- 目次 id を github-slugger で生成し rehype-slug と一致させることで、ビルド時に目次を確定できる。
- Zod スキーマを TypeScript 型と検証スクリプトで共有できる。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| 単一の `$slug` 動的ルート + loader で MDX を読み込む | `.data` 生成、全記事が同一チャンクまたは動的 import 管理が必要 |
| `import.meta.glob` で全記事を一括 import | ルート単位のコード分割ができない |
| ビルド時に MDX を HTML 文字列化して JSON に格納 | React コンポーネント（シミュレーター等）を埋め込めない |
| 外部 CMS | SPEC の範囲外、レビュー済みコンテンツのみ処理する方針に反する |

## 影響

- `routes.ts` が生成物に依存するため、`content:generate` を `dev` / `build` / `typecheck` の前に実行する必要がある。
- draft はこの段階で除外されるため、本番ビルドで draft の URL は存在しない。
