---
paths:
  - "tests/**"
  - "scripts/verify.mjs"
  - "playwright.config.ts"
  - "vitest.config.ts"
---

# テスト規約

詳細は `docs/DEVELOPMENT.md`（実行方法）と `docs/EVALUATION.md`（ハーネス評価）。

## 配置

- `tests/unit/`: 純粋関数（content-schema、TOC、関連記事、シミュレーター計算など）。Vitest。
- `tests/components/`: React コンポーネント。Vitest + React Testing Library + jsdom。
- `tests/e2e/`: Playwright（Chromium）。SPEC §15 の項目、ルート配信とサブパス配信の両方。プロジェクトは `site`（実コンテンツ）/ `fixture` / `mobile` / `subpath`（`playwright.config.ts`）。
- `tests/harness/`: Hooks・Permissions・コンテンツ検証の正常系 / 異常系。
- `tests/fixtures/`: テスト用の記事・入力。本番コンテンツ（`src/content/`）に依存しない（`site.spec.ts` を除く）。`content/valid/` は E2E 用サイト、`content/invalid/<case>/` は `content:check` の異常系。

## 原則

- テストを通すために仕様を変えたり、失敗するテストを削除・`skip`・期待値緩和しない。失敗したら実装を直すか、仕様の問題として報告する。
- `.only` をコミットしない。`skip` / `fixme` には理由と Issue / TODO の参照を付ける。
- 計算・変換ロジックを追加・変更したら必ずユニットテストを追加する。
- RTL ではロール・ラベル等ユーザーに見えるもので要素を取得する（`getByRole` 優先、`data-testid` は最終手段）。
- E2E は固定 `sleep` を使わず、Web-first アサーション（`expect(locator).toBeVisible()` 等）で待つ。
- E2E ではコンソールの JS エラー、Mermaid 描画エラー（`data-mermaid-error`）を検知して失敗させる。
- 危険な操作（削除・push・prune）は実行せず fixture の入力で検証する。

## verify

- `scripts/verify.mjs` の順序は SPEC §13 の10段階（ビルドとリンク検証はサブパス版 8b / 9b を含む）。最初の失敗で停止し非ゼロ終了、最後に要約を出力。`--quick` は 1〜7（typecheck・lint・lint:md・format:check・content:check・unit・components）のみ。
- Hooks・Docker・CI で同じ `npm run verify` を共有する。別系統の検証を作らない。
- 実行コマンド: `docker compose run --rm qa npm run verify`（反復中は `-- --quick`）。
- 実行していないテストを成功と報告しない。Docker 不可時は「未検証」と報告する。
