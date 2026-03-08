# FeedShelf 仕様書 v1

## 1. 概要

FeedShelf は、複数の公開 RSS / Atom フィードから記事情報を収集し、カテゴリ別・媒体別・新着順で一覧表示する静的Webアプリである。

本バージョンでは、記事本文を自サイト内に保持しない。ユーザーは FeedShelf 上でタイトル・要約・公開日時・媒体を確認し、必要に応じて元記事へ遷移して本文を読む。

配信基盤は GitHub Pages、更新基盤は GitHub Actions を前提とする。

---

## 2. 目的

- 複数媒体のニュースや記事を一箇所で横断的に確認できるようにする
- カテゴリや媒体ごとに整理して閲覧しやすくする
- 低コストかつ運用負荷の低い構成で継続的に更新できるようにする
- 将来的な検索・タグ・要約拡張に耐える最低限のデータ構造を整える

---

## 3. 非目的

v1 では以下を対象外とする。

- 記事本文のアプリ内表示
- 外部記事本文の抽出・保存
- オフライン閲覧
- PWA 必須対応
- ユーザーアカウント / ログイン
- 既読同期
- AI 要約生成
- おすすめ記事 / レコメンド
- コメント機能

---

## 4. 想定ユーザー

- 国内外のニュースや IT / 科学系記事を横断的に追いたい個人ユーザー
- 各媒体のRSSを個別に購読する代わりに、まとめて一覧したいユーザー
- PC / スマホから短時間で新着を確認したいユーザー

---

## 5. MVP

MVP として最低限必要な機能は以下とする。

- 公開 RSS / Atom フィード定義を保持できる
- 定期的にフィードを取得できる
- RSS / Atom 記事を共通形式へ正規化できる
- 重複記事を抑制できる
- 新着一覧を表示できる
- カテゴリ別一覧を表示できる
- 媒体別一覧を表示できる
- 記事から元記事へ遷移できる
- GitHub Actions により定期更新できる
- GitHub Pages で公開できる

---

## 6. 画面仕様

### 6.1 トップ / 新着一覧

表示項目:
- サイトタイトル
- カテゴリ導線
- 媒体導線
- 新着記事一覧

記事カード表示項目:
- タイトル
- 媒体名
- カテゴリ
- 公開日時
- 要約（あれば）
- サムネイル（あれば）
- 元記事へのリンク

### 6.2 カテゴリ別一覧

- 指定カテゴリの記事のみを表示する
- 標準ソートは新着順とする

### 6.3 媒体別一覧

- 指定媒体の記事のみを表示する
- 標準ソートは新着順とする

### 6.4 記事詳細ページ

v1 では必須ではない。

採用する場合でも本文は保持せず、以下のみを表示する。
- タイトル
- 媒体名
- 公開日時
- 要約
- 元記事リンク

---

## 7. フィード定義

### 7.1 配置

v1 のフィード定義は、リポジトリ管理下の hand-authored source として `data/feeds.json` に置く。

- 1ファイルに全フィードを集約する
- GitHub Actions の取得処理はこのファイルを入力とする
- v1 では DB や外部管理画面を使わない

### 7.2 形式

`data/feeds.json` は JSON 配列とし、各要素は 1 フィード定義オブジェクトとする。

各フィードには以下の情報を持たせる。

- `id`: 一意な識別子
- `name`: 媒体名
- `category`: 表示カテゴリ
- `feedUrl`: RSS / Atom URL
- `siteUrl`: 媒体トップURL
- `language`: 言語
- `enabled`: 有効 / 無効

### 7.3 スキーマ制約

- `id` は ASCII の kebab-case を推奨し、URL や生成物キーに再利用できる安定値とする
- `name` は UI 表示名として使える文字列とする
- `category` は UI での絞り込み単位として扱う表示ラベルとする
- `feedUrl` は取得対象の公開 RSS / Atom URL とする
- `siteUrl` は媒体トップまたはフィードに対応するサイトURLとする
- `language` は `ja`, `en` などの短い言語コードを想定する
- `enabled=false` のフィードは取得対象から除外してよい

### 7.4 例

```json
[
  {
    "id": "itmedia-news",
    "name": "ITmedia NEWS 新着",
    "category": "日本IT",
    "feedUrl": "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
    "siteUrl": "https://www.itmedia.co.jp/",
    "language": "ja",
    "enabled": true
  }
]
```

---

## 8. 記事データモデル

記事は取得後に canonical article object へ正規化する。

このオブジェクトは、フィード取得結果を UI や生成物へ渡す前の共通中間表現として扱う。`articles/*.json` などの最終生成物 shape は別タスクで決める。

```json
{
  "id": "stable-id",
  "feedId": "itmedia-news",
  "sourceName": "ITmedia NEWS 新着",
  "category": "日本IT",
  "language": "ja",
  "title": "記事タイトル",
  "url": "https://example.com/article",
  "summary": "要約またはdescription",
  "publishedAt": "2026-03-07T09:00:00+09:00",
  "fetchedAt": "2026-03-08T06:00:00Z",
  "author": null,
  "imageUrl": null,
  "tags": [],
  "sourceItemId": null
}
```

### 必須かつ non-null の項目

- `id`
- `feedId`
- `sourceName`
- `category`
- `language`
- `title`
- `url`
- `fetchedAt`
- `tags`

### 必須だが nullable の項目

- `summary`
- `publishedAt`
- `author`
- `imageUrl`
- `sourceItemId`

### 補足

- v1 では単数の optional 値は省略せず `null` を使う
- 配列項目は省略せず、値がなければ空配列 `[]` を使う
- `sourceName` / `category` / `language` は `data/feeds.json` 由来の表示用メタデータを記事側にも冗長保持する
- `id` は内部安定キーであり、具体的な生成式は URL 正規化・dedupe ルールで確定する
- `summary` は表示用の正規化済み文字列であり、raw HTML 全文を保持する前提にはしない

---

## 9. 正規化ルール

### 9.1 タイトル
- `title` を採用する
- 空の場合は記事をスキップする

### 9.2 URL
- `link` などから記事 URL を取得し、`url` に格納する
- 取得できない場合は記事をスキップする

### 9.3 公開日時
取得候補:
- `pubDate`
- `published`
- `updated`
- `dc:date`

- 取得できた値は ISO 8601 に正規化して `publishedAt` に設定する
- 取得できない場合は `publishedAt=null` とする
- 取得処理の実行時刻は `fetchedAt` に ISO 8601 で必ず設定する
- 一覧表示やソートでは `publishedAt ?? fetchedAt` を使える形を前提とする

### 9.4 要約
優先候補:
- `description`
- `summary`
- `content` の短縮版

- `summary` は表示用の正規化済み文字列とする
- raw HTML 全文をそのまま保持する前提にはしない
- 値を作れない場合は `summary=null` とする

### 9.5 画像
- `media:content` や類似項目から URL を取得できる場合は `imageUrl` に設定する
- 取得できない場合は `imageUrl=null` とする

### 9.6 著者
- `author` 相当を取得できる場合のみ `author` に設定する
- 取得できない場合は `author=null` とする

### 9.7 フィード由来メタデータ
- `feedId` は元フィード定義の安定キーをそのまま使う
- `sourceName` / `category` / `language` は元フィード定義から補完する

### 9.8 元アイテム識別子
- `guid` / `id` などの元フィード項目が取れる場合は `sourceItemId` に保持する
- 取得できない場合は `sourceItemId=null` とする

### 9.9 optional 値の表現
- 単数値の欠損は `null` で表す
- 配列値の欠損は `[]` で表す
- v1 では optional 項目を省略しない

---

## 10. 重複排除

以下の優先順位で一意判定を行う。

1. `guid` または `id`
2. `link`
3. `title + publishedAt`

### 重複時の優先ルール

重複候補が複数ある場合は以下を優先して採用してよい。

- `summary` がより充実している方
- `image` がある方
- `publishedAt` がより妥当な方

---

## 11. 更新フロー

1. フィード定義を読み込む
2. 各 RSS / Atom を取得する
3. 記事を共通形式へ正規化する
4. 重複を除外する
5. 一覧用 JSON を生成する
6. 静的ページを生成する
7. GitHub Pages へ公開する

---

## 12. 非機能要件

### 12.1 配信
- GitHub Pages で安定して公開できること
- 外部バックエンドを必須にしないこと

### 12.2 更新
- GitHub Actions で定期更新できること
- 単一フィードの失敗で全体を停止しないこと

### 12.3 パフォーマンス
- 初回表示が重くなりすぎないこと
- 必要に応じて記事JSONを分割できる設計にすること

### 12.4 保守性
- フィード追加・削除が設定ファイル中心で行えること
- UI と収集処理を分離できること

---

## 13. 受け入れ条件

### 13.1 機能
- 複数の RSS / Atom フィードから記事一覧を生成できる
- 新着順で一覧表示できる
- カテゴリ別・媒体別の絞り込みができる
- 各記事から元記事へ遷移できる

### 13.2 運用
- GitHub Actions の定期実行で更新できる
- GitHub Pages 上で公開できる
- 一部フィードの失敗時も前回公開済みサイトが利用可能である

### 13.3 データ
- 同一記事の重複掲載が抑制される
- 一覧表示に必要な最小項目を保持できる

---

## 14. 将来拡張

v2 以降で追加検討可能な項目:

- クライアントサイド検索
- タグ付与
- AI要約
- お気に入り媒体のピン留め
- OPML import / export
- PWA 化
- 外部本文抽出補助
