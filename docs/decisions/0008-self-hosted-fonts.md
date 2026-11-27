# 0008. フォントのセルフホスト

- ステータス：Accepted
- 日付：2026-11-28

## コンテキスト

- デザインでは本文に Inter + Noto Sans JP、等幅に JetBrains Mono を使う。
- Google Fonts CDN を実行時に読み込むと、閲覧者の IP 等が第三者に送信され、オフライン・ネットワーク制限下で表示が変わる。

## 決定

- `@fontsource` パッケージ（Inter / Noto Sans JP / JetBrains Mono）を npm 依存として導入し、ビルド成果物に含めてセルフホストする。
- 必要なウェイトのみ読み込み、`font-display: swap` とシステムフォントのフォールバックを設定する。

## 理由

- プライバシー：外部 CDN へのリクエストが発生しない（不要なアクセス解析を避ける方針と整合）。
- オフライン・再現性：バージョンが lockfile で固定され、ビルド成果物だけで表示が完結する。
- E2E・スクリーンショットが外部ネットワークに依存しない。

## 代替案

| 案 | 不採用理由 |
| --- | --- |
| Google Fonts CDN | 第三者への通信、実行時依存 |
| システムフォントのみ | OS ごとの差が大きく、和欧混植の品質が揃わない |
| フォントファイルをリポジトリに直接配置 | 更新・ライセンス管理が煩雑 |

## 影響

- Noto Sans JP はサイズが大きいため、`@fontsource` の unicode-range 分割を利用し、読み込むウェイトを最小限にする。
- 具体的なパッケージ版は Phase 1 で導入時に確定し、`package-lock.json` で固定する。

## 追記（2026-11-28）

- 導入したパッケージ：`@fontsource-variable/inter` 5.3.0、`@fontsource/noto-sans-jp` 5.3.1（400 / 700 のみ）、`@fontsource-variable/jetbrains-mono` 5.3.0。`src/styles/app.css` で import する。
