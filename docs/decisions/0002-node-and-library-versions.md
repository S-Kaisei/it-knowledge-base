# 0002. Node.js とライブラリのバージョン

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- SPEC は「公式ドキュメントで確認した互換性のある安定版」「Node.js を Docker・ローカル・CI で統一」を求める。
- 2026-11-28 時点で npm レジストリ上の最新安定版と peer 依存範囲を確認した。

## 決定

Node.js **26.13.1**（Active LTS "Lithium"）。Docker イメージは `node:26.13.1-bookworm-slim`。npm は同梱の 11 系。

| パッケージ | バージョン |
| --- | --- |
| react / react-dom | 19.3.1 |
| react-router / @react-router/dev / @react-router/node | 8.5.3（engines: node >= 22.22） |
| vite | 8.4.0 |
| typescript | 6.0.3 |
| tailwindcss / @tailwindcss/vite | 4.3.5 |
| @mdx-js/rollup | 3.1.1 |
| remark-gfm / remark-math / rehype-katex / rehype-slug | 4 / 6 / 7 / 6 |
| katex | 0.19.1 |
| shiki | 4.6 |
| mermaid | 12.4.0 |
| pagefind | 1.6.0 |
| zod | 4.6.7 |
| gray-matter / github-slugger | 4 / 2 |
| lucide-react | 1.82 |
| vitest | 5.1.2 |
| @testing-library/react / @testing-library/jest-dom | 16.3.3 / 8 |
| jsdom | 31 |
| @playwright/test | 1.65.1 |
| eslint / typescript-eslint | 10.15 / 8.74 |
| prettier | 3.10.1 |
| markdownlint-cli2 | 0.24.2 |
| nginx | `nginxinc/nginx-unprivileged:1.31.7-alpine` |

## 理由

- Node 26 は Active LTS であり、React Router 8 の engines を満たす。ネイティブ型ストリッピングで `.mjs` スクリプトから `.ts` の Zod スキーマを直接 import できる。
- **TypeScript は 7 ではなく 6.0**：typescript-eslint 8.74 の peer 範囲が `typescript < 6.1` のため。
- 実際の版は `package-lock.json` で固定し、`npm ci` で再現する。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| TypeScript 7 | typescript-eslint の peer 範囲外 |
| Node 24（Maintenance LTS） | 26 が Active LTS であり、型ストリッピング等の機能を活用できる |
| `^` 範囲のみで lockfile 任せ | 意図した版がドキュメントに残らない |

## 影響

- typescript-eslint が TypeScript 7 に対応した時点で、新しい ADR で更新を検討する。
- Node のバージョンは Dockerfile、`package.json` の `engines`、CI で一致させる。
