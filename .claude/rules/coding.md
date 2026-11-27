---
paths:
  - "src/**/*.{ts,tsx}"
  - "scripts/**"
  - "tests/**"
  - "*.config.{ts,mjs,js}"
---

# コーディング規約

詳細は `docs/ARCHITECTURE.md` と `docs/DEVELOPMENT.md`。

## TypeScript

- strict mode を維持する。`any`、`@ts-ignore`、`@ts-expect-error`（理由コメントなし）、非nullアサーション `!` の乱用を禁止。
- 外部入力（Frontmatter、JSON、URLパラメータ）は Zod で検証してから使う。スキーマの唯一の定義元は `src/lib/content-schema.ts`。
- 型はコンテンツ関連なら `src/lib/content-schema.ts`（Zod から導出）、それ以外は利用箇所の近くに置く。純粋ロジックは `src/lib/`、React フックは `src/hooks/` に置く。
- コード識別子・コメントは英語可。UI文言は日本語。

## React / React Router

- 関数コンポーネントのみ。props は明示的な型を定義する。
- ブラウザ専用API（`window`、`document`、`localStorage`、`matchMedia`）は `useEffect` 内かイベントハンドラ内でのみ使う。prerender中に実行されるコードに書かない。
- 内部リンクは React Router の `<Link>` を使い、base path を直書きしない。
- 記事データは `src/generated/content-index.json` 経由で参照する。`src/content/` をランタイムで走査しない。
- 計算・変換ロジック（シミュレーター、TOC生成、関連記事算出など）は純粋関数として分離し、ユニットテストを書く。

## scripts/

- Node 26 の ESM（`.mjs`）。TypeScript ファイルの import はネイティブ型ストリッピングに依存（型専用構文以外を使わない）。
- 失敗時は原因（ファイルパス・行・理由）を出力し、非ゼロで終了する。外部リンクの通信失敗と内部リンク切れは区別して報告する。
- ファイルシステム走査はリポジトリ内に限定する。

## 品質

- ESLint / Prettier の警告を無視・一括disableしない。`eslint-disable` は行単位かつ理由コメント付き。
- 未使用コード・デバッグ用 `console.log` を残さない。
- 依存追加は必要最小限、バージョン固定。shadcn/ui は必要なコンポーネントだけ追加する。
- 変更後は `docker compose exec web bun run typecheck` と `lint`、ロジック変更時は `test` を実行する。
