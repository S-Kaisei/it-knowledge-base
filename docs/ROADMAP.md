# ロードマップ

> 現在：**Phase 5（公開準備）進行中**。Phase 0〜4 は 2026-11-28 に完了。各フェーズの DoD を満たしたら次へ進む。最終的な完了条件は [SPEC §22](./SPEC.md)。

| Phase | 状態 | 完了日 | 根拠 |
| --- | --- | --- | --- |
| 0：調査・ハーネス設計 | 完了 | 2026-11-28 | `docs/`、`.claude/`（rules 7・skills 7・agents 6・hooks 4）、ADR 0001〜0008 |
| 1：Docker・サイト基盤 | 完了 | 2026-11-28 | Dockerfile（deps / dev / qa / builder / production）、`compose.yaml`、`scripts/verify.mjs`、H13 |
| 2：ドキュメント機能 | 完了 | 2026-11-28 | 記事表示・MDX 要素・Pagefind 検索・テーマ・ドロワー、H1〜H6、S1（verify 成功） |
| 3：代表記事 | 完了（人間レビュー待ち） | 2026-11-28 | `fundamentals/` に 3 記事（`draft: true`）、technical-reviewer 2 回で全軸 4 点以上 |
| 4：品質保証 | 完了 | 2026-11-28 | H1〜H15 成功、コントラスト unit・axe・キーボード E2E、CI/CD ワークフロー（ADR 0009） |
| 5：公開準備 | 進行中 | — | ドキュメント同期。CI の GitHub 上での実行・人間レビュー・初回デプロイが残り |

## Phase 0：調査・ハーネス設計

| 成果物 | 内容 |
| --- | --- |
| 設計ドキュメント | `docs/` 一式（本書、ARCHITECTURE、CONTENT_GUIDE、DESIGN_SYSTEM、HARNESS、EVALUATION、DEVELOPMENT、ADR、記事テンプレート） |
| ハーネス | `CLAUDE.md`、`.claude/rules`、`skills`、`agents`、`hooks`、`settings.json` |
| バージョン調査 | 採用バージョンの確定（[ADR 0002](./decisions/0002-node-and-library-versions.md)） |

DoD：

- [x] 上記ファイルが揃い、相互リンクが切れていない（`lint:md`）
- [x] hooks がスクリプト未作成の状態で開発を停止させない（H15）
- [x] 危険コマンドのガードと Stop hook のループ防止を fixture で確認（[EVALUATION.md](./EVALUATION.md) H7〜H9）

## Phase 1：Docker・サイト基盤

| 成果物 | 内容 |
| --- | --- |
| Docker | Dockerfile（deps / dev / builder / production / qa）、`compose.yaml`、`.dockerignore`、`docker/nginx.conf` |
| アプリ骨格 | React Router v8（`ssr: false`、prerender）、Vite、TypeScript strict、Tailwind v4、トークン、フォント |
| ツール | ESLint、Prettier、Markdownlint、Vitest、Playwright、`scripts/verify.mjs` |

DoD：

- [x] `docker compose up -d --build web` で起動し、HMR が動く（H13）
- [x] `docker compose run --rm qa bun run verify` が成功する
- [x] 直接アクセスと 404 応答を確認（GitHub Pages 規則の静的サーバーで E2E。nginx の production イメージは CI の Docker スモークテストで 200 / 404 を確認する構成だが、CI は未実行）
- [x] ルート / サブパス両方のビルドが成功（verify step 8 / 8b）
- [x] [DEVELOPMENT.md](./DEVELOPMENT.md) の手順を実地確認して更新

## Phase 2：ドキュメント機能

| 成果物 | 内容 |
| --- | --- |
| コンテンツ基盤 | Zod スキーマ、`generate-content` / `validate-content` / `check-links` / `postbuild` |
| 記事表示 | 記事レイアウト、サイドバー、目次、パンくず、関連記事、ページャ、記事メタ |
| MDX 要素 | Callout、Figure、Mermaid、KaTeX、コードブロック、Misconceptions |
| 検索 | Pagefind 統合（日本語、base path） |
| その他 | テーマ切替、モバイルドロワー、sitemap / robots |

DoD：

- [x] fixture 記事で全 MDX 要素が表示され、prerender HTML に本文が含まれる（`tests/e2e/article-features.spec.ts` ほか）
- [x] `content:check` が SPEC §14 の項目を検出（[EVALUATION.md](./EVALUATION.md) H1〜H6）
- [x] 日本語クエリで検索結果が出る（ルート / サブパス、`search.spec.ts` / `search-subpath.spec.ts`）
- [x] キーボード操作・ライト / ダーク・モバイルの E2E が通る

## Phase 3：代表記事

| 成果物 | 内容 |
| --- | --- |
| 記事 | CPU の仕組み、メモリとストレージ、キャッシュメモリ（`fundamentals`） |
| 図解 | 各記事に図解 1 点以上。キャッシュ記事に実効アクセス時間シミュレーター（`EffectiveAccessTimeSimulator`） |

DoD：

- [ ] 3 記事がルーブリック全軸 4 点以上（LLM 評価は達成、[EVALUATION.md](./EVALUATION.md) §4。**人間レビューは未実施**のため 3 記事とも `draft: true` のまま。Phase 5 で実施）
- [ ] 出典はすべて実際に確認済み（一部未確認あり。[EVALUATION.md](./EVALUATION.md) §5）
- [x] `/add-topic` ワークフロー（researcher → technical-writer → technical-reviewer）で作成し、ハーネスの実用性を確認

## Phase 4：品質保証

| 成果物 | 内容 |
| --- | --- |
| E2E 拡充 | SPEC §15 全項目、代表画面スクリーンショット |
| ハーネス評価 | SPEC §16 全項目（実イベント発火を含む） |
| アクセシビリティ | コントラスト計測、キーボード、スクリーンリーダー確認 |

DoD：

- [x] [EVALUATION.md](./EVALUATION.md) のハーネス評価 H1〜H15 がすべて「成功」（S8 の人間による最終確認は Phase 5）
- [x] 既知の課題を一覧化（[EVALUATION.md](./EVALUATION.md) §5）

## Phase 5：公開準備

| 成果物 | 内容 |
| --- | --- |
| CI | PR / main で `bun run verify`、Docker ビルド検証、コンテナ起動確認、レポート・失敗時スクリーンショット保存 |
| Deploy | GitHub Pages（検証済み成果物をそのまま公開、最小権限） |
| ドキュメント | README・開発資料の最終更新（docs をコードに同期済み） |

ワークフロー（`ci.yml` / `deploy.yml`）は作成済み。デプロイはリポジトリ変数 `PAGES_DEPLOY_ENABLED=true` を所有者が設定するまで無効。

DoD：

- [ ] CI が main で成功（未 push のため GitHub 上では未実行）
- [ ] 3 記事の人間レビューと `draft: false` への切り替え（承認されたもののみ）
- [ ] ユーザー承認後に初回デプロイし、公開 URL で E2E（サブパス）を確認
- [ ] SPEC §22 の Definition of Done をすべて満たす

## コンテンツバックログ（SPEC §19）

優先（Phase 3）：執筆済み・`draft: true`（LLM レビュー全軸 4 点以上、**人間レビュー待ち**）

1. CPUの仕組み（`fundamentals/cpu`）
2. メモリとストレージ（`fundamentals/memory-and-storage`）
3. キャッシュメモリ（`fundamentals/cache-memory`）

候補（順不同）：ITの全体像、コンピュータの5大装置、クロック周波数・CPI・MIPS、記憶階層、OSの役割、プロセスとスレッド、仮想記憶、RAID、システム性能と可用性、TCP/IPの基礎、DNSの仕組み、HTTPとHTTPS、Dockerの仕組み、CI/CDの仕組み、LLMの仕組み、AIエージェント、ハーネスエンジニアリング。

記事数より品質を優先する。未執筆記事を公開ページに並べない。

## 将来検討

| 項目 | 条件・メモ |
| --- | --- |
| MCP サーバーの導入 | 必要性が明確になった場合のみ。ADR で権限範囲を定義 |
| シミュレーター追加 | CPI・MIPS、進数変換、サブネット計算、稼働率、アルゴリズム可視化、正規化、通信の流れ。記事で必要な場合のみ（現在は実効アクセス時間の 1 つ） |
| Mermaid のレイアウト検査 | `content:check` は構文のみ。狭い画面での可読性・はみ出しを自動検査する仕組み（現在はスクリーンショットの目視と E2E の描画エラー検出のみ） |
| Dependabot（GitHub Actions） | Action を SHA 固定しているため、更新 PR を自動化する（[ADR 0009](./decisions/0009-ci-cd-verified-artifact-deploy.md)） |
| npm → bun 移行（2026-11-28 完了） | パッケージマネージャー・スクリプト実行を bun 1.4.5 に移行（ランタイムは Node.js 26 のまま）。ADR-0010 |
| 理解度確認問題 | ページ内完結、結果を保存しない |
| 外部リンクの定期検査 | CI のスケジュール実行（警告のみ） |
