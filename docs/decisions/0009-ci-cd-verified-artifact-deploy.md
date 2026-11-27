# 0009. CI/CD：検証済み成果物をそのまま公開する

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- SPEC §20 は「必須検証に成功した main の成果物のみをデプロイし、検証済み成果物と公開成果物を一致させる」「公開環境の変更や初回デプロイはユーザー承認後」を求める。
- ビルドを CI とデプロイで 2 回行うと、依存やタイミングの差で「検証したものと違うもの」を公開しうる。
- サードパーティの GitHub Actions はタグの付け替えで中身が変わりうる（サプライチェーンリスク）。

## 決定

- `ci.yml`（PR / main push）で `npm run verify` を実行し、`main` では検証に使ったサブパスビルド（`build-subpath/client`）をそのまま `site` アーティファクトとして保存する。
- `deploy.yml` は `workflow_run`（CI 成功・main・push）で起動し、**再ビルドせず** `site` アーティファクトを GitHub Pages に公開する。
- デプロイはリポジトリ変数 `PAGES_DEPLOY_ENABLED == 'true'` のときだけ動く。初期状態では無効で、所有者が公開を承認して有効化する。
- 全 Action をコミット SHA で固定し、ワークフローの既定権限は `contents: read`（deploy は `pages: write` / `id-token: write` / `actions: read` のみ）。
- CI の Node は `.node-version` を参照し、Docker（`node:26.13.1`）とローカルの設定と揃える。Playwright のブラウザはパッケージ自身の CLI で導入する。

## 理由

- 検証と公開の成果物が同一であることを構造で保証できる。
- 公開の有効化を変数 1 つに集約でき、誤って push しても公開されない。

## 代替案

- deploy ジョブを ci.yml 内に置く：仕組みは単純になるが、SPEC のファイル構成（ci.yml / deploy.yml）と分離の意図に合わないため不採用。
- デプロイ時に再ビルド：検証済み成果物との一致を保証できないため不採用。

## 影響

- `site` アーティファクトの保持期間（7 日）を過ぎた CI 実行からは再デプロイできない（再実行すればよい）。
- Action の更新は SHA の差し替えが必要（Dependabot の導入は将来検討）。

## 追記（2026-11-28・bun 移行）

CI は `oven-sh/setup-bun`（SHA 固定）で bun 1.4.5 を導入し、`bun install --frozen-lockfile` と `bun run verify` を実行する。Node.js は `actions/setup-node` で `.node-version` から導入する（[ADR-0010](./0010-bun-package-manager.md)）。
