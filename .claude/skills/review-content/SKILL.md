---
name: review-content
description: 記事を technical-reviewer で独立レビューし、5軸評価と指摘一覧を出す（既定では編集しない）。「この記事をレビューして」「〇〇カテゴリを品質チェックして」「公開してよいか確認して」「review the article」のような依頼で使う。
argument-hint: "<記事ファイルパス | slug | カテゴリslug> [--apply]"
---

# review-content

対象: $ARGUMENTS

## 手順

1. 対象を解決する:
   - ファイルパス → そのまま
   - slug → `src/content/**/<slug>.mdx` を Glob
   - カテゴリ slug → `src/content/<category>/*.mdx` を Glob（多い場合は対象一覧を示して順に処理）
   - 見つからなければ候補を挙げて終了する。
2. 機械的検証: `package.json` に `content:check` があれば `docker compose exec web npm run content:check` を実行し結果を記録する（無ければ「未整備」、Docker 不可なら「未検証」）。
3. 各記事について `technical-reviewer` サブエージェントを新しいコンテキストで起動し、**ファイルパスのみ**を渡す。複数記事は並列起動してよい（読み取り専用のため）。
4. 図解を含む記事で表示確認が必要なら `visual-reviewer` を起動する。
5. 結果を集約して報告する。
6. 編集はしない。ユーザーが修正適用を求めた場合（`--apply` または明示的な依頼）のみ、blocker → major の順に修正し、`content:check` と再レビューを行う。

## 出力形式

```
## 対象
## 総合判定（記事ごと: 公開可 / 要修正 / 公開不可）
## 5軸評価
| 記事 | 技術的正確性 | 分かりやすさ | 図解・具体例 | 文章・構成 | 出典の信頼性 |
## 指摘一覧（重大度順）
| 記事 | 重大度 | ファイル:行 | 問題 | 修正案 |
## 機械的検証の結果
## 人間の確認が必要な点
```

全軸4点以上かつ blocker なしが公開目安。LLMの採点だけで技術的正確性を保証しないことを明記する。
