# 評価記録

> ハーネスとコンテンツの評価計画と結果。ハーネス評価 H1〜H15 はすべて成功（2026-11-28）。実行していない検証を成功と記録しない。

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
| S1 | `npm run verify` 全ステップ成功 | `docker compose run --rm qa npm run verify` | `scripts/verify.mjs` | 成功（2026-11-28、3 章の記録） |
| S2 | ルート配信の E2E | `BASE_PATH=/` ビルドで Playwright | `tests/e2e/` | 成功（verify 内の `site` / `fixture` / `mobile` プロジェクト） |
| S3 | サブパス配信の E2E | `BASE_PATH=/it-knowledge-base/` ビルドで Playwright | `tests/e2e/` | 成功（verify 内の `subpath` プロジェクト） |
| S4 | 日本語全文検索 | 実際の日本語クエリ（例：「キャッシュ」）で結果と URL を確認 | `tests/e2e/` | 成功（`search.spec.ts` / `search-subpath.spec.ts`、fixture コンテンツ） |
| S5 | 404 応答 | 存在しない URL で 404 ステータスと 404 ページ（preview / nginx） | `tests/e2e/` | 成功（静的サーバーでの E2E）。nginx は CI のスモークテストで確認する構成（CI 未実行） |
| S6 | 本番イメージのビルド | `docker compose --profile preview up -d --build preview` | 手動 / CI | 成功（2026-11-28: `docker compose --profile preview up -d --build preview` → `/`・`/fundamentals/` が 200、`/no-such-page/` が 404、nginx は uid 101（非 root）、Node.js なし。CI の docker ジョブは GitHub 上で未実行） |
| S7 | コントラスト比 | トークンの文字色 × 背景色を計測（4.5:1 以上） | `tests/unit/contrast.test.ts` | 実施済み（2026-11-28。light/dark の fg・muted・subtle・accent-text × bg/surface/surface-2、callout 文字 × soft 背景、ボタン文字を検証。`subtle` のライト値が surface-2 上で 4.26:1 だったため `#646b7b` に変更。加えて axe-core で `tests/e2e/a11y.spec.ts`（WCAG 2.0/2.1/2.2 A・AA、両テーマ、主要ページ・検索ダイアログ・モバイルドロワー）が違反 0） |
| S8 | 代表画面スクリーンショットの目視レビュー | Playwright で取得 → visual-reviewer + 人間 | `scripts/screenshots.mjs` | 一部実施（2026-11-28。home / カテゴリ / 記事 3 本 / 404 を light・dark × desktop・mobile で取得し、qa-engineer が一部を目視。ホームのカテゴリカードで「準備中」が縦に折り返す問題を修正。人間による最終確認は未実施） |

## 3. 実行結果の記録

検証を実行したら、以下に追記する（新しいものを上に）。

| 日付 | 対象（#） | コマンド | 環境 | 結果 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-28 | CI・デプロイ（S1・S3・S5・S6） | GitHub Actions `CI`（run 46053095896）→ `Deploy to GitHub Pages`（run 46053347607）、公開 URL へのブラウザ確認 | GitHub Actions（ubuntu-24.04）, <https://s-kaisei.github.io/it-knowledge-base/> | 成功 | 初回 CI（run 46052578454）は E2E 失敗（CI の SITE_URL でサイトマップがサブパス付きになり、ルート配信を検査する site.spec が 404）。修正後に成功し、失敗時はデプロイが skipped になることも確認。公開サイトで / ・カテゴリ 200、未知 URL 404、アセットはサブパス付き、JS エラーなし、モバイルで横スクロールなし。記事 3 本は draft のため未公開 |
| 2026-11-28 | bun 移行（S1・H8） | `docker compose run --rm qa bun run verify`、`echo '{…}' \| node .claude/hooks/stop-check.mjs`、`docker compose --profile preview up -d --build preview` | Docker Desktop, macOS | 成功 | npm → bun 1.4.5（ADR-0010）。verify 12 段階・unit/harness 269・components 41・E2E 全件成功。実 web コンテナでの Stop フック（`bun run verify -- --quick`）も通過。移行中に web イメージに git が無く Stop フックのゲートが常に失敗する既存の問題（Phase 4 で harness テスト追加以降）を発見し、base ステージに git を導入して解消 |
| 2026-11-28 | S7, S8 | docker compose run --rm qa npm run verify（コントラスト unit・axe E2E・キーボード E2E を含む）、`node scripts/screenshots.mjs --dir build-drafts/client …` | Docker Desktop, macOS | 成功 | axe 違反（本文リンクが色のみで区別、スクロール可能な数式にキーボードで到達不可）を修正、`subtle` トークンを調整、ホームの「準備中」折り返しを修正 |
| 2026-11-28 | H1〜H12, H15 | `docker compose run --rm qa npm run verify -- --quick` / `docker compose run --rm qa npm run verify`（tests/harness 7 ファイル） | Docker Desktop, macOS | 成功 | Phase 4。hook は一時リポジトリ + 偽 docker で実行し、危険コマンドは解析のみ。発見・修正: guard-command が `nice -n 5 rm -rf /` を素通りしていた（値つきオプションを取りこぼし）。qa イメージに git を追加 |
| 2026-11-28 | H8（実地） | Claude Code セッション中の Stop イベント | Claude Code（ホスト）+ Docker Desktop, macOS | 成功 | 作業中に stop-check が `verify --quick` の Prettier 失敗を検知して停止をブロックした（実イベントでの発火を確認）。並行するサブエージェントの作業途中のファイルを検証した問題が判明し、background_tasks 実行中は保留するよう改善 |
| 2026-11-28 | H7（実地） | Claude Code セッション中の PreToolUse | 同上 | 成功 | guard-command が実コマンドを停止（heredoc 本文の `.env` 文字列を誤検知 → heredoc 本文を検査対象外に修正。その後 `$(cat .env)` を含むテストコマンドを正しく拒否） |
| 2026-11-28 | S1 | docker compose run --rm qa npm run verify | Docker Desktop, macOS | 成功 | Phase 2 統合後。E2E 43件、404 の繰り返しテスト 15件も成功 |

記入例：`2026-12-05 / S1 / docker compose run --rm qa npm run verify / Docker Desktop, macOS / 失敗 / step 8 build で失敗、修正後に再実行`

## 4. コンテンツ評価記録（SPEC §17）

ルーブリックは [CONTENT_GUIDE.md](./CONTENT_GUIDE.md#6-評価ルーブリックspec-17) を参照。全軸 4 点以上が公開目安。LLM 評価と人間評価を区別して記録する。

| 日付 | 記事 slug | 評価者（人間 / LLM） | 正確性 | 分かりやすさ | 図解・例 | 文章・構成 | 出典 | 判定 | 備考 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-28 | 全 15 記事（ADR-0011 改修） | 公開判断（オーナー委任） | — | — | — | — | — | 公開 | 図の配置・覚え方・IPA 過去問を追加。各記事を technical-reviewer で独立レビューし、全軸 4 点以上・major 解消後に公開。過去問は問題文をページ画像、正解を解答例で照合。関連の薄い問題は削除し件数を明記（docker 6・ai-agent 7・ci-cd 7・dns 9、他は 10） |
| 2026-11-28 | cache-memory / cpu / virtual-memory / memory-and-storage（改修） | LLM（technical-reviewer） | 4〜5 | 4〜5 | 5 | 4〜5 | 4 | 公開可 | 過去問 40 問すべて一致。major：cache のコヒーレンシの一般化（修正済み）。memory の「インタリーブ」表記の指摘はオーケストレーターが PDF 拡大で原文どおりと確認 |
| 2026-11-28 | os-basics / process-and-thread / system-performance-availability / raid（改修） | LLM（technical-reviewer） | 4〜5 | 4〜5 | 4〜5 | 4〜5 | 4〜5 | 公開可 | major：モード切替の範囲、ノンプリエンプティブの定義、覚え方のネタバレ、関連の薄い過去問（RAID の SAN・RPO を FE/IP の RAID 問題に差替え、オーケストレーターが照合）。いずれも修正済み |
| 2026-11-28 | tcp-ip-basics / dns / http-https / docker（改修） | LLM（technical-reviewer） | 4〜5 | 4〜5 | 4〜5 | 3〜5 | 3〜5 | 公開可（修正後） | major：RFC 1122 の帰属、「署名なら DNSSEC」の覚え方、docker の打ち直し誤記（シストリック）と関連の薄い 2 問。修正済み、追加分の過去問はオーケストレーターが照合 |
| 2026-11-28 | llm / ai-agent / ci-cd（改修） | LLM（technical-reviewer） | 4 | 4 | 4〜5 | 4 | 3〜5 | 公開可（修正後） | major：NIST の基盤モデル定義の引用範囲、教師なし学習の扱い、サンドボックスの言い過ぎ、関連の薄い過去問の削除。ci-cd の括弧表記はオーケストレーターが PDF 拡大で全角と確認 |
| 2026-11-28 | ci-cd / llm / ai-agent / raid | 公開判断（オーナー委任） | — | — | — | — | — | 公開 | 独立レビューで全軸 4 点以上・blocker / major なし、かつ全品質ゲート通過を条件に公開。NIST AI 600-1・OWASP 2026 はオーケストレーターが原文で照合。人間による精読は省略 |
| 2026-11-28 | llm | LLM（technical-reviewer、2回目） | 4 | 4 | 5 | 4 | 4 | 公開可 | 1回目は major 1（RLHF の報酬モデル段階が欠落）。minor（節番号・√d_k の理由・grounding の扱い）を反映 |
| 2026-11-28 | llm | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 4 | 要修正 | major 1・minor 9 |
| 2026-11-28 | ai-agent | LLM（technical-reviewer、2回目） | 4 | 5 | 5 | 4 | 5 | 公開可 | 1回目は major 2（OWASP 2025 年版を断りなく使用、ハーネスの隔離の説明が過大）。2026 年版正本で再照合 |
| 2026-11-28 | ai-agent | LLM（technical-reviewer、1回目） | 4 | 4 | 5 | 4 | 4 | 要修正 | major 2・minor 5 |
| 2026-11-28 | ci-cd | LLM（technical-reviewer、2回目） | 5 | 4 | 5 | 5 | 4 | 公開可 | 1回目は major 2（Fowler にない表現、継続的デリバリーの自動化範囲）。minor 3 を反映 |
| 2026-11-28 | ci-cd | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 5 | 4 | 要修正 | major 2・minor 9 |
| 2026-11-28 | raid | LLM（technical-reviewer、1回目） | 4 | 4 | 5 | 4 | 4 | 公開可 | minor 13（md 文書の対象レベル、RAID 1 の台数前提など）を反映。計算はレビュアーが手で再検算 |
| 2026-11-28 | os-basics / process-and-thread / http-https / system-performance-availability | 公開判断（オーナー委任） | — | — | — | — | — | 公開 | 独立レビューで全軸 4 点以上・blocker / major なし、かつ全品質ゲート通過を条件に公開。人間による精読は省略 |
| 2026-11-28 | system-performance-availability | LLM（technical-reviewer、2回目） | 4 | 4 | 5 | 4 | 4 | 公開可 | 1回目は major 1（処理時間をレスポンスタイムと呼んでいた）。全数値を再検算 |
| 2026-11-28 | system-performance-availability | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 4 | 要修正 | major 1・minor 9 |
| 2026-11-28 | http-https | LLM（technical-reviewer、1回目） | 4 | 4 | 5 | 4 | 5 | 公開可 | minor 8（Content-Length、1-RTT の範囲、HSTS の説明など）。難易度を intermediate に変更 |
| 2026-11-28 | process-and-thread | LLM（technical-reviewer、1回目） | 4 | 4 | 5 | 4 | 4 | 公開可 | minor 7。作例・問題はレビュアーが手計算で再検証 |
| 2026-11-28 | os-basics | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 4 | 公開可（関連記事の存在待ち） | major は関連記事 process-and-thread 未作成のみ（同時公開で解消）。minor 9 を反映 |
| 2026-11-28 | dns / tcp-ip-basics / virtual-memory / docker | 公開判断（オーナー委任） | — | — | — | — | — | 公開 | オーナーの委任（「どんどん公開していっていいよ」）に基づき、独立レビューで全軸 4 点以上・blocker / major なし、かつ全品質ゲート通過を条件に公開。人間による精読は省略 |
| 2026-11-28 | docker | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 5 | 4 | 公開可 | minor 9（OWASP を出典に追加、非 root 実行の注意などを反映） |
| 2026-11-28 | virtual-memory | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 4 | 公開可 | minor 9。作例・確認問題はレビュアーが手計算で再検証。OSTEP の記述は orchestrator が抽出テキストで照合 |
| 2026-11-28 | tcp-ip-basics | LLM（technical-reviewer、2回目） | 4 | 4 | 4 | 4 | 5 | 公開可 | 1回目は major 1（エフェメラルポートの範囲）。IPA シラバスの記述は orchestrator が抽出テキストで確認 |
| 2026-11-28 | tcp-ip-basics | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 4 | 要修正 | major 1・minor 9 |
| 2026-11-28 | dns | LLM（technical-reviewer、2回目） | 4 | 4 | 5 | 4 | 4 | 公開可 | 1回目は major 1（ルートサーバーの規模の誤り）。minor を反映 |
| 2026-11-28 | dns | LLM（technical-reviewer、1回目） | 4 | 4 | 5 | 4 | 4 | 要修正 | major 1・minor 11 |
| 2026-11-28 | cpu / memory-and-storage / cache-memory | 人間（オーナー） | — | — | — | — | — | 公開承認 | オーナーが公開を承認（「どんどん公開していっていいよ」）。記事内容の人間による精読は省略し、LLM の独立レビュー 2 回（最終で全軸 4 点以上・blocker なし）と全品質ゲートの通過を公開条件とした。`draft: false` に変更 |
| 2026-11-28 | cache-memory | LLM（technical-reviewer、2回目） | 4 | 4 | 4 | 4 | 4 | 要修正（軽微） | 1回目の major（実効アクセス時間の減り方の誤記）を修正済み。2回目の major（R6春 問10 からの一般化）は最終仕上げで対応 |
| 2026-11-28 | memory-and-storage | LLM（technical-reviewer、2回目） | 4 | 4 | 4 | 4 | 4 | 要修正（軽微） | 1回目の major（キャッシュの位置の誤り、理解度チェックが IPA サンプル問題と同構成）を修正済み |
| 2026-11-28 | cpu | LLM（technical-reviewer、2回目） | 4 | 4 | 5 | 4 | 4 | 要修正（軽微） | 1回目は出典3点（CPU時間の式・アムダールの法則に出典なし）。追加調査で出典を補い再評価。シラバス表記（PC/IR/GR/MAR）は orchestrator が PDF 本文で確認 |
| 2026-11-28 | cache-memory | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 4 | 要修正 | major 1・minor 11 |
| 2026-11-28 | memory-and-storage | LLM（technical-reviewer、1回目） | 3 | 4 | 4 | 4 | 4 | 要修正 | major 2・minor 10 |
| 2026-11-28 | cpu | LLM（technical-reviewer、1回目） | 4 | 4 | 4 | 4 | 3 | 要修正 | major 3・minor 12 |

> いずれも LLM による評価であり、技術的正確性を保証しない。公開（`draft: false`）は人間の確認後に行う。

## 5. 未検証項目・既知の課題

最終更新：2026-11-28。解消したら削除するか、解消日と方法を追記する。

### 未検証

- **3 記事は人間による精読なしで公開**：`cpu` / `memory-and-storage` / `cache-memory` はオーナーの承認により、LLM の独立レビュー（全軸 4 点以上）と品質ゲートを条件として 2026-11-28 に公開した。技術的正確性は LLM 評価で保証されないため、誤りの指摘があれば修正する。
- **出典の一部が未確認**：
  - アムダール（Amdahl, 1967）の原論文の書誌情報（掲載誌・ページ等）は未確認（`cpu` 記事は講義ノートを出典としている）。
  - Jeff Dean の講演資料（PDF）の数値は一部のみ確認（`memory-and-storage` / `cache-memory`）。
  - Intel Smart Cache が全コアで共有されるかどうかは未確認（`cache-memory` / `cpu` は「プロセッサー全体の値」とだけ記述）。

### 既知の課題・仕様上の制約

- **日本語の禁則**：モバイル幅で、開き括弧などが行頭に来る折り返しが起きる箇所がある（ブラウザ既定の改行処理に依存）。
- **Mermaid 図の横スクロール**：自然幅の 80% より狭い画面では、文字を読める大きさに保つため図の枠内で横スクロールする（仕様）。
- **Pagefind の複数語クエリ**：日本語の複数語クエリでは助詞（「の」「を」等）などの短い語にもヒットし、関係の薄い結果や強調が混ざることがある。
- **qa の匿名 volume**：qa の `node_modules` は qa イメージから作られるため、`bun.lock` を変更したら `docker compose build qa` を実行しないと古い依存で検証される。web は named volume のため `docker compose exec web bun install --frozen-lockfile` で入れ替える。
- **web 起動直後の型生成の競合**：web コンテナの起動直後（開発サーバーが `.react-router/types` を生成中）に `typecheck` を実行すると、まれに一時的に失敗する。数秒おいて再実行すれば通る（2026-11-28 に 1 回観測、直後の 2 回連続実行は成功）。
- **hooks はホストの Node.js 18 以上が必要**：hooks はコンテナではなくホストで動く。Node が無い・古い環境では hook が失敗する（非ブロッキングだが、ガードや品質ゲートが働かない）。
- **guard-command はヒューリスティック**：文字列解析による誤操作防止であり、セキュリティ境界ではない（変数展開・難読化・スクリプト経由の操作は検出できない場合がある。[HARNESS.md](./HARNESS.md) 5 章）。
