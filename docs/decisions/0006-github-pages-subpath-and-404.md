# 0006. GitHub Pages のサブパス配信と 404

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- GitHub Pages のプロジェクトサイトは `/it-knowledge-base/` 配下で配信される。
- 存在する URL への直接アクセスは成功させ、存在しない URL は 404 にする（全 URL をトップへ転送しない）。

## 決定

- 環境変数 `BASE_PATH`（既定 `/`）を Vite `base` と React Router `basename` に渡す。Pagefind 結果 URL・sitemap も同じ値を使う。
- 各ページを `/<path>/index.html` として prerender する。
- `/404` を prerender し、postbuild で `build/client/404/index.html` を `build/client/404.html` にコピーする。
- GitHub Pages は `404.html` を自動利用し、nginx（preview）は `error_page 404 /404.html` で 404 ステータスと共に返す。
- catch-all `*` ルートでクライアント遷移時の未定義 URL も NotFound を表示する。

## 理由

- 静的 HTML が実在するため、直接アクセス・リロードがサーバー設定なしで成功する。
- `404.html` は GitHub Pages と nginx の両方で扱える共通の形式。
- ステータス 404 を正しく返せる（SPA フォールバックの 200 応答を避ける）。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| `404.html` で SPA リダイレクトするハック | 404 ステータスが失われ、検索エンジン・E2E で判別できない |
| HashRouter | URL が不安定、prerender と相性が悪い |
| カスタムドメインでルート配信のみ | サブパス対応が要件 |

## 影響

- ルート配信とサブパス配信の両方を E2E で検証する必要がある。
- 内部リンクで base path を手書きしない（`<Link>` を使う）。
- サブパスの 404.html 内アセット URL は base path 付きの絶対パスである必要がある。
