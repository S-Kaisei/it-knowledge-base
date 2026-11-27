# IT Knowledge Base

ITの仕組みを、基礎から実践まで。

CPU・メモリからネットワーク、クラウド、AI までの IT 技術を、図解と具体例で体系的に解説する日本語の技術ドキュメントサイトです。React Router（静的事前レンダリング）と Vite で構築し、GitHub Pages で公開します。

> 現在は初期構築中です。進捗は [docs/ROADMAP.md](docs/ROADMAP.md) を参照してください。

## 開発

前提: Docker（Docker Compose v2）と Git。

```bash
docker compose up -d --build web   # http://127.0.0.1:5173
docker compose run --rm qa npm run verify
docker compose down
```

詳しい手順は [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照してください。

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | 要件定義 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | アーキテクチャ |
| [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | 記事の書き方・評価基準 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | デザインシステム |
| [docs/HARNESS.md](docs/HARNESS.md) | Claude Code ハーネス |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開発環境 |
| [docs/EVALUATION.md](docs/EVALUATION.md) | 評価結果 |
| [docs/decisions/](docs/decisions/) | 設計判断の記録（ADR） |
