# 0005. Pagefind による全文検索

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- バックエンドなしで日本語全文検索を提供する必要がある。
- GitHub Pages のサブパス配信で検索結果 URL が正しくなければならない。

## 決定

- Pagefind 1.6.0 を `react-router build` と postbuild の後に `build/client` に対して実行する。
- `<html lang="ja">` を設定し、記事本文に `data-pagefind-body` を付与する（ナビ等はインデックスしない）。
- 検索 UI は `${BASE_PATH}pagefind/pagefind.js` を動的 import し、結果 URL に base path を前置する。
- 開発サーバーではインデックスが存在しないため、「検索インデックスは本番ビルド後に利用できます」と表示する。

## 理由

- 生成済み HTML からインデックスを作るため、prerender 結果と検索対象が一致する。
- `lang` 属性に応じて言語別の処理を行い、日本語をサポートする。
- インデックスは分割され、必要な断片のみ取得するため静的ホスティングでも軽量。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| Algolia 等の外部検索サービス | 外部依存・アカウント管理が必要、SPEC の簡潔さ方針に反する |
| FlexSearch / Lunr を自前で構築 | 日本語分割・インデックス生成を自作する必要がある |
| 開発時もインデックスを生成 | 毎回フルビルドが必要で HMR の利点を失う |

## 影響

- 検索の E2E は本番ビルド（preview / qa）で行う。
- 実際の日本語クエリで結果が出ることを検証する（[EVALUATION.md](../EVALUATION.md) S4）。

## 結果（Phase 2 実装メモ、2026-11-28）

- 検索 UI は Pagefind の Component UI を使わず、Radix Dialog と JS API（`options` / `init` / `search` / `data()`）で自作した。デザイントークン・キーボード操作・日本語 IME への対応を自前で制御するため。
- `pagefind.js` はダイアログを初めて開いたときにブラウザで動的 import する（prerender 中は読み込まない）。開発サーバー（`import.meta.env.DEV`）では読み込みを試みず、案内文を表示する。
- 実測（fixture ビルド）：Pagefind はバンドルの配置場所からベースを推定し、サブパス配信では結果 URL が `/it-knowledge-base/fundamentals/fixture-basics/`、見出し単位の `sub_results` が `…/#%E6%A6%82%E8%A6%81` のようにパーセントエンコードされたアンカー付きで返る。`baseUrl` に `BASE_URL` を明示しても二重にはならない。UI は basename を除いたパスを React Router に渡す（`src/lib/search.ts` の `toRouterPath()`）。
- 実測：「キャッシュヒット率」は「キャッシュヒット」「率」に分かち書きされ、両方が `<mark>` になる。「名前解決」も文中から見つかる。下書き専用の語はヒットしない。
- 結果タイトルは記事 h1 の `data-pagefind-meta="title"`、カテゴリは `data-pagefind-meta="category:…"` を使う。
- 抜粋は Pagefind が文字参照をエンコード済みだが、UI では `<mark>` 以外をすべてテキストとして描画する（`dangerouslySetInnerHTML` を使わない）。
- 既知の制約：Mermaid のフォールバック表示（ソースコード）が本文として索引されるため、抜粋に `flowchart LR …` が出ることがある。記事レンダリング側で `data-pagefind-ignore` を付けることを検討する。複数語の日本語クエリは助詞（「の」「を」等）にもヒットし得る。

## 追記（2026-11-28）

- 上記「既知の制約」の Mermaid ソースの索引は解消済み：`Mermaid` コンポーネントの `<figure>` に `data-pagefind-ignore` を付けた（シミュレーター・見出しアンカーも同様）。
- 複数語の日本語クエリが助詞等にもヒットする件は未解消（[EVALUATION.md](../EVALUATION.md) §5）。
- 検索の E2E（S4）は fixture コンテンツでルート・サブパスともに成功している。
