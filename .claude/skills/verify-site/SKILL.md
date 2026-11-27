---
name: verify-site
description: QAコンテナで bun run verify（型チェック〜E2E の全品質ゲート）を実行し、各ステップの結果を報告する。コードは変更しない。「検証して」「verifyを回して」「品質ゲートを確認」「run verify」で手動起動する。
argument-hint: "[--quick]"
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(docker compose run --rm qa bun run verify)
  - Bash(docker compose run --rm qa bun run verify -- --quick)
  - Bash(docker compose version)
  - Bash(docker info)
---

# verify-site

引数: $ARGUMENTS

## 手順

1. 前提確認:
   - `package.json` を Read し、`verify` script と `scripts/verify.mjs` の有無を確認する。無ければ「未整備」と報告して終了する。
   - `docker compose version` と `docker info` で Docker が使えるか確認する。使えなければ「未検証（Docker 不可）」と報告して終了する。ホストで bun / npm を直接実行して代替しない。
2. 実行:
   - 引数に `--quick` があれば `docker compose run --rm qa bun run verify -- --quick`
   - それ以外は `docker compose run --rm qa bun run verify`
3. 出力末尾の要約表から各ステップ（型チェック → ESLint → Markdownlint → Prettier → コンテンツ構造検証 → ユニット → コンポーネント → ビルド → サブパスビルド → 内部リンク → サブパスのリンク → E2E。`--quick` はコンポーネントまで）の結果を抽出する。最初の失敗で停止した場合、以降のステップは「未実行」とする。
4. 失敗があればログから原因箇所（ファイル:行、エラーメッセージ）を要約する。修正はしない（修正は `develop` スキル等で別途行う）。

## 出力形式

```text
## 実行環境（Docker 可否、実行日時）
## 実行コマンドと終了コード
## ステップ別結果
| # | ステップ | 結果(成功/失敗/未実行/未整備) | 要点 |
## 失敗の詳細（ファイル:行、エラー抜粋、推定原因）
## 総合判定: 成功 / 失敗 / 未検証
```

## 禁止事項

- 実行していないステップや、出力で確認できないステップを成功と報告しない。
- コード・テスト・設定を変更しない。
- `docker compose down -v`、volume 削除、prune を実行しない。
