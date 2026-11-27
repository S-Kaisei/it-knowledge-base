# ADR（Architecture Decision Records）

重要な設計判断を記録する。要件（[SPEC.md](../SPEC.md)）を変更する場合も ADR を追加する。

## 一覧

| # | タイトル | ステータス | 日付 |
| --- | --- | --- | --- |
| [0001](./0001-static-site-with-react-router-prerender.md) | React Router prerender による静的サイト | Accepted | 2026-11-28 |
| [0002](./0002-node-and-library-versions.md) | Node.js とライブラリのバージョン | Accepted | 2026-11-28 |
| [0003](./0003-docker-development-environment.md) | Docker 開発環境 | Accepted | 2026-11-28 |
| [0004](./0004-content-pipeline-mdx-routes.md) | MDX をルートモジュールとするコンテンツパイプライン | Accepted | 2026-11-28 |
| [0005](./0005-search-with-pagefind.md) | Pagefind による全文検索 | Accepted | 2026-11-28 |
| [0006](./0006-github-pages-subpath-and-404.md) | GitHub Pages のサブパス配信と 404 | Accepted | 2026-11-28 |
| [0007](./0007-claude-code-harness-design.md) | Claude Code ハーネスの設計 | Accepted | 2026-11-28 |
| [0008](./0008-self-hosted-fonts.md) | フォントのセルフホスト | Accepted | 2026-11-28 |
| [0009](./0009-ci-cd-verified-artifact-deploy.md) | CI/CD：検証済み成果物をそのまま公開する | Accepted | 2026-11-28 |

## 運用

- ファイル名：`NNNN-kebab-case-title.md`（連番、欠番を作らない）。
- ステータス：`Proposed` / `Accepted` / `Superseded by NNNN` / `Deprecated`。
- Accepted の ADR は書き換えない。判断を変える場合は新しい ADR を追加し、旧 ADR のステータスを `Superseded by NNNN` に更新する。

## テンプレート

```markdown
# NNNN. タイトル

- ステータス：Proposed
- 日付：YYYY-MM-DD

## コンテキスト

なぜ判断が必要か。制約、前提。

## 決定

何を採用するか。

## 理由

採用理由。

## 代替案

検討した選択肢と不採用の理由。

## 影響

良い影響、悪い影響、今後必要になる作業。
```
