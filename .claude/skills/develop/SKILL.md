---
name: develop
description: サイト機能・UI・コンテンツパイプライン・検証基盤の実装や不具合修正を、理解→計画→実装→レビュー→検証→修正→再検証→報告のループで進める。「〇〇を実装して」「バグを直して」「コンポーネントを追加して」「implement X」「fix X」のような開発依頼で使う。
argument-hint: "<実装・修正したい内容>"
---

# develop

依頼: $ARGUMENTS

ワークフロー（SPEC §12）: Understand → Plan → Implement → Review → Verify → Fix → Re-verify → Report

## 1. Understand

- 依頼に関係する Rules（`.claude/rules/` の architecture / coding / design / testing / docker）と docs（`docs/ARCHITECTURE.md`、`docs/DESIGN_SYSTEM.md`、`docs/DEVELOPMENT.md`、関連 ADR）を読む。
- 既存実装を Grep / Glob で把握する。`package.json` の scripts を確認する。
- 要件が SPEC と矛盾する場合は実装前にユーザーへ確認する。

## 2. Plan

- 変更ファイル、方針、追加するテスト、検証方法を短く列挙する。
- アーキテクチャ制約を変える場合は ADR（`docs/decisions/`）を計画に含める。
- 大きな作業は分割し、担当を割り当てる: UI・アプリ → `frontend-engineer`、テスト・scripts・Docker・CI → `qa-engineer`。並列化は編集ファイルが重ならない場合のみ。

## 3. Implement

- 計画したファイルのみ変更する。ロジックは純粋関数に分離し、テストを必ず書く。

## 4. Review

- 差分を自己レビューする（`git diff`）: 規約違反、prerender 中のブラウザAPI、トークン外の色、base path 直書き、不要コード。
- UI 変更は `visual-reviewer` で表示確認する。

## 5. Verify

`package.json` に script が無いものは「未整備」として記録し、スキップした事実を報告する。

- 反復中: `docker compose run --rm qa npm run verify -- --quick`
  （または `docker compose exec web npm run typecheck` / `lint` / `test` を個別に）
- 完了前: `docker compose run --rm qa npm run verify`
- Docker 不可なら「未検証」と報告する。

## 6. Fix → Re-verify

- 失敗は最初のステップから原因を特定して修正する。テストを削除・弱体化して通さない。
- 同じ失敗で3回修正しても解決しない場合は、状況と仮説を報告してユーザーに相談する。

## 7. Report

```
## Summary
## 変更ファイル
## 追加・更新したテスト
## 検証コマンドと結果（成功 / 失敗 / 未実行 / 未整備 / 未検証）
## 設計判断・ADR
## 既知の課題・次のステップ
```
