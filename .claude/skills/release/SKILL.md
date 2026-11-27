---
name: release
description: リリース準備として全検証を実行し、main との差分を要約して PR 本文の下書きを作る。push・PR作成・デプロイはユーザーの明示承認があるまで行わない。「リリース準備」「PRの準備をして」「release」で手動起動する。
argument-hint: "[PRタイトル案や補足]"
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git status)
  - Bash(git branch --show-current)
  - Bash(git log --oneline main..HEAD)
  - Bash(git diff main...HEAD --stat)
  - Bash(git diff main...HEAD)
  - Bash(docker compose run --rm qa npm run verify)
---

# release

補足: $ARGUMENTS

## 手順

1. 状態確認: `git status`、`git branch --show-current`。main ブランチ上、または未コミット変更がある場合はその旨を報告し、続行してよいかユーザーに確認する。
2. 検証: `package.json` の `verify` を確認のうえ `docker compose run --rm qa npm run verify` を実行する（未整備なら「未整備」、Docker 不可なら「未検証」）。失敗があればリリース不可として結果を報告し終了する。
3. 差分要約: `git log --oneline main..HEAD`、`git diff main...HEAD --stat`、必要に応じ `git diff main...HEAD` を読み、変更を分類する（機能 / 記事 / ハーネス / Docker・CI / ドキュメント）。
4. 公開影響の確認: 新規公開記事（`draft: false` になったもの）、base path・デプロイ設定・Actions 権限の変更、依存の更新を列挙する。
5. PR 本文の下書きを作成する（下記形式）。AI による生成を示す署名行や共同作成者行は含めない。
6. 次のアクション（push / PR作成 / デプロイ）を提案し、**ユーザーが現在の会話で明示的に承認するまで実行しない**。承認後も、承認された操作だけを行う。

## PR 本文の形式

```text
## 概要
## 変更内容（分類別）
## 追加・更新した記事（slug / draft 状態 / レビュー結果）
## 検証結果（コマンドと結果。未実行・未検証は明記）
## 公開・デプロイへの影響
## 既知の課題 / レビュー観点
```

## 禁止事項

- 承認なしの `git push`、`gh pr create`、タグ作成、デプロイ、GitHub Pages 設定変更。
- 検証失敗や未検証を隠した PR 本文。
- 強制 push、履歴の書き換え。
