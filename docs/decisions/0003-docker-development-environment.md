# 0003. Docker 開発環境

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- 開発・検証を Docker で再現可能にする。本番コンテナに Node.js や開発依存を含めない。
- Playwright はパッケージとブラウザのバージョン不一致で失敗しやすい。
- Claude Code の認証情報をコンテナに渡さない。

## 決定

- マルチステージ Dockerfile：`deps`（npm ci）→ `dev`（Vite dev, 0.0.0.0:5173）→ `builder`（npm run build, `ARG BASE_PATH`）→ `production`（`nginxinc/nginx-unprivileged:1.31.7-alpine`、8080、uid 101、`build/client` と `docker/nginx.conf` のみ）。
- `qa` ステージ：`deps` から派生し、`npx playwright install --with-deps chromium` を実行。
- `compose.yaml`：`web`（bind mount + named volume の node_modules、`127.0.0.1:5173`）、`preview`（profile、`127.0.0.1:8080`）、`qa`（profile、ポートなし、別 volume）。
- Claude Code はホストで実行し、検証コマンドは `docker compose exec` / `run` で実行する。

## 理由

- qa イメージは lockfile の `@playwright/test` と同じ版の CLI でブラウザを入れるため、常に版が一致する（公式 Playwright イメージの版固定に依存しない）。
- nginx-unprivileged により非 root で配信できる。
- ポートを 127.0.0.1 に限定し、外部ネットワークへ公開しない。
- Claude Code をコンテナ外に置くことで、認証情報や Docker ソケットをコンテナに渡さずに済む。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| `mcr.microsoft.com/playwright` イメージ | Node 版・Playwright 版を lockfile と別に管理する必要がある |
| Vite preview を本番サーバーに | SPEC で禁止 |
| 公式 `nginx` イメージ（root） | 非 root 要件 |
| Claude Code をコンテナ内で実行 | 認証情報のコピーが必要になる |

## 影響

- named volume の node_modules は lockfile 変更時に `npm ci` で更新が必要（[DEVELOPMENT.md](../DEVELOPMENT.md)）。
- Docker が使えない環境では検証が「未検証」になる。
- Docker 操作は強力なため、Permissions で個別コマンドのみ許可する。

## 追記（2026-11-28）

- `qa` の `node_modules` は named volume ではなく **匿名 volume**（`docker compose run --rm` のたびに qa イメージの内容から作られる）。lockfile を変えたら `docker compose build qa` が必要。
- `qa` イメージには hooks のテスト（一時 git リポジトリ）用に `git` を追加した。全サービスで `cap_drop: ALL`・`no-new-privileges` を設定し、preview は読み取り専用ルートファイルシステムで動かす。
