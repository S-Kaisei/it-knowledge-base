---
title: "TODO: 記事タイトル"
description: "TODO: 1〜2文の要約（一覧・検索結果に表示される）"
slug: "todo-slug"
category: "fundamentals"
difficulty: "beginner"
tags: []
prerequisites: []
related: []
order: 0
draft: true
lastUpdated: "TODO: YYYY-MM-DD（実際に更新した日）"
lastVerified: "TODO: YYYY-MM-DD（出典を実際に確認した日）"
references:
  - title: "TODO: 資料名"
    url: "TODO: 実際に開いて確認したURL"
    publisher: "TODO: 発行元（任意。不要なら行ごと削除）"
    accessed: "TODO: YYYY-MM-DD"
---

{/*

使い方：

- このファイルを src/content/CATEGORY/SLUG.mdx にコピーし、slug をファイル名と一致させる。
- 「TODO:」が残っている記事は content:check で検出され、公開できない。
- 日付フィールドは TODO のままだとスキーマ検証で失敗する。実際の日付に置き換える。
- 見出しは標準構成。トピックに合わせて統合・省略・改名してよい（機械的に強制しない）。
- 注記はすべて MDX コメント（波括弧とスラッシュ・アスタリスクで囲む形式）で書いてある。表示されないので残してもよいが、書き終えたら削除する。HTML コメント（<!-- -->）は MDX では構文エラーになるので使わない。
- h1 は書かない（タイトルは frontmatter から表示される）。見出しは h2 → h3 の順。
- 「関連記事」と「参考資料・出典」は frontmatter の related / prerequisites / references から記事末尾に自動表示される。本文に同じ節を書かない。
- 使える MDX コンポーネント（Callout / Figure / Misconceptions / Mermaid / PastExam / 数式 / コードブロック）は docs/CONTENT_GUIDE.md の 5 章、過去問は 11 章。

*/}

## この記事で分かること

{/*
読後に分かることを 3〜5 項目の箇条書きで。「〜とは何か」「なぜ〜か」「〜との違い」など。
*/}

- TODO: 分かること 1
- TODO: 分かること 2
- TODO: 分かること 3

## 一言で説明すると

{/*
専門用語を使わずに 1〜2 文で。後続の詳細説明の「地図」になる文。
*/}

TODO: 一言での説明

## なぜ必要なのか

{/*
それが無かったら何が困るのか。解決している問題・歴史的背景を先に示す。
*/}

TODO: 必要性

## 身近な例え

{/*
日常の例えで直感をつかませる。最後に「この例えが当てはまらない点」（限界）を必ず書く。Callout の tip / warn も使える。
*/}

TODO: 例え話

<Callout type="warn" title="例えの限界">
TODO: この例えが当てはまらない点
</Callout>

## 技術的な仕組み

{/*
直感 → 定義の順で。用語は初出で一言補足。数値・数式は出典で裏付ける。必要なら h3 で分割。
*/}
{/*
数式はインライン $...$、ブロック $$...$$（KaTeX）。コードは言語を指定し、必要なら title="ファイル名" を付ける。
*/}

TODO: 仕組みの説明

{/*
図・表・シミュレーターは、説明している段落の直前・直後に置く（独立した「図解」節は作らない。ADR-0011）。
Mermaid（mermaid コードフェンス）、SVG / 画像（<Figure />）、比較表など。図の内容は本文でも説明し、図だけに依存しない。
*/}

```mermaid
flowchart LR
  A[TODO: 入力] --> B[TODO: 処理] --> C[TODO: 出力]
```

TODO: 図の説明文（図が表している流れを本文でも説明する）

{/*
覚え方：理屈で覚えるための手がかり（因果・対比・数値の導き方・図との対応）。語呂合わせだけにしない。
*/}

<Callout type="tip" title="覚え方">
TODO: 覚え方
</Callout>

## 実務での活用例

{/*
実際の現場でどう使われるか・どこで意識するか。具体的な場面、設定、コード例など。
*/}

TODO: 活用例

## 関連技術との比較

{/*
混同されやすい技術と表で比較する。観点（目的・仕組み・用途など）を揃える。
*/}

| 観点 | TODO: この技術 | TODO: 比較対象 |
| --- | --- | --- |
| 目的 | TODO | TODO |

## よくある誤解

{/*
「誤解」と「実際」の組で書く。
*/}

<Misconceptions
  items={[
    { myth: 'TODO: よくある誤解', fact: 'TODO: 実際はどうか' },
  ]}
/>

## まとめ

{/*
「この記事で分かること」に対応させて 3〜5 行で要点を再確認する。新情報は書かない。
*/}

TODO: まとめ

## 理解度チェック

{/*
記事固有の理解を確かめる自作の問題を 2〜3 問。答えと解説を <details> で折りたたむ。IPA の過去問は次の節に分ける。
*/}

TODO: 確認問題

## 過去問題

{/*
IPA 過去問を目標 10 問（docs/CONTENT_GUIDE.md 11 章）。問題文は IPA の問題 PDF を見て打ち直し、正解は解答例 PDF で確認する。
関連する問題が 10 問に満たない場合は数を埋めず、この節の冒頭に「現時点で関連する過去問は N 問です」と書く。
*/}

<PastExam source="TODO: 令和N年度 秋期 応用情報技術者試験 午前 問N">
TODO: 問題文

- ア　TODO
- イ　TODO
- ウ　TODO
- エ　TODO

<PastExamAnswer answer="ア">
TODO: 解説（自分の言葉で。本文のどの節と対応するか）
</PastExamAnswer>
</PastExam>
