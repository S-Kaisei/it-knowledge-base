# IT Knowledge Base

ITの仕組みを、基礎から実践まで。

CPU・メモリからネットワーク、クラウド、AI までの IT 技術を、図解と具体例で体系的に解説する日本語の技術ドキュメントサイトです。React Router（静的事前レンダリング）と Vite で構築し、GitHub Pages で公開します。記事の調査・執筆・独立レビュー・品質検証は、リポジトリ内の Claude Code ハーネスで一貫して行います。

- 公開予定 URL: <https://s-kaisei.github.io/it-knowledge-base/>（公開は未実施）
- 進捗: [docs/ROADMAP.md](docs/ROADMAP.md) ／ 評価結果: [docs/EVALUATION.md](docs/EVALUATION.md)

## 特徴

- **静的サイト**: 実行時サーバー・DB なし。記事ごとの HTML をビルド時に生成し、JavaScript なしでも本文が読めます。
- **日本語全文検索**: Pagefind（ビルド時にインデックス生成）。⌘K / Ctrl+K / `/` で検索。
- **図解・数式・コード**: Mermaid、インライン SVG、KaTeX、Shiki（ライト / ダーク対応）、コピーボタン。
- **シミュレーター**: 計算ロジックを純粋関数に分けてテストした、ページ内で完結する操作可能な教材。
- **アクセシビリティ**: WCAG 2.2 AA を目標に、axe による自動検査、コントラスト比テスト、キーボード操作の E2E を実施。
- **GitHub Pages のサブパス配信**: `/it-knowledge-base/` 配下での動作を E2E で検証。

## 必要なもの

- Docker（Docker Compose v2）と Git
- Claude Code を使う場合のみ、ホストに Node.js 18 以上（Hooks の実行用）

アプリの依存関係はコンテナ内にだけインストールします。ホストで `bun install` は不要です（パッケージ管理は bun、実行環境は Node.js 26）。

## 使い方

```bash
# 開発サーバー（HMR）: http://127.0.0.1:5173
docker compose up -d --build web
docker compose logs -f web

# 個別の検証
docker compose exec web bun run typecheck
docker compose exec web bun run lint
docker compose exec web bun run content:check
docker compose exec web bun run test
docker compose exec web bun run build

# 総合品質ゲート（型・lint・コンテンツ・テスト・ビルド・リンク・E2E）
docker compose run --rm qa bun run verify

# 本番相当（非 root の nginx）: http://127.0.0.1:8080
docker compose --profile preview up -d --build preview

# 停止
docker compose down
```

依存関係の更新、サブパスのビルド、下書き記事の表示確認、トラブルシューティングは [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照してください。

## 記事を追加する

記事は `src/content/<category>/<slug>.mdx` に置くだけで、ルーティング・目次・検索・サイトマップに自動で反映されます。書き方は [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)、雛形は [docs/templates/article.md](docs/templates/article.md) です。

Claude Code では次のように依頼できます。

```text
/add-topic DNSの名前解決の仕組み
/add-topic TCP/IPを基礎から応用まで体系的に整理して
/research-topic RAGの仕組みと課題
/create-diagram Dockerのコンテナとイメージの関係
/review-content fundamentals
/develop 記事内のコードコピー機能を改善して
/verify-site
/release
```

新しい記事は `draft: true` で作成され、独立レビュー（5 軸評価）と人間の確認を経てから公開します。

## 公開（GitHub Pages）

`main` への push で CI（`bun run verify` と Docker の検証）が走り、成功すると検証済みの成果物をそのまま GitHub Pages に公開します。公開は初期状態では無効です。

1. Settings → Pages → Source を「GitHub Actions」にする
2. Settings → Secrets and variables → Actions → Variables に `PAGES_DEPLOY_ENABLED` = `true` を追加する
3. `main` に push する

詳しくは [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#10-ci--デプロイ) と [ADR-0009](docs/decisions/0009-ci-cd-verified-artifact-deploy.md) を参照してください。

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Claude Code が毎回読むプロジェクトの要点 |
| [docs/SPEC.md](docs/SPEC.md) | 要件定義 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | アーキテクチャ・ビルドパイプライン |
| [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | 記事の書き方・評価基準・公開の流れ |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | デザイントークン・コンポーネント |
| [docs/HARNESS.md](docs/HARNESS.md) | Claude Code ハーネス（Rules・Skills・Agents・Hooks・権限） |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開発環境・コマンド・CI |
| [docs/EVALUATION.md](docs/EVALUATION.md) | ハーネス・品質ゲート・記事の評価結果と既知の課題 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | フェーズと今後の予定 |
| [docs/decisions/](docs/decisions/) | 設計判断の記録（ADR） |

## 技術スタック

React 19 / React Router 8（Framework Mode, SSG）/ Vite 8 / TypeScript 6 / Tailwind CSS 4 / MDX / Mermaid / KaTeX / Shiki / Pagefind / Zod / Vitest / React Testing Library / Playwright / Docker（Node.js 26, nginx）/ GitHub Actions / GitHub Pages
