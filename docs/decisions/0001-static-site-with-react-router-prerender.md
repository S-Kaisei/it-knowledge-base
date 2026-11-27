# 0001. React Router prerender による静的サイト

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- SPEC は React / Vite / React Router を指定し、Astro・Starlight・Next.js を除外している。
- 実行時サーバー・DB を持たず、GitHub Pages で配信する。
- 記事 URL への直接アクセス・リロードで 404 にならず、JavaScript 実行前の HTML に本文を含める必要がある。

## 決定

- React Router v8 Framework Mode を採用し、`ssr: false` + `prerender` で全公開ページをビルド時に HTML 化する。
- `appDirectory: "src"`、`buildDirectory: "build"`。成果物は `build/client/`。
- prerender 対象は content index から生成する（公開記事 + カテゴリページ + `/404`）。

## 理由

- `ssr: false` でも `prerender` 指定パスは HTML が生成され、本文入りの静的 HTML と SPA 的な遷移を両立できる。
- ルート単位のコード分割、型生成（typegen）、Vite 統合を標準で利用できる。
- 実行時 Node.js サーバーが不要で、静的ホスティングにそのまま載る。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| Astro / Starlight / Next.js | SPEC で除外 |
| Vite + React Router Data/Declarative Mode + 独自 SSG スクリプト | prerender・コード分割・ルート型を自作することになり保守コストが高い |
| SPA のみ（クライアントレンダリング） | JS 実行前の HTML に本文がなく、直接アクセス時に 404 フォールバックが必要 |

## 影響

- prerender 中にブラウザ API を使えない。Mermaid・テーマ判定・検索は `useEffect` 内で行う。
- 記事数に比例してビルド時間が増える。

## 追記（2026-11-28）

実装との差分（決定内容は変更なし）：

- `buildDirectory` は `BUILD_DIR` 環境変数（既定 `build`）で切り替える。サブパス用 `build-subpath/`、E2E 用 `build-e2e*/`、下書き確認用 `build-drafts/` を同じ設定から作る。
- prerender 一覧は生成済みの content index ではなく、`scripts/lib/content.mjs` の `listArticles()` / `loadCategories()` でコンテンツディレクトリを直接読んで作る（`/`、全カテゴリ、公開記事、`/404`）。
