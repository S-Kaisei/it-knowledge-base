# アーキテクチャ規約（常時適用）

詳細は `docs/ARCHITECTURE.md`、要件は `docs/SPEC.md`、判断履歴は `docs/decisions/`。

## 不変条件

- 静的サイトのみ。DB・バックエンドAPI・認証・ユーザーデータ永続化・アクセス解析・外部AI APIを追加しない。
- Astro / Starlight / Next.js を導入しない。
- React Router v8 Framework Mode、`appDirectory: "src"`、`ssr: false`、`prerender` は生成済みコンテンツインデックスから算出する。
- 記事ルートは `src/routes.ts` がインデックスから自動生成する。記事追加のためにルーティングを手で編集しない。
- URL: `/`、`/<category>/`、`/<category>/<slug>/`。slug は全体で一意かつ不変。
- カテゴリの唯一の定義元は `src/content/categories.json`。UIにカテゴリをハードコードしない。
- base path は環境変数 `BASE_PATH` のみで制御（Vite `base` と RR `basename` を一致）。内部リンク・アセット・Pagefind URLに `/` 始まりの絶対パスを直書きしない。
- `src/generated/` は生成物。手で編集・コミットしない（`npm run content:generate` で再生成）。
- 事前レンダリング中にブラウザ専用API（`window`、`document`、`localStorage`、Mermaid描画）を呼ばない。`useEffect` 内に限定する。
- `draft: true` は本番ビルド・検索・sitemap・prerenderから除外する。
- ビルド出力は `build/client/` に統一（package.json / Dockerfile / CI / デプロイで共通）。

## 変更手順

- 上記を変える設計変更は、実装前に `docs/decisions/` へADRを追加し、`docs/ARCHITECTURE.md` を更新する。
- SPEC.md の要件を実装都合で書き換えない。要件変更はADRで記録する。
- 依存追加はバージョン固定し、`package-lock.json` を更新する（`npm ci` で再現可能に）。
