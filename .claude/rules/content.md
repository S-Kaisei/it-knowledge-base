---
paths:
  - "src/content/**"
  - "docs/templates/**"
  - "public/images/**"
---

# コンテンツ規約

詳細は `docs/CONTENT_GUIDE.md`、テンプレートは `docs/templates/article.md`、評価基準は SPEC §17。

## 配置と Frontmatter

- 記事は `src/content/<category>/<slug>.mdx`。category は `src/content/categories.json` に存在するもののみ。
- 必須項目: title, description, slug, category, difficulty, tags, prerequisites, related, order, draft, lastUpdated, lastVerified, references。スキーマは `src/lib/content-schema.ts`。
- slug はファイル名と一致させ、全体で一意。公開後に変更しない。
- `lastUpdated` は実際に内容を変更した日のみ更新。`lastVerified` は情報源を実際に確認した日のみ更新。未来日・推測日を書かない。
- 新規記事は確認が済むまで `draft: true`。
- `prerequisites` / `related` には存在する slug のみ。関連は原則双方向に張る。

## 構成と文章

- テンプレートの標準構成に沿う（この記事で分かること / 一言で説明すると / なぜ必要なのか / 身近な例え / 技術的な仕組み / 図解 / 実務での活用例 / 関連技術との比較 / よくある誤解 / まとめ / 関連記事 / 参考資料・出典）。不要な見出しは省いてよい。
- 本文は h2 から始める（h1 はタイトルから生成）。見出しレベルを飛ばさない。
- 直感的説明 → 技術的定義の順。専門用語を別の専門用語だけで説明しない。
- 例え話には必要に応じて「例えの限界」を書く。
- 数値・数式・因果関係は出典で裏付ける。バージョン依存の情報は対象バージョンと確認日を明記する。
- 「TODO」「TBD」「ここに説明」「lorem」等のプレースホルダーを残さない。
- 敬体（です・ます）で統一。絵文字を見出し・本文の装飾に使わない。

## 出典

- 一次情報を優先: IPA、MDN、RFC Editor / IETF、W3C、WHATWG、NIST、OWASP、公式ドキュメント、学術論文。
- `references` には実際に開いて確認したURLのみ。存在しないURL・文献を書かない。各出典に確認日を付ける。
- 第三者の文章・図・問題を転載しない（要約し自分の言葉で書く）。

## 図・数式・コード

- 図の作り方は `create-diagram` スキルに従う。図の意味は本文でも説明する。
- 画像は `public/images/<slug>/` に置き、代替テキストを付ける。
- 数式は KaTeX（`$...$` / `$$...$$`）。コードブロックには言語を指定する。

## 検証

- 記事を変更したら `docker compose exec web npm run content:check` を実行する。
- 公開前に `technical-reviewer` による5軸レビューで全軸4点以上。重大な誤り・出典捏造・転載は公開不可。
