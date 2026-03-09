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
- 更新時刻
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

リンク挙動:
- 元記事リンクは `http` / `https` URL のみ有効な外部遷移として扱う
- 有効なリンクは新しいタブで開き、`noopener noreferrer` を付与する
- URL が欠損または unsafe な場合は、記事カードを壊さず非活性表示へフォールバックする

### 6.2 カテゴリ別一覧

- ルートは `/categories/` とし、v1 では `?id=<categoryId>` クエリで対象カテゴリを指定する
- 指定カテゴリの記事のみを表示する
- 標準ソートは新着順とする
- `id` 未指定または不正な場合は、カテゴリ選択導線と案内メッセージを表示する

### 6.3 媒体別一覧

- ルートは `/sources/` とし、v1 では `?id=<sourceId>` クエリで対象媒体を指定する
- 指定媒体の記事のみを表示する
- 標準ソートは新着順とする
- `id` 未指定または不正な場合は、媒体選択導線と案内メッセージを表示する

### 6.4 記事詳細ページ

v1 では必須ではない。

採用する場合でも本文は保持せず、以下のみを表示する。
- タイトル
- 媒体名
- 公開日時
- 要約
- 元記事リンク

### 6.5 Phase 3 の実装境界

- v1 の Web UI は `public/` 配下の static HTML / CSS / JS として実装する
- UI は `public/data/articles.json` / `categories.json` / `sources.json` / `meta.json` を read-only に読む
- UI 側で dedupe、feed 定義との追加 join、canonicalization の再計算を行わない
- v1 の主要ルートは `/` / `/categories/` / `/sources/` を基本とする
- `/categories/` と `/sources/` の対象選択は、v1 では static hosting と相性のよい query parameter 方式を採用してよい
- 記事詳細ページは v1 の必須対象外とする

### 6.6 TypeScript 移行方針

- `FS-TS-00` は docs-first task とし、実装前に移行順序・責務・品質ゲートを固定する
- TypeScript 化は一括置換ではなく、`pipeline -> public web UI -> tests / lint / verify` の順で段階移行する
- 初期導入では `tsx` による直接実行と `tsc --noEmit` による型検査を基本とし、いきなり build 出力必須にはしない
- 共存期間は `allowJs` を許容してよいが、新規または移行済みロジックは `.ts` を優先する
- まず型として固定する対象は公開 JSON 契約と pipeline 入出力であり、UI / tests も同じ契約を共有する
- 将来 `dist/`、`*.tsbuildinfo`、追加キャッシュなどの生成物が生じる場合は repo と handoff の ignore ルールを更新する
- 具体的な移行順序・対象ファイル・実行方式の候補は `docs/TYPESCRIPT_MIGRATION.md` に集約する
- `FS-TS-01` では `tsconfig.json` を追加し、既存の pipeline / lint entrypoint は `tsx` から実行できる状態を基準にする
- `FS-TS-01` では `tsc --noEmit` を quality gate に追加し、JS / TS 共存期間でも型検査を先に導入する
- `FS-TS-02` では pipeline と公開 JSON の共有型を `src/shared/contracts.ts` に集約し、主要 pipeline 実装を `scripts/pipeline/*.ts` へ移す
- `FS-TS-02` では既存の CLI / test import surface を壊さないため、同名の `.js` wrapper を互換用に残してよい
- `FS-TS-03` では Web UI の source-of-truth を `src/web/app.ts` に置き、browser が読む `public/assets/app.js` は互換 asset path として維持してよい
- `FS-TS-03` で build step が必要になった場合は、専用 config から `public/assets/app.js` を更新する方式を採用してよい
- `FS-TS-04` では tests と lint の入口を `.ts` へ寄せ、`public/assets/app.js` の同期は build 実行そのものではなく verify 手順で検査してよい
- `FS-TS-04` では `pnpm run ci` / `just ci` に browser asset の verify を含め、checked-in asset が source-of-truth とずれていないことを確認できるようにする
- `FS-TS-05` ではまず `strict: true` を有効化し、`noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` / `allowJs` 縮退は後続の段階タスクへ分離してよい

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
  "sourceItemId": null,
  "seenInFeeds": ["itmedia-news"]
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
- `seenInFeeds`

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
- `seenInFeeds` は同一記事が観測された `feedId` の集合を保持し、v1 では feed 単位の provenance だけを残す

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

## 10. URL 正規化・ID 生成・重複排除

### 10.1 URL 正規化

`url` は取得時の生値をそのまま dedupe に使わず、v1 では安全な範囲の正規化を行った `normalizedUrl` 相当で扱う。`normalizedUrl` は内部計算値であり、canonical article object に保存必須とはしない。

許可する正規化:
- scheme / host は lowercase に揃える
- default port は除去する
- fragment (`#...`) は除去する
- path の不要な末尾 slash は整理する
- query parameter はキー順へ安定化する
- 明確な tracking parameter は除去する
  - `utm_*`
  - `fbclid`
  - `gclid`
  - `mc_cid`
  - `mc_eid`

### 10.2 v1 で行わない URL canonicalization

以下は v1 では行わない。

- host 固有の特別ルール
- redirect 追跡による最終 URL 解決
- `amp` から canonical への推測変換
- `ref`, `source`, `from` など意味を壊す可能性がある汎用 query parameter の一律除去

### 10.3 記事 ID 生成

`id` は内部安定キーであり、UI 表示用文字列ではない。

v1 の生成優先順位は以下とする。

1. `normalizedUrl` がある場合
   - `id = hash("url:" + normalizedUrl)`
2. `normalizedUrl` が弱い / 欠損し、`sourceItemId` がある場合
   - `id = hash("feed:" + feedId + "|item:" + sourceItemId)`
3. 最後の fallback
   - `id = hash("fallback:" + feedId + "|" + normalizedTitle + "|" + publishedAt_or_empty)`

補足:
- `normalizedTitle` は title の trim と連続空白の縮約を行った比較用文字列とする
- hash は SHA-256 由来の短縮 hex を想定してよい
- URL 生文字列やタイトル生文字列をそのまま ID として露出させない

### 10.4 dedupe key の優先順位

重複判定は全 feed 横断で行う。

優先順位:
1. `normalizedUrl`
2. `(feedId, sourceItemId)`
3. それ以外では dedupe しない

補足:
- v1 では fuzzy dedupe を行わない
- `title` 類似だけでは同一記事とみなさない

### 10.5 重複時の merge ルール

重複候補が見つかった場合は richest-wins を基本とし、以下のルールで統合してよい。

- `publishedAt`: non-null を優先する
- `fetchedAt`: 最小値（最初に観測した時刻）を採用する
- `summary`: より情報量の多いものを優先する
- `author`: non-null を優先する
- `imageUrl`: non-null を優先する
- `tags`: unique union とする
- `seenInFeeds`: unique union とする
- `feedId` / `sourceName` / `category` / `language`: winner とした primary record の値を使う
- 同点時は `fetchedAt` が早い record を winner にしてよい

### 10.6 v1 の provenance

- v1 では full provenance object は持たず、`seenInFeeds` に `feedId` の集合だけを保持する
- 媒体名やカテゴリなどの表示系メタデータは primary record の値を採用する
- より詳細な provenance 構造は v2 で再検討する

---

## 11. 生成物 JSON 契約

### 11.1 責務分離

- canonical article object は取得・正規化・dedupe 用の内部中間表現とする
- UI が読む公開 JSON は listing-ready な別契約とする

公開 JSON は、UI が追加の dedupe や join をせずに一覧を表示できる shape を優先する。

### 11.2 v1 の公開 JSON 分割単位

v1 の公開 JSON は次の 4 つを基本とする。

- `articles.json`
- `categories.json`
- `sources.json`
- `meta.json`

補足:

- v1 実装では公開 JSON の build 出力ディレクトリを `public/data/` とする
- v1 では route ごとの shard や pagination 用 JSON は作らない

### 11.3 `articles.json`

`articles.json` は dedupe 済み・表示用・ソート済みの記事 summary object 配列とする。

```json
[
  {
    "id": "article-id",
    "title": "記事タイトル",
    "url": "https://example.com/article",
    "summary": "表示用要約",
    "publishedAt": "2026-03-07T09:00:00+09:00",
    "sortAt": "2026-03-07T09:00:00+09:00",
    "sourceId": "itmedia-news",
    "sourceName": "ITmedia NEWS 新着",
    "categoryId": "jp-it",
    "categoryLabel": "日本IT",
    "imageUrl": null
  }
]
```

ルール:

- `sortAt` は `publishedAt ?? fetchedAt` を公開用に確定した値とする
- 配列は `sortAt` の降順で並べる
- `sourceId` は canonical article object の `feedId` を public JSON 向けに写した値とする
- `sourceItemId`, `seenInFeeds`, `fetchedAt`, `tags`, `author` などの内部寄り情報は v1 の公開 JSON では必須にしない

### 11.4 `categories.json`

`categories.json` はカテゴリ一覧や導線表示に使う summary object 配列とする。

```json
[
  {
    "id": "jp-it",
    "label": "日本IT",
    "articleCount": 120,
    "latestSortAt": "2026-03-08T08:00:00Z"
  }
]
```

ルール:

- `id` は stable slug とする
- `label` は表示用文字列とする
- `articleCount` は公開対象の記事数とする
- `latestSortAt` はカテゴリ内の最新 `sortAt` とする

### 11.5 `sources.json`

`sources.json` は媒体一覧や媒体導線に使う summary object 配列とする。

```json
[
  {
    "id": "itmedia-news",
    "name": "ITmedia NEWS 新着",
    "siteUrl": "https://www.itmedia.co.jp/",
    "language": "ja",
    "categoryId": "jp-it",
    "categoryLabel": "日本IT",
    "articleCount": 42,
    "latestSortAt": "2026-03-08T08:00:00Z"
  }
]
```

ルール:

- `id` は `data/feeds.json` の feed `id` を使う
- `articleCount` は公開対象の記事数とする
- `latestSortAt` はその source に属する最新 `sortAt` とする

### 11.6 `meta.json`

`meta.json` は生成時刻と件数を公開する単一オブジェクトとする。

```json
{
  "generatedAt": "2026-03-08T08:00:00Z",
  "articleCount": 1234,
  "sourceCount": 18,
  "categoryCount": 6
}
```

### 11.7 `categoryId` の導出

`categoryId` は `categoryLabel` とは別の安定キーとして扱う。v1 ではカテゴリ表示ラベル由来の stable slug を使ってよい。

ルール:

- `categoryLabel` は表示専用とする
- `categoryId` は route / 内部参照 / 集計キーに使う
- v1 実装では label を NFKC 正規化し、小文字化し、非 letter/number 連続を `-` に畳んだ slug を使う
- transliteration は行わず、Unicode の文字は保持してよい
- slug 衝突は build error とする

### 11.8 v2 で再検討する項目

- `categories/<id>.json` / `sources/<id>.json` の個別生成
- `articles` の sharding / pagination
- search 向け専用 index
- public JSON での richer provenance
- category master data の独立管理

### 11.9 UI 消費側の前提

- v1 の UI は `articles.json` / `categories.json` / `sources.json` / `meta.json` だけで一覧表示に必要な情報を取得できる前提で実装する
- `summary` / `publishedAt` / `imageUrl` など nullable な公開項目が欠けても UI が壊れないようにする
- UI は fetch 中、0件、fetch 失敗時の最低限表示を持つ
- `public/data/*.json` がまだ生成されていない場合は pipeline 未実行が分かる案内を表示してよい


## 12. Phase 2 の実行・保存・公開戦略

### 12.1 v1 の実行モデル

v1 の取得・生成パイプラインは GitHub Actions からの定期実行を標準とする。

- GitHub Actions が定期的に pipeline を起動する
- pipeline は内部 script / module entrypoint を呼び出して取得・正規化・dedupe・JSON 生成を行う
- エンドユーザー向けの CLI 契約は v1 の必須要件にしない
- 同じ内部 entrypoint はローカルでも再現実行できる形を維持する

### 12.2 内部 entrypoint の位置づけ

- `pnpm` scripts などから呼べる内部実行入口を持つ
- これは workflow から再利用できる実装単位であり、公開 CLI 製品を意味しない
- v1 実装では `scripts/pipeline/run.js` が dedupe 後に `public/data/` へ `articles/categories/sources/meta` を書き出す
- `--output-dir` を与えた場合のみ出力先を差し替えてよく、`--dry-run` では in-memory 生成のみを行う
- v1 では Actions から呼べることを優先し、ローカル実行は再現・検証手段として扱う

### 12.3 永続 state の保存方針

長期的に保持したい state は、Actions cache や artifact ではなく、管理された実データとして保持する。

保持対象の例:
- dedupe 後の canonical article records
- seen article IDs / normalized URLs
- feed ごとの最終取得メタデータ

ルール:
- cache は依存関係や一時高速化にのみ使う
- artifact は build/deploy の受け渡しにのみ使う
- 永続 state の正本は repository 管理下の保存先に置く
- v1 では専用 `data` branch など、公開サイト本体と分離した保存先を採用してよい

### 12.4 公開データと内部 state の分離

- `articles.json` / `categories.json` / `sources.json` / `meta.json` は Pages 公開用の生成物とする
- dedupe や再取得に必要な内部 state は公開 JSON と責務を分ける
- 公開用生成物だけで運用履歴を表現しようとしない

### 12.5 v1 の更新・公開フロー

1. フィード定義を読み込む
2. 永続 state を読み込む
3. 各 RSS / Atom を取得する
4. 記事を canonical article object へ正規化する
5. URL 正規化と dedupe を行う
6. 公開 JSON (`articles/categories/sources/meta`) を生成する
7. 静的ページを生成する
8. GitHub Pages へ公開する
9. 更新後の内部 state を保存先へ書き戻す

### 12.6 v2 で再検討する項目

- SQLite / D1 / 外部 KV などへの state 保存先移行
- build と state 保存の別 repository 化
- より高度な増分取得戦略
- 監視 / 通知を含む workflow 運用

---

## 13. 非機能要件

### 13.1 配信
- GitHub Pages で安定して公開できること
- 外部バックエンドを必須にしないこと

### 13.2 更新
- GitHub Actions で定期更新できること
- 単一フィードの失敗で全体を停止しないこと

### 13.3 パフォーマンス
- 初回表示が重くなりすぎないこと
- 必要に応じて記事JSONを分割できる設計にすること

### 13.4 保守性
- フィード追加・削除が設定ファイル中心で行えること
- UI と収集処理を分離できること

---

## 14. 受け入れ条件

### 14.1 機能
- 複数の RSS / Atom フィードから記事一覧を生成できる
- 新着順で一覧表示できる
- カテゴリ別・媒体別の絞り込みができる
- 各記事から元記事へ遷移できる

### 14.2 運用
- GitHub Actions の定期実行で更新できる
- GitHub Pages 上で公開できる
- 一部フィードの失敗時も前回公開済みサイトが利用可能である

### 14.3 データ
- 同一記事の重複掲載が抑制される
- 一覧表示に必要な最小項目を保持できる
- canonical article object と公開 JSON の責務が分離されている

---

## 15. 将来拡張

v2 以降で追加検討可能な項目:

- クライアントサイド検索
- タグ付与
- AI要約
- お気に入り媒体のピン留め
- OPML import / export
- PWA 化
- 外部本文抽出補助
- host 固有 canonicalization
- fuzzy dedupe
- richer provenance 記録
- public JSON の sharding / pagination
