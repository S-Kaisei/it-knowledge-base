# 0010. パッケージマネージャーを npm から bun に移行する

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- 当初は SPEC §3 に従い npm（`package-lock.json`、`npm ci`）を採用していた（ADR-0002）。
- プロジェクトオーナーから、全フェーズ完了後に npm から bun へ変更するよう依頼があった。
- React Router（Framework Mode）・Vite・Vitest・Playwright・Pagefind などのツール群は Node.js 上での動作が前提で、Node 26 で全品質ゲートを検証済み。

## 決定

- **bun 1.4.5 をパッケージマネージャー兼スクリプトランナーにする**。ロックファイルは `bun.lock`、再現インストールは `bun install --frozen-lockfile`、依存追加は `bun add`。`package.json` に `"packageManager": "bun@1.4.5"` を記載する。
- **JavaScript の実行環境は Node.js 26 のまま**とする。`bun run <script>` は package.json のスクリプトをシステムシェルで実行し、各ツールの実行ファイル（`#!/usr/bin/env node`）は Node.js で動く。`bun x` はパッケージが無いとネットワークから取得するため使わず、`bun run <bin>` か `./node_modules/.bin/<bin>` を使う。
- Docker は `oven/bun:1.4.5-debian` から bun のバイナリだけを Node 26 イメージにコピーする（実行ユーザーは引き続き `node`）。
- CI は `actions/setup-node`（`.node-version`）と `oven-sh/setup-bun`（SHA 固定、1.4.5）を併用する。
- Hooks（stop-check / post-edit / session-start）、権限の許可リスト、Rules・Skills・Agents・docs のコマンドを `bun run` に統一する。guard-command は npm に加えて `bun publish`（拒否）・`bunx` / `bun x` による外部デプロイ（確認）を判定する。

## 理由

- 依存のインストールが速く、`bun.lock` がテキスト形式で差分を確認しやすい。
- 実行環境を Node のまま据え置くことで、検証済みのビルド・テスト結果への影響を最小にできる（移行前後で全品質ゲートを再実行して確認）。

## 代替案

- 実行環境も bun にする（`bun --bun run`）：React Router のビルド・prerender、Vitest、Playwright の互換性を個別に検証する必要があり、得られる利点に比べてリスクが大きいため見送り。必要になれば別 ADR で検討する。

## 影響

- バージョンの固定箇所は Dockerfile の `BUN_VERSION`、`package.json` の `packageManager`、`ci.yml` の `bun-version` の 3 か所。更新時はそろえる。
- `package-lock.json` から `bun.lock` への移行で、直接依存のバージョンはすべて同一であることを確認した（間接依存は巻き上げ位置のみ差がある）。
- web コンテナの `node_modules`（named volume）は移行時に `docker compose exec web bun install --frozen-lockfile` で入れ替える。
