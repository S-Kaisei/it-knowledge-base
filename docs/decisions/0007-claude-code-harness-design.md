# 0007. Claude Code ハーネスの設計

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- 継続的に記事・機能を追加できる開発基盤として、コンテキスト・権限・検証・レビューをリポジトリ内に持つ必要がある。
- 常時読み込まれる CLAUDE.md が肥大化すると、重要な指示が埋もれる。
- 指示（プロンプト）だけでは「読み取り専用」「危険操作の禁止」「検証の実行」を保証できない。

## 決定

| 層 | 役割 |
| --- | --- |
| CLAUDE.md | 毎回必要な最小限の情報 |
| Rules | 領域別規約。常時必要なもの以外は `paths` で読み込み対象を限定 |
| Skills | 7 つの手順書。副作用の大きい `release` は手動起動のみ |
| Subagents | 6 役割。読み取り専用は `tools` allowlist（Edit / Write / Bash なし）で強制 |
| Hooks | SessionStart（コンテキスト供給）、PreToolUse（危険コマンド拒否）、PostToolUse（軽量検証）、Stop（品質ゲート） |
| Permissions | 最小権限。`Bash(*)` や `docker compose exec *` を許可しない |

Stop hook は `stop_hook_active` と `.claude/.state/` の独自試行カウンタでループを防ぎ、変更なしならスキップ、Docker 不可なら「未検証」扱い、スクリプト未作成ならスキップする。

## 理由

- 決定的に守るべきこと（ガード、検証）は hooks / permissions / tools allowlist に、判断を伴う手順は skills に置く。
- `paths` 付き rules により、関係するファイルを触るときだけ規約が読み込まれ、コンテキストを節約できる。
- Bash を持つエージェントは任意の書き込みが可能なため、読み取り専用はツール集合で定義する必要がある。
- Stop hook の無条件 block は無限ループを招く。Claude Code 側の上限（連続 8 回）に加えて自前で上限を持つ。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| すべてを CLAUDE.md に記載 | 肥大化し、指示の遵守率が下がる |
| プロンプトで「編集しないこと」と指示 | 強制力がない |
| Stop hook で毎回フル verify | 時間がかかり、変更なしタスクでも実行される |
| `Bash(*)` 許可 + hooks で制限 | hooks はセキュリティ境界ではない |

## 影響

- hooks / permissions はセキュリティ境界ではない（サブプロセス経由の操作には効かない）ことを [HARNESS.md](../HARNESS.md) に明記する。
- hooks はホストの Node.js で動作するため、依存パッケージを持たない。
- 動作確認は単体テストに加え、実際の Claude Code セッションでのイベント発火で行う（[EVALUATION.md](../EVALUATION.md)）。

## 追記（2026-11-28）

実装との差分（層構成の決定は変更なし）：

- 手動起動のみの Skill は `release` と `verify-site` の 2 つ（`disable-model-invocation: true`）。
- Stop hook は `stop_hook_active` だけで再ブロックを抑止するのではなく、「前回失敗時から変更なし」の場合に抑止する。上限は既定 3 回。Docker 不可時は一度だけ block して「未検証」の明記を求める。入力の `background_tasks` に実行中のタスクがある間はゲートを保留する（サブエージェントの作業途中を検証しない）。
- PreToolUse は Bash に加えて Read / Edit / Write / NotebookEdit にも適用し、秘密ファイルの参照とプロジェクト外への書き込みを判定する。
- H1〜H15 の評価はすべて成功（[EVALUATION.md](../EVALUATION.md)）。
