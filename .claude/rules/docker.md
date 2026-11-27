---
paths:
  - "Dockerfile"
  - "compose.yaml"
  - "docker/**"
  - ".dockerignore"
---

# Docker 規約

詳細は `docs/DEVELOPMENT.md`。

## イメージ

- ベースイメージはタグを固定（例 `node:26.13.1-bookworm-slim`、`nginxinc/nginx-unprivileged:<固定版>-alpine`）。`latest` を使わない。
- ステージ: `deps`（npm ci）→ `dev`（vite dev 0.0.0.0:5173）→ `builder`（npm run build、`ARG BASE_PATH`）→ `production`（Nginx 非root、`build/client` と `docker/nginx.conf` のみ）。`qa` は `deps` から派生し `npx playwright install --with-deps chromium`。
- `production` に Node.js・開発依存を含めない。Vite preview を本番サーバーにしない。
- 依存インストールは `npm ci`（`npm install` 不可）。
- `.env`、秘密鍵、`.git`、`node_modules`、`build`、`.claude/settings.local.json` を `.dockerignore` で除外する。

## Compose

- サービスは `web` / `preview`（profile: preview）/ `qa`（profile: qa）のみ。DB・Redis等を追加しない。
- ポートは `127.0.0.1:` にバインド（web 5173、preview 8080）。qa はポート公開なし。
- `privileged`、Docker ソケットのマウント、ホームディレクトリのマウント、Claude Code 認証情報のコピーを禁止。
- `node_modules` は web が named volume、qa は匿名 volume（毎回 qa イメージの内容から作られる）。bind mount はリポジトリのみ。
- polling（`CHOKIDAR_USEPOLLING` 等）は必要な環境でのみ有効にする。

## Nginx

- 存在する記事への直接アクセスは 200、存在しないURLは `404.html` で 404。全URLをトップへフォールバックしない。

## 運用

- `docker volume rm`、`docker system prune`、`docker compose down -v` をユーザーの承認なしに実行しない。
- Dockerfile / compose.yaml を変えたら `docs/DEVELOPMENT.md`・README のコマンドと一致させ、`docker compose build` で確認する。
- Docker が使えない環境では検証を「未検証」と報告する。ホストで代替実行して成功扱いにしない。
