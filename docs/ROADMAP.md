# ロードマップ

> 現在：**Phase 0（調査・ハーネス設計）**。各フェーズの DoD を満たしたら次へ進む。最終的な完了条件は [SPEC §22](./SPEC.md)。

## Phase 0：調査・ハーネス設計

| 成果物 | 内容 |
| --- | --- |
| 設計ドキュメント | `docs/` 一式（本書、ARCHITECTURE、CONTENT_GUIDE、DESIGN_SYSTEM、HARNESS、EVALUATION、DEVELOPMENT、ADR、記事テンプレート） |
| ハーネス | `CLAUDE.md`、`.claude/rules`、`skills`、`agents`、`hooks`、`settings.json` |
| バージョン調査 | 採用バージョンの確定（[ADR 0002](./decisions/0002-node-and-library-versions.md)） |

DoD：

- [ ] 上記ファイルが揃い、相互リンクが切れていない
- [ ] hooks がスクリプト未作成の状態で開発を停止させない
- [ ] 危険コマンドのガードと Stop hook のループ防止を fixture で確認（[EVALUATION.md](./EVALUATION.md) H7〜H9）

## Phase 1：Docker・サイト基盤

| 成果物 | 内容 |
| --- | --- |
| Docker | Dockerfile（deps / dev / builder / production / qa）、`compose.yaml`、`.dockerignore`、`docker/nginx.conf` |
| アプリ骨格 | React Router v8（`ssr: false`、prerender）、Vite、TypeScript strict、Tailwind v4、トークン、フォント |
| ツール | ESLint、Prettier、Markdownlint、Vitest、Playwright、`scripts/verify.mjs` |

DoD：

- [ ] `docker compose up -d --build web` で起動し、HMR が動く
- [ ] `docker compose run --rm qa npm run verify` が成功する（記事 0 件でも）
- [ ] preview で直接アクセスと 404 応答を確認
- [ ] ルート / サブパス両方のビルドが成功
- [ ] [DEVELOPMENT.md](./DEVELOPMENT.md) の手順を実地確認して更新

## Phase 2：ドキュメント機能

| 成果物 | 内容 |
| --- | --- |
| コンテンツ基盤 | Zod スキーマ、`generate-content` / `validate-content` / `check-links` / `postbuild` |
| 記事表示 | 記事レイアウト、サイドバー、目次、パンくず、関連記事、ページャ、記事メタ |
| MDX 要素 | Callout、Figure、Mermaid、KaTeX、コードブロック、Misconceptions |
| 検索 | Pagefind 統合（日本語、base path） |
| その他 | テーマ切替、モバイルドロワー、sitemap / robots |

DoD：

- [ ] fixture 記事で全 MDX 要素が表示され、prerender HTML に本文が含まれる
- [ ] `content:check` が SPEC §14 の項目を検出（[EVALUATION.md](./EVALUATION.md) H1〜H6）
- [ ] 日本語クエリで検索結果が出る（ルート / サブパス）
- [ ] キーボード操作・ライト / ダーク・モバイルの E2E が通る

## Phase 3：代表記事

| 成果物 | 内容 |
| --- | --- |
| 記事 | CPU の仕組み、メモリとストレージ、キャッシュメモリ（`fundamentals`） |
| 図解 | 各記事に図解 1 点以上。必要ならキャッシュヒット率シミュレーター |

DoD：

- [ ] 3 記事がルーブリック全軸 4 点以上（人間レビュー済み、[EVALUATION.md](./EVALUATION.md) に記録）
- [ ] 出典はすべて実際に確認済み
- [ ] `/add-topic` ワークフローで作成し、ハーネスの実用性を確認

## Phase 4：品質保証

| 成果物 | 内容 |
| --- | --- |
| E2E 拡充 | SPEC §15 全項目、代表画面スクリーンショット |
| ハーネス評価 | SPEC §16 全項目（実イベント発火を含む） |
| アクセシビリティ | コントラスト計測、キーボード、スクリーンリーダー確認 |

DoD：

- [ ] [EVALUATION.md](./EVALUATION.md) の全項目が「成功」または理由付きの「未検証」
- [ ] 既知の課題を一覧化

## Phase 5：公開準備

| 成果物 | 内容 |
| --- | --- |
| CI | PR / main で `npm run verify`、Docker ビルド検証、コンテナ起動確認、レポート・失敗時スクリーンショット保存 |
| Deploy | GitHub Pages（検証済み成果物をそのまま公開、最小権限） |
| ドキュメント | README・開発資料の最終更新 |

DoD：

- [ ] CI が main で成功
- [ ] ユーザー承認後に初回デプロイし、公開 URL で E2E（サブパス）を確認
- [ ] SPEC §22 の Definition of Done をすべて満たす

## コンテンツバックログ（SPEC §19）

優先（Phase 3）：

1. CPUの仕組み
2. メモリとストレージ
3. キャッシュメモリ

候補（順不同）：ITの全体像、コンピュータの5大装置、クロック周波数・CPI・MIPS、記憶階層、OSの役割、プロセスとスレッド、仮想記憶、RAID、システム性能と可用性、TCP/IPの基礎、DNSの仕組み、HTTPとHTTPS、Dockerの仕組み、CI/CDの仕組み、LLMの仕組み、AIエージェント、ハーネスエンジニアリング。

記事数より品質を優先する。未執筆記事を公開ページに並べない。

## 将来検討

| 項目 | 条件・メモ |
| --- | --- |
| MCP サーバーの導入 | 必要性が明確になった場合のみ。ADR で権限範囲を定義 |
| シミュレーター追加 | CPI・MIPS、進数変換、サブネット計算、稼働率、アルゴリズム可視化、正規化、通信の流れ。記事で必要な場合のみ |
| 理解度確認問題 | ページ内完結、結果を保存しない |
| 外部リンクの定期検査 | CI のスケジュール実行（警告のみ） |
