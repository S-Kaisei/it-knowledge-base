# デザインシステム

> トークン・レイアウトはモックでユーザー承認済み。**実装済み**（トークンは `src/styles/app.css`、コンポーネントは `src/components/`）。値が食い違う場合は app.css を正とし、本書を直す。
> 方向性：白とニュートラルグレー基調、インディゴ系アクセント、日本語の可読性優先（SPEC §9）。

## 1. カラートークン

`src/styles/app.css` の `:root` に CSS カスタムプロパティとして定義し、`@theme inline` で Tailwind の色（`bg-surface`、`text-muted` など）に割り当てる。ダーク値は `:root[data-theme='dark']` と、JS 無効時のフォールバック `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` の 2 か所に同じ値を書く。記事ごとに独自の色を定義しない。

| トークン | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `bg` | `#ffffff` | `#0e1015` | ページ背景 |
| `surface` | `#f7f8fa` | `#151821` | サイドバー、ボックス背景 |
| `surface-2` | `#eff1f5` | `#1c2030` | ホバー、ネストした面 |
| `border` | `#e3e6ec` | `#272b38` | 罫線、区切り |
| `fg` | `#171a21` | `#e7e9ef` | 本文 |
| `muted` | `#565d6d` | `#a3a9b8` | 補足テキスト |
| `subtle` | `#646b7b` | `#8a91a3` | メタ情報、プレースホルダー（本文には使わない） |
| `accent` | `#4f46e5` | `#818cf8` | 主要アクション、フォーカス |
| `accent-fg` | `#ffffff` | `#0e1015` | accent 背景上の文字 |
| `accent-soft` | `#eef0ff` | `#1e2142` | 選択中ナビ、強調ボックス背景 |
| `accent-text` | `#4338ca` | `#a5b4fc` | リンク、アクセント色の文字 |
| `code-bg` | `#f7f8fa` | `#151821` | コードブロック背景 |
| `note` | `#2563eb` | `#7aa7ff` | note Callout のアイコン・枠 |
| `note-soft` | `#eff5ff` | `#142035` | note Callout 背景 |
| `warn` | `#b45309` | `#f5b454` | warn Callout のアイコン・枠 |
| `warn-soft` | `#fff7e8` | `#2a2112` | warn Callout 背景 |
| `tip` | `#047857` | `#5eead4` | tip Callout のアイコン・ラベル |
| `tip-soft` | `#ecfdf5` | `#0f2a26` | tip Callout 背景 |

- 色以外のトークン：`--header-h: 56px`（ヘッダー高さ、sticky 要素の `top` とアンカーの `scroll-padding-top` に使用）。
- 文字に使う組み合わせのコントラスト比（4.5:1 以上）は `tests/unit/contrast.test.ts` で両テーマを計測し、axe-core の E2E（`tests/e2e/a11y.spec.ts`）でも確認している（[EVALUATION.md](./EVALUATION.md) S7）。トークンを変えたらこのテストを通す。

## 2. タイポグラフィ

| 項目 | 値 |
| --- | --- |
| 本文フォント（`--font-sans`） | `'Inter Variable', 'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif` |
| 等幅フォント（`--font-mono`） | `'JetBrains Mono Variable', ui-monospace, 'SFMono-Regular', Menlo, monospace` |
| フォント配信 | `@fontsource-variable/inter`、`@fontsource/noto-sans-jp`（400 / 700）、`@fontsource-variable/jetbrains-mono` でセルフホスト（[ADR 0008](./decisions/0008-self-hosted-fonts.md)） |
| 本文 | 16px / line-height 1.85 |
| h1（記事・カテゴリ） | `clamp(28px, 4vw, 36px)`（トップのタグラインは `clamp(30px, 5vw, 44px)`） |
| h2 | 23px |
| h3 | 18px |
| コード | 13.5px / line-height 1.7 |
| 本文最大幅 | 720px |

記事本文のスタイルは `app.css` の `.prose-ikb`（`@layer components`）に集約している。

## 3. スペーシング

- Tailwind の 4px 基準スケールを使う。任意値（`mt-[13px]` 等）は原則禁止（承認済みモックの寸法を再現するための `text-[13px]` 等の文字サイズ指定は既存コードに存在する）。
- 段落間・見出し前後の余白はグローバルの記事スタイル（prose 相当）で一元管理し、記事内で調整しない。

## 4. レイアウトとブレークポイント

| 幅 | レイアウト |
| --- | --- |
| ≥ 1241px（`toc:`） | ヘッダー 56px（sticky）+ 3 カラム：左ナビ 260px / 本文 1fr（記事は最大 720px）/ 右目次 220px、最大幅 1360px |
| ≤ 1240px | 右目次を本文上部の `<details>`（「この記事の目次」）に折りたたむ |
| ≤ 900px（`nav:` 未満） | 左ナビをドロワー化（Radix Dialog：メニューボタン、スクリム、Esc で閉じる、フォーカストラップ、閉じるとフォーカスを戻す）。ヘッダーの GitHub リンクは非表示 |

- ブレークポイントは `app.css` の `@theme` に `--breakpoint-nav: 56.3125rem`（901px）、`--breakpoint-toc: 77.5625rem`（1241px）として定義。

- 本文全体で横スクロールを発生させない。表は横スクロール可能なラッパー、コードブロックはブロック内スクロール。

## 5. コンポーネントカタログ

| コンポーネント | 使用ルール |
| --- | --- |
| ヘッダー（`SiteHeader`） | ドロワーボタン（狭い画面のみ）、ロゴ + サイト名（520px 以下はロゴのみ）、検索トリガー、GitHub リンク（`aria-label="GitHub リポジトリ"`）、テーマ切替 |
| テーマ切替（`ThemeToggle`） | アイコンボタン。システム → ライト → ダーク → システムの順に切替。`aria-label` に現在値と次の値 |
| サイドバー（`SidebarNav`） | content index から生成。記事のあるカテゴリのみ（英名 + 和名）とその記事。現在ページは `accent-soft` 背景。下書きには「（下書き）」 |
| パンくず | ホーム / カテゴリ / 記事（現在ページは `aria-current="page"`） |
| 記事メタ | 難易度（`DifficultyBadge`：3 段階バー + 「難易度：初級/中級/上級」）、読了時間、前提記事 |
| 下書き表示 | `draft: true` の記事の冒頭に `warn-soft` の帯で「下書き」（開発サーバー・`build:drafts` のみで表示される） |
| 目次（`TableOfContents` / `InlineTableOfContents`） | h2 / h3。デスクトップは右カラムでスクロール連動（`aria-current="location"`）、狭い画面は `<details>` |
| この記事で分かること / 一言で説明すると | 専用コンポーネントは無く、テンプレートの h2 節として本文に書く（通常の本文スタイル） |
| Callout | note / warn / tip。アイコン + ラベル文字「補足」「注意」「ポイント」を必ず併記（色だけに頼らない）。左 3px ボーダー + soft 背景（`note` / `warn` / `tip` と各 `-soft` トークン）。`role="note"` |
| Figure | 図 + キャプション（`<figure>` / `<figcaption>`）。枠線付きの `bg` 面に中央寄せ、はみ出す場合は枠内で横スクロール。`alt` 必須。図の意味を本文でも説明 |
| Mermaid 図（`Mermaid`） | ブラウザでのみ描画（`useEffect` 内で動的 import）。描画前・JS 無効時はソースを `<pre>` で表示。配色はトークンから `base` テーマ変数を生成し、テーマ切替時に再描画。枠線付き `bg` 面。自然幅の 80% までは縮小し、それ以上狭い画面では枠内で横スクロール（キーボードでフォーカス可能）。`accTitle:` をアクセシブルネームに使う。失敗時は `data-mermaid-error` + 注意文 + ソース |
| 数式ブロック | KaTeX（ビルド時）。長い数式は横スクロールし、はみ出したときだけ `tabindex=0` と「数式（横にスクロールできます）」ラベルを付与 |
| 表ラッパー | `overflow-x: auto`、枠線・角丸。`role="region"` + `aria-label="表"` + `tabIndex=0`（キーボードでスクロール可能） |
| コードブロック | ヘッダー（`surface-2`）に等幅のファイル名（任意）・言語ラベル・コピーボタン。本文は `code-bg`、ブロック内で横スクロール。shiki デュアルテーマ（github-light-default / github-dark-default を CSS 変数で切替。ライトのコメント色は 4.5:1 確保のため置換）。コピー結果は「コピーしました」「コピーできませんでした」を表示し `aria-live` で通知 |
| よくある誤解 | 「誤解」「実際」ラベル付きリスト（`Misconceptions`）。ラベルは `warn` / `tip` の soft 背景 + 文字 |
| 見出しアンカー | h2 / h3 の後ろに `#` リンク（`aria-label="この見出しへのリンク"`）。ホバー・フォーカス時に表示、タッチ端末では常に薄く表示 |
| シミュレーター（`EffectiveAccessTimeSimulator`） | `surface` 面のセクション。ラベル付きスライダー（`<input type="range">` + `<output>`、`aria-valuetext` に単位付きの値）、結果は `aria-live="polite"`。結果の数値は `accent-text` の等幅、割合の棒は装飾（`aria-hidden`）で数値を文字でも表示 |
| 関連記事 | `related` の全件をグリッド表示（件数の上限なし。多すぎないよう frontmatter 側で調整） |
| 参考資料 | 「参考資料・出典」。番号付きリスト、発行元と「確認日」を表示 |
| ページャ | 前 / 次の記事（カテゴリ内 `order` → タイトル順）。`rel="prev"` / `rel="next"` |
| 更新日 | 「最終更新」`lastUpdated`、「情報源の確認」`lastVerified`、「この記事のソースを見る」（GitHub） |
| カテゴリページ | アイコン + h1 + 説明、記事リスト（タイトル・説明・難易度・読了時間）。記事 0 件は「このカテゴリの記事は準備中です。」 |
| トップ：ヒーロー | eyebrow「IT KNOWLEDGE BASE」（等幅）、タグライン h1「ITの仕組みを、基礎から実践まで。」、説明、検索ボタン |
| トップ：カテゴリグリッド | `categories.json` の全カテゴリ（lucide アイコン）。記事数、または「準備中」（リンクなし、`subtle` 色） |
| トップ：最近更新された記事 | `lastUpdated` の新しい順に 5 件、リスト表示（カードにしない） |
| 404 | 「404」+「ページが見つかりません」+ トップへのリンク（`noindex`） |

shadcn/ui の CLI 生成コンポーネントは使っていない。ダイアログ（検索・ドロワー）は Radix Dialog（`@radix-ui/react-dialog`）を直接使い、アイコンは lucide-react。

## 6. アクセシビリティ（目標：WCAG 2.2 AA）

- すべての操作をキーボードで完結できる（ドロワー、検索、目次、テーマ切替、コピー）。
- `:focus-visible` で明確なフォーカスリング（`accent`、2px 以上）を表示。`outline: none` 単独禁止。
- 色だけで意味を伝えない（Callout・難易度・誤解/実際はテキストラベル併記）。
- ランドマーク（`header` / `nav` / `main` / `aside`）と「本文へスキップ」リンク。
- 画像・図解に代替テキスト。Mermaid 図は本文で内容を説明。
- `prefers-reduced-motion` を尊重。アニメーションは最小限。
- ターゲットサイズ 24×24px 以上（WCAG 2.2 2.5.8）。

## 7. ダークモード

- 選択肢：ライト / ダーク / システム。ライト / ダークは `localStorage` の `ikb-theme` に保存し、システムを選ぶとキーを削除する。システム選択中は OS の設定変更に追従する。
- `<html data-theme="light|dark">` を設定。未選択時は `prefers-color-scheme` に従う。
- **フラッシュ防止**：`root.tsx` の `<head>` に小さなインラインスクリプト（`THEME_INIT_SCRIPT`、`src/lib/theme.ts`）を置き、ハイドレーション前に `data-theme` を適用する。
- prerender 中は `localStorage` に触れない（インラインスクリプトはブラウザでのみ実行される）。
- shiki はデュアルテーマを CSS 変数（`--shiki-light` / `--shiki-dark`）で切り替える。Mermaid は `data-theme` の変化を監視（`useDataTheme`）して再描画する。

## 8. Do / Don't

| Do | Don't |
| --- | --- |
| トークン経由で色を指定する | 16 進カラーをコンポーネントに直書きする |
| 情報をテキストで伝え、色・アイコンは補助にする | 色だけで状態や種類を区別する |
| 一覧はシンプルなリスト・表で示す | 過剰なカード、影、グラデーション |
| 図解は本文で説明する | 図だけに情報を依存させる |
| 見出しは文字で構成する | 見出しや節の目印に絵文字を使う |
| 動きは状態変化の伝達に限定する | 装飾目的のアニメーション |
