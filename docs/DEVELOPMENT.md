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

- `web` はソースを bind mount（`.:/app`）、`node_modules` は named volume。`qa` は匿名 volume を使い、`docker compose run --rm` のたびに qa イメージ内の `node_modules` から作り直される（lockfile とイメージが常に一致）。
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
| qa の依存も更新する | `docker compose build qa`（qa は匿名 volume のため、イメージ再ビルドで反映される） |
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
docker compose exec web npm run build:subpath        # → build-subpath/client（BASE_PATH=/it-knowledge-base/）
# preview イメージをサブパスで作る場合
BASE_PATH=/it-knowledge-base/ docker compose --profile preview up -d --build preview   # http://127.0.0.1:8080/it-knowledge-base/
```

- 既定は `BASE_PATH=/`。`verify` はルート・サブパスの両方をビルドしてリンク検証し、E2E は fixture コンテンツでサブパス配信を検証する。
- React Router はサブパス配下にページを出力するため、`postbuild` が成果物ルートへ移動する（ADR-0006）。

## 6.1 下書き記事の表示確認・スクリーンショット

下書き（`draft: true`）は本番ビルドに含まれない。開発サーバー（`dev`）では表示される。レビュー用の静的ビルドとスクリーンショットは次のとおり（**確認専用。CI・デプロイでは使えない**）。

```bash
docker compose run --rm qa sh -c "npm run build:drafts && node scripts/screenshots.mjs --dir build-drafts/client /fundamentals/cpu/"
# → test-results/screenshots/<page>-<light|dark>-<desktop|mobile>.png
#   Mermaid の描画エラーと横スクロールの発生も検出して報告する
```

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
| `test:e2e` | `build:e2e` → Playwright（site / fixture / mobile / subpath プロジェクト） |
| `build` | content:generate → react-router build → postbuild → pagefind（`build/client`） |
| `build:subpath` | GitHub Pages 用（`BASE_PATH=/it-knowledge-base/` → `build-subpath/client`） |
| `build:e2e` | fixture コンテンツでルート・サブパスをビルド（E2E 用） |
| `build:drafts` | 下書きを含む確認用ビルド（`build-drafts/client`、CI では禁止） |
| `screenshots` | 静的ビルドのページをライト/ダーク × デスクトップ/モバイルで撮影 |
| `serve` | GitHub Pages と同じ規則で静的ファイルを配信（E2E 用、本番サーバーではない） |
| `links:check` / `links:check:subpath` | ビルド成果物の内部リンク・アンカー検証（`--external` で外部リンクを警告として確認） |
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
8. 静的サイトビルド（`build`）、8b. サブパスビルド（`build:subpath`）
9. 内部リンク検証（`links:check`）、9b. サブパスのリンク検証
10. Playwright E2E（`test:e2e`。fixture のビルドを含む）

hooks・Docker・GitHub Actions は同じ `scripts/verify.mjs` を共有する。

## 9. トラブルシューティング

| 症状 | 確認・対処 |
| --- | --- |
| `port is already allocated`（5173 / 8080） | `lsof -i :5173` で占有プロセスを確認。別の compose プロジェクトや `npm run dev` が残っていないか |
| ファイルを保存しても画面が更新されない | `docker compose logs -f web` でエラー確認 → 5 章の polling を試す |
| `Cannot find module` / 依存が古い | 4 章の `docker compose run --rm web npm ci` |
| 生成ファイルの所有者が root になる | web / qa は `node` ユーザー（uid 1000）で動く。Linux ホストで uid が異なる場合は所有者が 1000 になる点に注意 |
| `Cannot connect to the Docker daemon` | Docker Desktop / dockerd が起動しているか確認。Claude Code の検証はこの場合「未検証」と報告される |
| 検索が動かない（開発サーバー） | 仕様。検索インデックスはビルド後のみ生成される。`preview` で確認する |
| 存在しない URL がトップに飛ぶ | nginx 設定の誤り。SPA フォールバックではなく `404.html` を返す設定か確認 |

## 10. CI / デプロイ

- `.github/workflows/ci.yml`：PR と `main` への push で `npm run verify`（Node は `.node-version`）、Playwright レポート保存、Docker（dev / production）のビルドと nginx コンテナのスモークテスト。`main` では検証済みのサブパスビルドを `site` アーティファクトとして保存する。
- `.github/workflows/deploy.yml`：CI 成功後、**検証済みアーティファクトをそのまま** GitHub Pages へ公開する。リポジトリ変数 `PAGES_DEPLOY_ENABLED=true` を設定するまで動かない。
- 初回公開の手順（所有者の承認が必要）：Settings → Pages → Source を「GitHub Actions」にする → Settings → Variables に `PAGES_DEPLOY_ENABLED=true` → `main` へ push。
- Action はコミット SHA で固定している。更新時は SHA とコメントのバージョンを合わせて変更する。
