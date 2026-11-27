# 評価記録

> ハーネスとコンテンツの評価計画と結果。**現時点ですべて未実施**。実行していない検証を成功と記録しない。

状態の凡例：`未実施` / `成功` / `失敗` / `未検証`（環境制約で実行不可。理由を備考に書く）

## 1. ハーネス評価（SPEC §16）

fixture は `tests/harness/` に置く。危険な操作は実際には実行せず、fixture の入力 JSON で hook を検証する。hook 単体テストだけでは「登録成功」とみなさず、Claude Code 上でのイベント発火も確認する。

| # | 検証項目 | 方法 | テスト場所 | 状態 |
| --- | --- | --- | --- | --- |
| H1 | 正常な記事追加が成功する | 正常 MDX fixture で `content:generate` → `build`、ルートと HTML 生成を確認 | `tests/harness/`, `tests/fixtures/` | 成功（`tests/harness/content-check.test.ts`（valid fixture）, `tests/e2e/`（fixture プロジェクトのビルド）） |
| H2 | 不正 Frontmatter を検出 | 必須欠落・型不正・不正日付の fixture で `content:check` が非ゼロ終了 | `tests/harness/` | 成功（`tests/harness/content-check.test.ts`（bad-frontmatter / bad-date）, `tests/harness/post-edit.test.ts`） |
| H3 | 内部リンク切れを検出 | 存在しない slug へのリンク fixture で `content:check` / `links:check` が失敗 | `tests/harness/` | 成功（`tests/harness/content-check.test.ts`（broken-link / draft-link）） |
| H4 | 重複 slug を検出 | 同一 slug 2 ファイルの fixture | `tests/harness/` | 成功（`tests/harness/content-check.test.ts`（duplicate-slug）） |
| H5 | 不正な数式・図解を検出 | KaTeX エラー / Mermaid 構文エラー fixture | `tests/harness/` | 成功（`tests/harness/content-check.test.ts`（bad-math / bad-mermaid / unknown-component）） |
| H6 | draft が公開されない | draft fixture がルート・prerender・Pagefind・sitemap に含まれないことを確認 | `tests/harness/`, `tests/e2e/` | 成功（`tests/harness/content-check.test.ts`（draft-link）, `tests/e2e/navigation.spec.ts`（ルート・sitemap）） |
| H7 | 危険コマンドの制限 | `guard-command.mjs` に危険コマンドの PreToolUse 入力を与え `deny` / `ask` を確認 | `tests/harness/` | 成功（`tests/harness/guard-command.test.ts`（deny / ask / 許可、heredoc、サブプロセス）） |
| H8 | Stop hook が失敗を検知 | 検証失敗状態で `stop-check.mjs` が block を返す | `tests/harness/` | 成功（`tests/harness/stop-check.test.ts`（一時 repo + 偽 docker）） |
| H9 | Stop hook の無限ループ防止 | `stop_hook_active: true` と試行カウンタ上限で block しないことを確認 | `tests/harness/` | 成功（`tests/harness/stop-check.test.ts`（stop_hook_active、MAX_ATTEMPTS）） |
| H10 | 読み取り専用レビュー | reviewer 系エージェントの `tools` に Edit / Write / Bash がないことを静的検査 + 実セッションで編集不可を確認 | `tests/harness/` | 成功（静的: `tests/harness/agents-readonly.test.ts`, `tests/harness/settings.test.ts`。実セッション: 2026-11-28 に technical-reviewer を 6 回起動し、いずれも Read/Grep/Glob/WebFetch/WebSearch のみで作業を完了、作業ツリーへの変更なし。ツールに Edit/Write/Bash が無いため編集を試みることもできない構成） |
| H11 | Docker 不可時の報告 | Docker 不在をシミュレートし、Stop hook が失敗ではなく「未検証」を報告 | `tests/harness/` | 成功（`tests/harness/stop-check.test.ts`, `tests/harness/session-start.test.ts`（偽 docker で不可をシミュレート）） |
| H12 | 変更なしで不要な検証をしない | クリーンな作業ツリーで Stop hook が検証をスキップ | `tests/harness/` | 成功（`tests/harness/stop-check.test.ts`（docker 呼び出し 0 回を確認）） |
| H13 | Compose 起動の再現性 | クリーン状態から `docker compose up -d --build web` → HTTP 200、`down` 後に再実行 | 手動 / CI | 成功（2026-11-28: `docker compose down` → `up -d --build web` → `/` と下書き記事が 200、ポートは 127.0.0.1 のみ。初回リクエストはオンデマンドコンパイルで約 3 秒。CI では production イメージのビルドと起動を毎回検証） |
| H14 | hooks の実イベント発火 | `claude -p` で各イベントを発火させ、`--debug` ログで実行を確認（`--bare` は使わない） | 手動 | 成功（2026-11-28, Claude Code 2.1.283, `claude -p --model haiku --debug-file …`: SessionStart が additionalContext を供給、PreToolUse で guard-command がプロジェクト外削除に ask（-p では拒否扱い）、PostToolUse で post-edit が不正 JSON を block、Stop で stop-check が CI 変更の注意を systemMessage で表示。いずれも debug ログで確認） |
| H15 | 初期構築中に開発を止めない | スクリプト未作成状態で hooks がエラー停止しない | `tests/harness/` | 成功（`tests/harness/stop-check.test.ts`, `tests/harness/post-edit.test.ts`, `tests/harness/session-start.test.ts`） |

## 2. サイト品質ゲート（SPEC §13・§15）

| # | 検証項目 | 方法 | テスト場所 | 状態 |
| --- | --- | --- | --- | --- |
| S1 | `npm run verify` 全ステップ成功 | `docker compose run --rm qa npm run verify` | `scripts/verify.mjs` | 未実施 |
| S2 | ルート配信の E2E | `BASE_PATH=/` ビルドで Playwright | `tests/e2e/` | 未実施 |
| S3 | サブパス配信の E2E | `BASE_PATH=/it-knowledge-base/` ビルドで Playwright | `tests/e2e/` | 未実施 |
| S4 | 日本語全文検索 | 実際の日本語クエリ（例：「キャッシュ」）で結果と URL を確認 | `tests/e2e/` | 未実施 |
| S5 | 404 応答 | 存在しない URL で 404 ステータスと 404 ページ（preview / nginx） | `tests/e2e/` | 未実施 |
| S6 | 本番イメージのビルド | `docker compose --profile preview up -d --build preview` | 手動 / CI | 未実施 |
| S7 | コントラスト比 | トークンの文字色 × 背景色を計測（4.5:1 以上） | `tests/unit/` | 未実施 |
| S8 | 代表画面スクリーンショットの目視レビュー | Playwright で取得 → visual-reviewer + 人間 | `tests/e2e/` | 未実施 |

## 3. 実行結果の記録

検証を実行したら、以下に追記する（新しいものを上に）。

| 日付 | 対象（#） | コマンド | 環境 | 結果 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-28 | H1〜H12, H15 | `docker compose run --rm qa npm run verify -- --quick` / `docker compose run --rm qa npm run verify`（tests/harness 7 ファイル） | Docker Desktop, macOS | 成功 | Phase 4。hook は一時リポジトリ + 偽 docker で実行し、危険コマンドは解析のみ。発見・修正: guard-command が `nice -n 5 rm -rf /` を素通りしていた（値つきオプションを取りこぼし）。qa イメージに git を追加 |
| 2026-11-28 | H8（実地） | Claude Code セッション中の Stop イベント | Claude Code（ホスト）+ Docker Desktop, macOS | 成功 | 作業中に stop-check が `verify --quick` の Prettier 失敗を検知して停止をブロックした（実イベントでの発火を確認）。並行するサブエージェントの作業途中のファイルを検証した問題が判明し、background_tasks 実行中は保留するよう改善 |
| 2026-11-28 | H7（実地） | Claude Code セッション中の PreToolUse | 同上 | 成功 | guard-command が実コマンドを停止（heredoc 本文の `.env` 文字列を誤検知 → heredoc 本文を検査対象外に修正。その後 `$(cat .env)` を含むテストコマンドを正しく拒否） |
| 2026-11-28 | S1 | docker compose run --rm qa npm run verify | Docker Desktop, macOS | 成功 | Phase 2 統合後。E2E 43件、404 の繰り返しテスト 15件も成功 |

記入例：`2026-12-05 / S1 / docker compose run --rm qa npm run verify / Docker Desktop, macOS / 失敗 / step 8 build で失敗、修正後に再実行`

## 4. コンテンツ評価記録（SPEC §17）

ルーブリックは [CONTENT_GUIDE.md](./CONTENT_GUIDE.md#6-評価ルーブリックspec-17) を参照。全軸 4 点以上が公開目安。LLM 評価と人間評価を区別して記録する。

| 日付 | 記事 slug | 評価者（人間 / LLM） | 正確性 | 分かりやすさ | 図解・例 | 文章・構成 | 出典 | 判定 | 備考 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-28 | cache-memory | LLM（technical-reviewer、2回目） | 4 | 4 | 4 | 4 | 4 | 要修正（軽微） | 1回目の major（実効アクセス時間の減り方の誤記）を修正済み。2回目の major（R6春 問10 からの一般化）は最終仕上げで対応 |
| 2026-11-28 | memory-and-storage | LLM（technical-reviewer、2回目） | 4 | 4 | 4 | 4 | 4 | 要修正（軽微） | 1回目の major（キャッシュの位置の誤り、理解度チェックが IPA サンプル問題と同構成）を修正済み |
| 2026-11-28 | cpu | LLM（technical-reviewer、2回目） | 4 | 4 | 5 | 4 | 4 | 要修正（軽微） | 1回目は出典3点（CPU時間の式・アムダールの法則に出典なし）。追加調査で出典を補い再評価。シラバス表記（PC/IR/GR/MAR）は orchestrator が PDF 本文で確認 |
| 2026-11-28 | cache-memory | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 4 | 要修正 | major 1・minor 11 |
| 2026-11-28 | memory-and-storage | LLM（technical-reviewer、1回目） | 3 | 4 | 4 | 4 | 4 | 要修正 | major 2・minor 10 |
| 2026-11-28 | cpu | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 3 | 要修正 | major 3・minor 12 |

> いずれも LLM による評価であり、技術的正確性を保証しない。公開（`draft: false`）は人間の確認後に行う。

## 5. 未検証項目・既知の課題

- 上記すべて未実施（Phase 0 時点）。
