---
name: create-diagram
description: 記事用の図解（Mermaid / SVG / React のインタラクティブ図）を作成・修正し、実際の描画を確認する。「図を追加して」「図解して」「この仕組みを図にして」「シミュレーターを作って」「add a diagram」のような依頼や、add-topic の図解工程で使う。
argument-hint: "<記事パス or slug> <図にしたい内容>"
---

# create-diagram

対象: $ARGUMENTS

## 1. 方式を選ぶ

| 方式 | 使う場面 | 置き場所 |
| --- | --- | --- |
| Mermaid | フロー、シーケンス、状態遷移、単純な構成図 | 記事内の ```mermaid コードブロック |
| SVG | 記憶階層・パケット構造などレイアウトを精密に制御したい静的図 | `src/components/diagrams/` の React コンポーネント（インラインSVG）、または `public/images/<slug>/*.svg` |
| React（操作可能） | 値を変えて挙動を体感させる必要がある場合のみ（キャッシュヒット率、サブネット計算等） | `src/components/simulators/` ＋ 計算は `src/lib/` の純粋関数 |

迷ったら単純な方（Mermaid → SVG → React の順）を選ぶ。React 化はコード変更を伴うため `develop` スキル／`frontend-engineer` の範囲として扱う。

## 2. 共通ルール

- 図の意味を本文でも説明する。図がなくても本文だけで理解できること。
- 図の直後にキャプション（`<figure>` + `<figcaption>` 等、既存コンポーネントがあればそれを使う）。
- 色だけで区別しない（ラベル・線種・形でも区別）。
- 第三者の図を模写・転載しない。

## 3. 方式別ルール

### Mermaid

- 描画はクライアント側のみ（prerender 中に描画しない）。構文は `content:check` で検証される（パーサーのみ。描画時の失敗は `data-mermaid-error` としてスクリーンショット・E2E で検出）。
- 図の説明用の名前は `accTitle: …` で付ける（アクセシブルネームになる）。
- ラベルは短く。ノード数が多すぎる場合は図を分割する。
- テーマ色を図内で直接指定しない（サイトのテーマ設定に任せる）。

### SVG

- 色は `currentColor` または `var(--...)`（デザイントークン）を使い、ダークモードで反転・視認できるようにする。HEX 直書き禁止。
- `role="img"` と `aria-label`（または `<title>` + `aria-labelledby`）を付ける。
- `viewBox` を指定し、幅は親要素に追従させる（固定 px 幅にしない）。モバイル幅でも文字が読めるサイズにする。
- 外部ファイルの `<img>` で読み込む SVG は CSS 変数が効かないため、テーマ対応が必要ならインライン SVG コンポーネントにする。

### React（操作可能）

- 状態はページ内で完結（保存・送信しない）。ブラウザ専用APIは `useEffect` 内のみ。
- 計算ロジックは純粋関数にし `tests/unit/` にテストを書く。キーボード操作可能なフォーム部品を使う。
- 記事から使うには `src/components/article/mdx-component-names.ts` と `mdx-components.tsx` の両方に登録する（未登録だと `content:check` がエラー）。

## 4. 確認

1. `docker compose exec web npm run content:check`（script が無ければ「未整備」）。
2. 実際の描画を確認する（下書き記事も対象）。標準の手順は `docker compose run --rm qa npm run screenshots:drafts -- /<category>/<slug>/` で `test-results/screenshots/<page>-<light|dark>-<desktop|mobile>.png` を撮り、PNG を確認する（`visual-reviewer` サブエージェントに依頼してよい）。スクリプトが報告する Mermaid エラー・横スクロールは修正する。Docker 不可なら「未検証」と報告する。
3. React 図解を追加した場合は `docker compose run --rm qa npm run verify -- --quick`。

## 報告

作成した図（方式・ファイル・行）、本文での説明箇所、確認方法と結果、未検証事項。
