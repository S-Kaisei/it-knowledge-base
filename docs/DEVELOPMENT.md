# 開発ガイド

> Docker 環境・npm scripts は **未実装**。本書の手順は設計上の想定であり、Phase 1 で実際に動作確認して更新する。

## 1. 前提

| ツール | 必須 | 備考 |
| --- | --- | --- |
| Docker（Docker Desktop / Docker Engine + Compose v2） | ○ | 開発・検証はすべてコンテナで実行 |
| Git | ○ | |
| Node.js 26（ホスト） | 任意 | Claude Code の hooks 実行やエディタ補完用。ビルド・テストはコンテナで行う |
| Claude Code | 任意 | ホストで実行する（コンテナには入れない） |

コンテナの Node.js は `node:26.13.1-bookworm-slim` に固定（[ADR 0002](./decisions/0002-node-and-library-versions.md)）。

## 2. Compose サービス

| サービス | Dockerfile target | 起動 | ポート | 用途 |
| --- | --- | --- | --- | --- |
| `web` | `dev` | 常用 | `127.0.0.1:5173` | Vite 開発サーバー（HMR） |
| `preview` | `production` | `--profile preview` | `127.0.0.1:8080` | nginx（非 root）で本番相当の静的配信 |
| `qa` | `qa` | `docker compose run --rm qa ...` | なし | 型・lint・テスト・ビルド・E2E（Chromium） |

- `web` はソースを bind mount（`.:/app`）、`node_modules` は named volume。`qa` は別の named volume を使う。
- privileged・Docker ソケット・ホームディレクトリのマウントはしない。

## 3. 基本コマンド

```bash
# 開発サーバーの起動（初回・Dockerfile 変更時は --build）
docker compose up -d --build web
# ログ確認（Ctrl+C で抜ける。コンテナは止まらない）
docker compose logs -f web
# 個別の検証（起動中の web コンテナ内で実行）
docker compose exec web npm run typecheck
docker compose exec web npm run lint
docker compose exec web npm run test
docker compose exec web npm run build
# 全品質ゲート（qa コンテナ単体で実行可能）
docker compose run --rm qa npm run verify
# 本番相当の配信確認 → http://127.0.0.1:8080/
docker compose --profile preview up -d --build preview
# 停止（volume は削除しない）
docker compose down
```

- `docker compose down -v` や `docker volume rm` / `docker system prune` は volume を消すため、必要な場合のみ明示的に実行する（Claude Code には無断実行させない）。

## 4. 依存関係の変更

`node_modules` は named volume にあり、イメージ再ビルドだけでは **既存 volume の中身は更新されない**（volume が空のときだけイメージの内容で初期化される）。

| 状況 | 手順 |
| --- | --- |
| パッケージを追加・更新する | `docker compose exec web npm install <pkg>@<version>` → bind mount 経由で `package.json` / `package-lock.json` が更新される |
| 他者の lockfile 変更を取り込んだ（pull 後） | `docker compose run --rm web npm ci` で web の volume を lockfile と一致させ、`docker compose restart web` |
| qa の依存も更新する | `docker compose run --rm qa npm ci` |
| イメージ側も更新する（CI・preview と揃える） | `docker compose build web qa` |
| Playwright を更新した | `docker compose build qa`（qa イメージで `npx playwright install --with-deps chromium` が再実行され、ブラウザ版が一致する） |

- `package-lock.json` は必ずコミットする。再現インストールは `npm ci`。
- ホスト側で `npm install` しない（ホストとコンテナで node_modules の内容が混ざるのを避ける）。

## 5. HMR が効かない場合（polling）

macOS / Windows の一部環境や WSL のマウント越しでは、ファイル変更イベントがコンテナに届かないことがある。その場合のみ polling を有効にする。

```bash
CHOKIDAR_USEPOLLING=true VITE_USE_POLLING=true docker compose up -d web
```

- polling は CPU 負荷が上がるため既定では無効。

## 6. base path ビルド

GitHub Pages（`https://<user>.github.io/it-knowledge-base/`）向けはサブパスでビルドする。

```bash
docker compose exec -e BASE_PATH=/it-knowledge-base/ web npm run build
# preview イメージは ARG で渡す
docker compose --profile preview build --build-arg BASE_PATH=/it-knowledge-base/ preview
```

- 既定は `BASE_PATH=/`。ルート・サブパスの両方を E2E で検証する（[ARCHITECTURE.md](./ARCHITECTURE.md#4-base-pathphase-1-で実装予定)）。

## 7. npm scripts

| script | 内容 |
| --- | --- |
| `dev` | Vite 開発サーバー（コンテナ内 `0.0.0.0:5173`） |
| `typecheck` | `react-router typegen && tsc --noEmit` |
| `lint` | ESLint |
| `lint:md` | markdownlint-cli2 |
| `format` / `format:check` | Prettier（書き込み / 確認のみ） |
| `content:generate` | `src/generated/content-index.json` を生成 |
| `content:check` | frontmatter・slug・リンク・見出し・プレースホルダー・Mermaid・KaTeX の検証 |
| `test` | Vitest（unit + components） |
| `test:e2e` | Playwright |
| `build` | content:generate → react-router build → postbuild → pagefind |
| `links:check` | ビルド成果物の内部リンク検証（外部リンク障害は警告扱い） |
| `verify` | 品質ゲート一式。`--quick` で typecheck + lint + content:check + test のみ |

## 8. verify の順序

`npm run verify` は以下を順に実行し、最初の失敗で停止して非ゼロ終了、最後に要約を出力する。

1. 型チェック（`typecheck`）
2. ESLint（`lint`）
3. Markdownlint（`lint:md`）
4. Prettier（`format:check`）
5. コンテンツ構造検証（`content:check`）
6. ユニットテスト
7. コンポーネントテスト
8. 静的サイトビルド（`build`）
9. 内部リンク検証（`links:check`）
10. Playwright E2E（`test:e2e`）

hooks・Docker・GitHub Actions は同じ `scripts/verify.mjs` を共有する。

## 9. トラブルシューティング

| 症状 | 確認・対処 |
| --- | --- |
| `port is already allocated`（5173 / 8080） | `lsof -i :5173` で占有プロセスを確認。別の compose プロジェクトや `npm run dev` が残っていないか |
| ファイルを保存しても画面が更新されない | `docker compose logs -f web` でエラー確認 → 5 章の polling を試す |
| `Cannot find module` / 依存が古い | 4 章の `docker compose run --rm web npm ci` |
| 生成ファイルの所有者が root になる | コンテナを非 root ユーザーで実行する設定か確認（Phase 1 で確定）。`sudo chown` で戻す前に原因を確認 |
| `Cannot connect to the Docker daemon` | Docker Desktop / dockerd が起動しているか確認。Claude Code の検証はこの場合「未検証」と報告される |
| 検索が動かない（開発サーバー） | 仕様。検索インデックスはビルド後のみ生成される。`preview` で確認する |
| 存在しない URL がトップに飛ぶ | nginx 設定の誤り。SPA フォールバックではなく `404.html` を返す設定か確認 |
