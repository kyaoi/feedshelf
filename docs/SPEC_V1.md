# FeedShelf 仕様書 v1

## 1. 概要

FeedShelf は、複数の公開 RSS / Atom フィードから記事情報を収集し、静的サイトとして配信する「読み物棚」型のWebアプリである。

本バージョンでは、記事本文を自サイト内に保持しない。ユーザーは FeedShelf 上でタイトル・要約・公開日時・媒体・タグ・棚情報を確認し、興味を惹かれた記事を元記事へ読みに行く。

配信基盤は GitHub Pages、更新基盤は GitHub Actions を前提とし、単一の静的サイト内で `/` を棚カタログ、`/<shelfId>/` をジャンル別の棚ページ、`/tags/` と `/search/` を補助導線として提供する。

---

## 2. 目的

- 興味を惹かれる記事に出会いやすい shelf-first な体験を提供する
- 複数媒体の記事を棚・タグ・検索で横断的に辿れるようにする
- source の追加、新しい棚の追加、tag の整理を Git 管理下の手作業だけで継続できるようにする
- 低コストかつ運用負荷の低い無料構成で継続的に更新できるようにする
- 将来的な richer 検索や UI 改善に耐える最低限のデータ構造を整える

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
- 外部の有料 API / 有料検索基盤 / 有料AI への依存
- おすすめ記事 / レコメンド
- コメント機能

---

## 4. 想定ユーザー

- IT / 科学 / AI などの興味分野を「棚」単位でゆるく巡回したい個人ユーザー
- 新着の網羅よりも、惹かれる記事を見つけやすい UI を好むユーザー
- PC / スマホから短時間でも棚・タグ・検索を使って記事を探索したいユーザー

---

## 5. MVP

MVP として最低限必要な機能は以下とする。

- `data/shelves.yaml` に棚定義を保持できる
- `data/feeds.json` に source 定義・`shelfIds[]`・手動タグを保持できる
- 定期的にフィードを取得できる
- RSS / Atom 記事を共通形式へ正規化できる
- 重複記事を抑制できる
- ルート `/` で棚カタログを表示できる
- `/<shelfId>/` で棚別一覧を表示できる
- `/tags/` でタグ導線を表示できる
- `/search/` で title / tag / source 名を対象に検索できる
- `/sources/` で source 別導線を補助的に提供できる
- 記事から元記事へ遷移できる
- GitHub Actions により定期更新できる
- GitHub Pages で公開できる

---

## 6. 画面仕様

### 6.1 ルート `/`（棚カタログ）

ルート `/` は「全記事の新着フィード」を主役にするページではなく、
「どんな棚があり、どこから見始めるとよいか」を最短で掴める棚カタログとして扱う。

情報階層:
1. site intro / 更新状況 / 検索導線
2. 棚カード一覧（主役）
3. tag 導線などの discovery 補助
4. source 導線や全体新着の補助表示（必要なら）

表示項目:
- サイトタイトル
- サイト説明 / intro
- 更新時刻
- 検索導線
- 棚カード一覧
- 主要タグ導線
- 補助的な source 導線（例: `すべての source を見る` の二次 CTA や compact な source pills）

ルール:
- ファーストビューでは「何のサイトか」と「どんな棚があるか」を優先的に伝える
- 既存の source 一覧や全体新着一覧は残してよいが、棚カード一覧より上位の情報階層には置かない
- root で source 導線を見せる場合も、full directory を最初から大きく展開するのではなく、compact な補助 CTA / pills / short list に留める
- 棚の並び順は機械的な件数順ではなく、`data/shelves.yaml` に書かれた棚順を基本とする
- 棚ごとの専用画像や装飾 asset は v1 の必須要件にしない

棚カード表示項目:
- 棚タイトル
- 棚説明
- article 件数
- source 件数
- 更新 freshness を伝える補助情報（例: `latestSortAt` ベースの更新時刻）
- 棚の雰囲気を伝える補助情報（例: representative tags / short copy）
- 棚ページへのリンク

### 6.2 棚ページ `/<shelfId>/`

- 棚ごとの固定ルートを持つ
- 棚ページの first view は、少なくとも「概要」と「注目記事」でその棚の雰囲気が伝わる構成にする
- 棚タイトル・説明・関連タグ・記事一覧を表示し、対象 source 一覧は補助導線として扱う
- 標準ソートは新着順とし、記事探索の正本は「新着」セクションに置く
- `source` 一覧は補助導線として扱い、体験の主軸は棚概要・注目記事・新着記事に置く

推奨セクション順:
1. 概要
2. 注目
3. 新着
4. source 導線

#### 6.2.1 概要セクション

概要セクションでは、ユーザーが「この棚にはどんな記事が多いのか」を一目で理解できることを優先する。

表示候補:
- 棚タイトル
- 棚説明
- article 件数
- source 件数
- 更新 freshness を伝える補助情報（例: `latestSortAt` ベースの更新時刻）
- 棚の雰囲気を伝える補助情報（例: `sampleTags` や短い補助コピー）

ルール:
- count / freshness は補助情報であり、棚説明より主役にしない
- 棚専用 hero image や重い演出 asset は v1 の必須要件にしない
- 関連タグを併記してよいが、tag page の完成を待たずとも概要だけで棚の意図が伝わることを優先する

#### 6.2.2 注目セクション

注目セクションは、棚の雰囲気を素早く伝えるための discovery-first な導線とする。

ルール:
- 対象はその棚に属する記事のみとする
- まず 3〜6 件程度を目安にし、件数固定よりも「視認性が高い少数の代表記事」を優先する
- 選定は build-time / client-side のどちらでもよいが、v1 では別の手動 curated list や専用 JSON を必須にしない
- 選定時は freshness に加えて、summary / image / tag があり棚の雰囲気を伝えやすい記事を優先してよい
- 候補が足りない場合は新着から補ってよいが、同一ページ内での過度な重複は避ける
- 注目を成立させるために外部 API や追加の永続ストレージを導入しない

#### 6.2.3 新着セクション

新着セクションは、その棚に属する記事を新しい順に並べる主要一覧とする。

ルール:
- `articles.json` を正本として `shelfIds` で絞り込み、`sortAt` 降順で表示する
- 注目より新着の方が一覧としての網羅性を持つ
- 棚ページで最終的に「全部追う」行為はこのセクションで担う
- 記事が 0 件の場合でも、棚ページ全体を壊さず空状態メッセージを表示する

#### 6.2.4 source 導線セクション

source 導線は補助的な案内セクションとし、その棚を構成する媒体群を把握できればよい。

表示候補:
- source 名
- language
- article 件数
- 最新更新 freshness
- `/sources/?id=<sourceId>` へのリンク
- 必要なら関連 shelf / tag へ戻る補助導線

ルール:
- source 一覧は棚ページ下部または記事一覧より下位の情報階層に置く
- source 一覧を棚ページの主役に戻さない
- source detail へ遷移したあとも shelf-first な探索へ戻りやすいよう、source 名だけで閉じず関連棚・tag への接続を持たせてよい
- 棚に属する source を 0 件以上表示できる前提とし、件数が多い場合は簡潔な pills / list 形式でよい

記事カード表示項目:
- タイトル
- visible tags（`entryTags` / `sourceTags` から導出した一部）
- 媒体名
- 公開日時または freshness
- 要約（あれば）
- サムネイル（あれば）
- 元記事へのリンク

#### 6.2.5 記事カード（discovery-first）

記事カードは「あとで精読するための metadata 一覧」ではなく、
「まず開いてみたい記事を見つけるための discovery unit」として扱う。

基本の情報優先度:
1. タイトル
2. タグ（`entryTags` を優先し、足りなければ `sourceTags` で補う）
3. source 名
4. 公開日時 / freshness
5. 要約・画像（あれば補助）

ルール:
- カード先頭を metadata pills の密集列にしない。最初に目に入るのはタイトルとする
- visible tag は 0〜3 件程度を目安にし、`entryTags` を優先、足りなければ `sourceTags` を補完し、重複は除く
- source 名はタイトル・タグより一段弱い supporting label として置き、視線の主役にしない
- 棚ページでは現在見ている棚名 / category を各カードへ繰り返し表示することを必須にしない。cross-shelf surface（例: `/search/`, `/tags/`, 全体新着補助一覧）で必要な場合のみ補助表示してよい
- summary は 1〜3 行程度の補助情報として扱い、欠ける場合に目立つ placeholder 文で余白を埋めることを必須にしない
- image は optional とし、ある場合のみ補助的に使う。画像の有無で title / tags の優先度を逆転させない
- CTA は「元記事を開く」を主とし、bookmark / share など追加 action は v1 の必須要件にしない
- 余白は title block / tag block / supporting meta を分けて認知負荷を下げるために使い、情報量を増やすために先頭へ pills を詰め込みすぎない

リンク挙動:
- 元記事リンクは `http` / `https` URL のみ有効な外部遷移として扱う
- 有効なリンクは新しいタブで開き、`noopener noreferrer` を付与する
- URL が欠損または unsafe な場合は、記事カードを壊さず非活性表示へフォールバックする

### 6.3 タグ導線 `/tags/`

- タグ一覧ページを持つ
- v1 の tag detail は `/tags/?id=<tagId>` を canonical とし、固定ページ + query parameter 方式で提供する
- sourceTags と entryTags のどちらから来たタグでも一覧導線に載せてよい
- `id` 未指定または不正な場合は、タグ選択導線と案内メッセージを表示する

### 6.4 検索 `/search/`

- v1 の検索は client-side 実装とする
- 検索対象は title / sourceName / sourceTags / entryTags を基本とする
- 検索語は `/search/?q=<query>` を canonical とする query parameter で保持する
- 外部API、外部検索基盤、ベクトル検索、AI semantic search は導入しない

### 6.5 source 導線 `/sources/`

`/sources/` は「どの記事がどの媒体から来ているか」を確認するための source directory / profile として扱う。
発見の開始地点はあくまで棚・tag・検索に置き、source page はそれらを補助する存在とする。

役割:
- source の identity / trust / coverage を確認する
- source 名から逆引きしたいときの fallback browse を提供する
- 関連 shelf / tag / recent articles へ接続する

非目的:
- `/sources/` を root や棚ページより先に見る primary dashboard に戻さない
- source directory を root の first view や棚ページ上位に大きく再掲しない

推奨構成:
1. source 導線の説明と、棚 / tags / search へ戻る補助 CTA
2. source directory（一覧または compact cards）
3. `id` 指定時の source profile
4. その source の recent articles

ルール:
- source 別一覧は v1 でも残してよいが、棚・タグ・検索の補助導線として位置づける
- source detail は `/sources/?id=<sourceId>` を canonical とする query parameter 方式で継続する
- `id` 未指定または不正な場合は、source 選択導線と案内メッセージを表示する
- source profile では少なくとも `name` / `siteUrl` / `language` / `shelfIds` / `tags` / `articleCount` / `latestSortAt` を扱ってよい
- source detail では「その source が属する棚」への導線を必須候補とし、必要に応じて tag 導線も併記してよい
- source detail の article 一覧は `articles.json` を `sourceId` で絞って構築し、source 専用の article export JSON を初期必須にしない
- source page は source を起点に再探索するための場所であり、検索・tag page の完成を待たずとも shelf へ戻れることを優先する

### 6.6 Phase 6 の実装境界

- Phase 6 では UI の主役を `/` と `/<shelfId>/` へ移す
- GitHub Pages は単一サイト構成を維持し、棚ページは root-level route とする
- v1 では棚の custom path は持たず、route は `shelfId` から決定する
- `shelfId` と固定 route の衝突を避けるため、reserved ids を仕様で固定する
- canonical な内部 route は trailing slash 付き directory route (`/`, `/<shelfId>/`, `/tags/`, `/search/`, `/sources/`) を基本とする
- tag / search / source の detail state は root-level の追加 route を増やさず、固定ページ上の query parameter (`/tags/?id=...`, `/search/?q=...`, `/sources/?id=...`) で表現する
- `/tags/` と `/search/` は補助導線だが、検索・タグページの有無に依存せず棚ページだけでも最低限の探索が成立するようにする
- 既存の `/categories/` は互換導線として残す場合も reserved route として扱い、shelf 用には再利用しない
- 既存の source 導線は補助的に維持してよい

### 6.7 TypeScript 移行方針

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

Phase 6 以降の定義ファイルは、リポジトリ管理下の hand-authored source として以下を持つ。

- `data/shelves.yaml`: 棚定義
- `data/feeds.json`: source 定義

- GitHub Actions の取得処理はこれらを入力とする
- v1 では DB や外部管理画面を使わない
- contributor は Git 管理下で棚追加・source追加・tag付与を行う

### 7.2 `data/shelves.yaml`

`shelves.yaml` は site 全体の導入文と、棚 (`shelf`) の定義だけを持つ。

各棚には以下の情報を持たせる。

- `id`: 一意な棚識別子。URL slug の source of truth
- `title`: 棚タイトル
- `description`: 棚の説明

site には以下を持たせる。

- `title`
- `description`
- `intro`

制約:
- v1 では棚ごとの custom path を持たない
- route は `/<shelfId>/` のように `id` から決定する
- `id` は ASCII kebab-case を基本とする
- reserved ids（例: `tags`, `search`, `sources`, `assets`, `data`, `index`）とは衝突させない

### 7.2.1 `shelves.yaml` の責務境界

`data/shelves.yaml` は棚 taxonomy と棚を紹介する文章だけを持つ。

`data/shelves.yaml` に持たせるもの:

- site の `title` / `description` / `intro`
- 各 shelf の `id` / `title` / `description`

`data/shelves.yaml` に持たせないもの:

- `feedUrl` / `siteUrl` / `enabled` のような取得設定
- source ごとの手動タグや記事タグ
- 棚ごとの custom path / route override

棚を新設したいときは、まず `shelves.yaml` に棚定義を追加し、その後必要な source 側の `shelfIds[]` を更新する。

### 7.2.2 `shelfId` と URL 設計

棚 route の canonical URL は `/<shelfId>/` とする。

GitHub Pages 単一サイト前提で、v1 の root-level route namespace は次を基本とする。

- `/`
- `/<shelfId>/`
- `/tags/`
- `/search/`
- `/sources/`
- `/categories/`（互換導線として残す場合）
- `/assets/`
- `/data/`

棚 ID に対する reserved ids は少なくとも以下を固定する。

- `tags`
- `search`
- `sources`
- `categories`
- `assets`
- `data`
- `index`

制約:

- internal link は trailing slash 付き directory route を canonical とする
- `shelfId` から route を自動決定し、custom path / alias は持たない
- tag / search / source の detail state は固定ページ上の query parameter で表現し、v1 では per-tag / per-source の root-level route を増やさない
- 将来 root-level route を追加する場合は reserved ids と docs を同時に更新する

### 7.3 `data/feeds.json`

`data/feeds.json` は JSON 配列とし、各要素は 1 source 定義オブジェクトとする。

各 source には以下の情報を持たせる。

- `id`: 一意な source 識別子
- `name`: 媒体名
- `feedUrl`: RSS / Atom URL
- `siteUrl`: 媒体トップURL
- `language`: 言語
- `enabled`: 有効 / 無効
- `shelfIds`: 所属する棚 ID の配列
- `tags`: source に手で付けるキュレーションタグ配列

### 7.3.1 `feeds.json` の責務境界

`data/feeds.json` は source registry であり、取得設定と source 単位の discovery metadata を持つ。

`data/feeds.json` に持たせるもの:

- `id` / `name` / `feedUrl` / `siteUrl` / `language` / `enabled`
- source が属する `shelfIds[]`
- source に対して手で付ける `tags[]`

`data/feeds.json` に持たせないもの:

- shelf の説明文や site の導入文
- `path` のような route override
- 記事ごとの手動 `entryTags` や article-level override

source を追加・無効化・棚へ紐付け・source tag を調整したい場合は `feeds.json` を編集する。

### 7.3.2 registry 間の join ルール

`shelves.yaml` と `feeds.json` は `shelfIds[]` を介して join する。

- 1 source は 1 つ以上の shelf に属する
- 1 shelf は 0 個以上の source を持ちうる
- `feeds.json.shelfIds[]` の各値は `shelves.yaml` に存在しなければならない
- shelf を削除または rename する場合は、参照する全 source の `shelfIds[]` も同時に更新する

`entryTags` は input registry ではなく、RSS / Atom metadata から pipeline が生成する article metadata として扱う。

### 7.4 スキーマ制約

- `id` は ASCII の kebab-case を推奨し、URL や生成物キーに再利用できる安定値とする
- `name` は UI 表示名として使える文字列とする
- `feedUrl` は取得対象の公開 RSS / Atom URL とする
- `siteUrl` は媒体トップまたはフィードに対応するサイトURLとする
- `language` は `ja`, `en` などの短い言語コードを想定する
- `enabled=false` の source は取得対象から除外してよい
- `shelfIds` は必須の配列とし、空配列を許容しない
- `shelfIds[]` の各値は `shelves.yaml` に存在しなければならない
- `tags` は任意の配列とし、source の性格を表す手動タグとして扱う
- `entryTags` は `feeds.json` に手入力せず、pipeline で RSS / Atom metadata から best-effort 生成する
- v1 では `category` のような単数ラベルではなく `shelfIds[]` を正式仕様候補とする

### 7.5 例

`shelves.yaml`:

```yaml
site:
  title: FeedShelf
  description: 興味を惹かれる記事を見つけるための読み物棚
  intro: ジャンルごとに気になる話題を辿れる静的な記事棚

shelves:
  - id: it
    title: IT
    description: 日本IT・Web・開発まわりの記事をまとめて眺める棚
  - id: science
    title: Science
    description: 科学系の論文や記事をまとめて眺める棚
```

`feeds.json`:

```json
[
  {
    "id": "publickey",
    "name": "Publickey",
    "feedUrl": "https://www.publickey1.jp/atom.xml",
    "siteUrl": "https://www.publickey1.jp/",
    "language": "ja",
    "enabled": true,
    "shelfIds": ["it"],
    "tags": ["日本IT", "開発", "クラウド"]
  },
  {
    "id": "hacker-news",
    "name": "Hacker News",
    "feedUrl": "https://hnrss.org/frontpage",
    "siteUrl": "https://news.ycombinator.com/",
    "language": "en",
    "enabled": true,
    "shelfIds": ["it", "science"],
    "tags": ["海外IT", "スタートアップ"]
  }
]
```

---

## 8. 記事データモデル

記事は取得後に canonical article object へ正規化する。

このオブジェクトは、フィード取得結果を UI や生成物へ渡す前の共通中間表現として扱う。最終生成物 shape は別タスクで決める。

```json
{
  "id": "stable-id",
  "feedId": "publickey",
  "sourceName": "Publickey",
  "language": "ja",
  "shelfIds": ["it"],
  "title": "記事タイトル",
  "url": "https://example.com/article",
  "summary": "要約またはdescription",
  "publishedAt": "2026-03-07T09:00:00+09:00",
  "fetchedAt": "2026-03-08T06:00:00Z",
  "author": null,
  "imageUrl": null,
  "sourceTags": ["日本IT", "開発"],
  "entryTags": ["Kubernetes"],
  "sourceItemId": null,
  "seenInFeeds": ["publickey"]
}
```

### 必須かつ non-null の項目

- `id`
- `feedId`
- `sourceName`
- `language`
- `shelfIds`
- `title`
- `url`
- `fetchedAt`
- `sourceTags`
- `entryTags`
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
- `shelfIds` / `language` / `sourceTags` は `data/feeds.json` 由来の表示用メタデータを記事側にも冗長保持する
- `entryTags` は RSS / Atom metadata から取れれば保持し、取れない場合は空配列とする
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
- `sourceName` / `shelfIds` / `language` / `sourceTags` は元フィード定義から補完する

### 9.8 記事タグ
- RSS / Atom metadata から記事ごとの category / tag 情報が取れる場合は `entryTags` に正規化する
- 取れない場合は空配列 `[]` とする
- `entryTags` は best-effort とし、source ごとの語彙差や欠損を許容する

### 9.9 元アイテム識別子
- `guid` / `id` などの元フィード項目が取れる場合は `sourceItemId` に保持する
- 取得できない場合は `sourceItemId=null` とする

### 9.10 optional 値の表現
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
- `sourceTags`: unique union とする
- `entryTags`: unique union とする
- `seenInFeeds`: unique union とする
- `feedId` / `sourceName` / `shelfIds` / `language`: winner とした primary record の値を使う
- 同点時は `fetchedAt` が早い record を winner にしてよい

### 10.6 v1 の provenance

- v1 では full provenance object は持たず、`seenInFeeds` に `feedId` の集合だけを保持する
- 媒体名や棚所属などの表示系メタデータは primary record の値を採用する
- より詳細な provenance 構造は v2 で再検討する

---

## 11. 生成物 JSON 契約

### 11.1 責務分離

- canonical article object は取得・正規化・dedupe 用の内部中間表現とする
- UI が読む公開 JSON は listing-ready / search-ready な別契約とする

公開 JSON は、UI が追加の dedupe や heavy join をせずに棚・タグ・検索を実装できる shape を優先する。

### 11.2 Phase 6 以降の公開 JSON 分割単位

Phase 6 では次の公開 JSON を基本候補とする。

- `articles.json`
- `shelves.json`
- `sources.json`
- `tags.json`
- `search-index.json`
- `meta.json`

補足:

- build 出力ディレクトリは引き続き `public/data/` とする
- v1 では route ごとの shard は必須ではない
- `articles.json` を article card 表示用の canonical public listing とし、棚・タグ・検索は summary / lightweight index でこれを補助する
- `tags.json` は tag list 用 summary、`search-index.json` は検索用 summary / ranking index とし、full article card payload の正本にはしない
- v1 の tag detail と search result は `articles.json` を主に使い、`tags.json` と `search-index.json` は導線・絞り込み・スコアリング補助に使う

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
    "sourceId": "publickey",
    "sourceName": "Publickey",
    "shelfIds": ["it"],
    "sourceTags": ["日本IT", "開発"],
    "entryTags": ["Kubernetes"],
    "imageUrl": null
  }
]
```

ルール:

- `sortAt` は `publishedAt ?? fetchedAt` を公開用に確定した値とする
- 配列は `sortAt` の降順で並べる
- `sourceId` は canonical article object の `feedId` を public JSON 向けに写した値とする
- `shelfIds` は source が属する棚の配列を公開用にも保持する
- `sourceTags` と `entryTags` は検索・タグ導線・記事カード補助情報に使えるよう公開してよい
- UI は `entryTags` / `sourceTags` から visible card tags を軽量導出してよく、`cardTags` のような専用公開 field を v1 必須にしない
- `sourceItemId`, `seenInFeeds`, `fetchedAt`, `author` などの内部寄り情報は v1 の公開 JSON では必須にしない

### 11.4 `shelves.json`

`shelves.json` は棚一覧や棚カタログ表示に使う summary object 配列とする。

```json
[
  {
    "id": "it",
    "title": "IT",
    "description": "日本IT・Web・開発まわりの記事をまとめて眺める棚",
    "articleCount": 120,
    "sourceCount": 5,
    "latestSortAt": "2026-03-08T08:00:00Z",
    "sampleTags": ["日本IT", "開発", "クラウド"]
  }
]
```

ルール:

- 配列順は `data/shelves.yaml` に記述された棚順を基本とする
- `sampleTags` は root の棚カードで雰囲気を伝えるための 0〜3 件程度の補助情報として持ってよい
- `sampleTags` は sourceTags / entryTags から build-time に要約してよく、欠けていても UI を壊さない
- `latestSortAt` は棚の鮮度表示に使ってよいが、root の主役はあくまで棚そのものとする
- 棚ページの概要セクションもこの summary object を再利用してよく、棚ごとの full article payload は `articles.json` から解決する
- v1 では `shelves/<id>.json` のような per-shelf detail JSON を必須にしない
- 注目セクションは `articles.json` を `shelfIds` で絞った結果から導出してよく、注目専用 JSON を別途要求しない

### 11.5 `sources.json`

`sources.json` は source 一覧や source 導線に使う summary object 配列とする。

```json
[
  {
    "id": "publickey",
    "name": "Publickey",
    "siteUrl": "https://www.publickey1.jp/",
    "language": "ja",
    "shelfIds": ["it"],
    "tags": ["日本IT", "開発", "クラウド"],
    "articleCount": 42,
    "latestSortAt": "2026-03-08T08:00:00Z"
  }
]
```

ルール:

- `/sources/` の directory と source profile はこの summary object を正本にしてよい
- source detail の recent articles は `articles.json` を `sourceId` で絞って解決し、`sources/<id>.json` のような per-source detail JSON を v1 で必須にしない
- `shelfIds` は source から棚へ戻る補助導線として使ってよく、shelf-first な IA と矛盾しないよう source page でも visible にしてよい
- `tags` は source の性格や得意分野を伝える補助情報として使ってよいが、tag page 本体の正本は `tags.json` + `articles.json` とする

### 11.6 `tags.json`

`tags.json` はタグ一覧やタグ導線に使う summary object 配列とする。

```json
[
  {
    "id": "kubernetes",
    "label": "Kubernetes",
    "articleCount": 12,
    "sourceCount": 2,
    "latestSortAt": "2026-03-08T08:00:00Z"
  }
]
```

ルール:

- v1 では sourceTags と entryTags を同じ tag summary へ統合してよい
- `id` は安定 slug とする
- `label` は表示用文字列とする
- tag detail で article 一覧を出すときは、`tags.json` 自体に full article list を持たせず、`articles.json` の `sourceTags` / `entryTags` から絞り込む前提を取ってよい
- ただし集計上は `sourceTagArticleCount` / `entryTagArticleCount` のような由来別 count を将来拡張できる余地を残してよい

### 11.7 `search-index.json`

`search-index.json` は title / sourceName / sourceTags / entryTags を対象にした検索用 index とする。

```json
[
  {
    "articleId": "article-id",
    "title": "記事タイトル",
    "sourceName": "Publickey",
    "shelfIds": ["it"],
    "tags": ["日本IT", "Kubernetes"],
    "sortAt": "2026-03-07T09:00:00+09:00",
    "searchText": "記事タイトル Publickey 日本IT Kubernetes"
  }
]
```

ルール:

- build 時に検索対象文字列を前処理してよい
- v1 では client-side 検索を前提とし、検索 index は外部サービスに依存しない
- title の一致を最優先し、tag / source 名一致は補助スコアとして扱う設計候補を採る
- search result 表示時は `articleId` をキーに `articles.json` へ解決し、カード表示に必要な summary / image / URL などの正本は `articles.json` から取る
- `search-index.json` は ranking / matching 用の lightweight index とし、article card 表示用の full payload を二重管理しない

### 11.8 `meta.json`

`meta.json` は生成時刻と件数を公開する単一オブジェクトとする。

```json
{
  "generatedAt": "2026-03-08T08:00:00Z",
  "articleCount": 1234,
  "sourceCount": 18,
  "shelfCount": 6,
  "tagCount": 40
}
```

### 11.9 v2 で再検討する項目

- `shelves/<id>.json` や `tags/<id>.json` の個別生成
- `articles` の sharding / pagination
- 検索スコアの高度化や同義語正規化
- public JSON での richer provenance
- contributor 向け registry file の更なる分割 (`data/sources/*.yaml`, `data/shelves/*.yaml`)

### 11.10 UI 消費側の前提

- v1 の UI は `articles.json` / `shelves.json` / `sources.json` / `tags.json` / `search-index.json` / `meta.json` を基本として棚・タグ・検索を実装する
- ルート `/` は `shelves.json` と `meta.json` を主に使って棚カタログを組み立て、`tags.json` / 検索導線 / source 導線は補助情報として扱う
- 棚ページと tag detail は `articles.json` を中心に組み立て、`shelves.json` / `tags.json` / `sources.json` は一覧導線や summary 表示に使う
- article card は surface ごとの文脈を前提にし、棚ページでは current shelf / category の繰り返し表示を必須にしない
- discovery-first surface では title / visible tags / source の階層を優先し、dense な metadata pills を card 冒頭へ並べない
- search UI は `search-index.json` で match / score / sort 候補を作り、その後 `articles.json` を参照して article card を描画する
- `summary` / `publishedAt` / `imageUrl` / `entryTags` など nullable または optional な公開項目が欠けても UI が壊れないようにする
- UI は fetch 中、0件、fetch 失敗時の最低限表示を持つ
- `public/data/*.json` がまだ生成されていない場合は pipeline 未実行が分かる案内を表示してよい
- narrow viewport (目安: 768px 以下) では root / shelf / source / tag / search の主要 surface を 1 カラム前提に落とし込み、横スクロール前提のレイアウトにしない
- article card の image / meta / tag は縦積みへ自然に崩してよく、モバイルでは title・visible tags・source の優先度を保ったまま supporting info を後段へ送る
- long title / long tag は wrap / clamp / chip 数制限などで吸収し、1 件のタイトルや tag がカード幅や panel 幅を押し広げないようにする
- loading / empty / error は同じ panel / section 文脈の status surface で扱ってよく、empty と error の文言・視覚トーンは分ける
- empty state では「まだ記事がない」「別の棚 / tag / source を見る」といった次アクションを示し、error state では再読込や静的サーバー・pipeline 確認へ誘導する

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
- v1 実装では `scripts/pipeline/run.ts` が dedupe 後に `public/data/` へ `articles/categories/sources/meta` を書き出す
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

### 12.5 Phase 4 の docs-first planning

Phase 4 は、実装に入る前に `FS-OPS-00` で workflow / deploy / failure handling の責務を docs に固定してから進める。

- `FS-OPS-01` は update workflow の責務を持ち、schedule / manual trigger / concurrency / quality gate / enabled feed の取得 / pipeline 呼び出し / Pages artifact 準備までを扱う
- `FS-OPS-02` は Pages deploy の責務を持ち、`FS-OPS-01` が成功時に生成した artifact だけを公開対象にする。deploy は update job と分離した job で行い、`needs` / `environment: github-pages` / `page_url` output を明示する
- `FS-OPS-03` は partial failure policy の責務を持ち、単一フィード失敗の収集・publish 条件・deploy skip 条件を実装へ落とし込む
- v1 の publish 条件は「enabled feed のうち 1 件以上の取得と生成が成功していること」とし、全件失敗または enabled feed 0 件の更新では deploy を行わない
- 現在の `scripts/pipeline/run.ts` は pre-fetched な `feedDocuments` を受け取る形を維持してよく、feed の実取得は薄い orchestration layer として workflow 側または隣接 script に分離してよい

### 12.6 v1 の更新・公開フロー

1. フィード定義を読み込む
2. 永続 state を読み込む
3. 各 RSS / Atom を取得する
   - 単一フィード失敗は収集して継続する
   - enabled feed の全件失敗時は publish 不可として build を失敗させる
4. 記事を canonical article object へ正規化する
5. URL 正規化と dedupe を行う
6. 公開 JSON (`articles/categories/sources/meta`) を生成する
7. GitHub Pages 用 artifact を生成する
8. GitHub Pages へ公開する
9. 更新後の内部 state を保存先へ書き戻す

### 12.7 v2 で再検討する項目

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
- enabled feed の全件失敗時は新しい公開を行わず、前回成功済みサイトを維持すること

### 13.3 パフォーマンス
- 初回表示が重くなりすぎないこと
- 必要に応じて記事JSONを分割できる設計にすること

### 13.4 保守性
- フィード追加・削除が設定ファイル中心で行えること
- UI と収集処理を分離できること

### 13.5 開発運用 / 品質ゲート
- formatting / lint / typecheck / test / checked-in asset verify をローカルと GitHub Actions の両方で再現できること
- full quality gate は単一入口コマンドから実行できること
- 定期更新 / deploy workflow と通常の品質確認 CI workflow の責務を分離できること
- repo 固有 check は汎用 formatter / linter と混同せず分離できること

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

### 14.4 Phase 5 の docs-first planning

Phase 5 は、実装に入る前に `FS-QA-00` で監査・導線・受け入れ確認の責務を docs に固定してから進める。

- `FS-QA-01` は spec / decisions / traceability / workflow / tests / checked-in assets を横断して、MVP と受け入れ条件に対する差分を洗い出す責務を持つ
- `FS-QA-01` は差分の洗い出しを主眼とし、そこで見つかった不足を一度に広く実装しきることは責務に含めない
- `FS-QA-02` は README を含む利用者向け導線と docs 間リンクの整理を責務とし、最低限のセットアップ手順・ローカル確認方法・GitHub Actions / Pages 前提を一貫した導線として整える
- `FS-QA-03` は Phase 5 完了判定の責務を持ち、既存 test / verify と必要最小限の手動確認を用いて MVP / 受け入れ条件を満たすかを記録する
- Phase 5 では新機能追加よりも、既存仕様との整合・導線の明確化・受け入れ根拠の明文化を優先する

### 14.5 `FS-QA-01` 監査結果

`FS-QA-01` では spec / decisions / traceability / workflow / tests / checked-in assets を突き合わせ、Phase 5 開始時点の差分を以下のように整理する。

確認できたこと:
- フィード定義、取得、正規化、dedupe、公開 JSON 生成、静的 UI 3 ルート、safe external link handling は実装済みとして追跡できる
- GitHub Actions の定期更新、GitHub Pages への deploy、partial failure policy、TypeScript quality gate は workflow / tests / verify まで含めて追跡できる
- 監査時点では、MVP の中核機能に対して新しい必須実装タスクを追加するより、仕上げ用 docs と受け入れ証跡の明文化を優先する方が安全である

この時点で残る差分:
- README が未整備で、初回セットアップ / ローカル確認 / Actions / Pages 前提の入口が repo 直下に揃っていない
- Phase 5 完了判定として残す受け入れ証跡はまだ未記録である
- traceability 上の実装候補表現には、TypeScript source-of-truth と query parameter routing に合わせて更新すべき箇所がある

後続タスクへの受け渡し:
- `FS-QA-02` では README / docs 導線整理を行う
- `FS-QA-03` では quality gate と最小手動確認を用いた受け入れ証跡を残す

---

## 15. 将来拡張

v2 以降で追加検討可能な項目（当初 future 扱いだった tag / search は Phase 6 で v1 scope に繰り上げる）:

- AI要約
- お気に入り媒体のピン留め
- OPML import / export
- PWA 化
- 外部本文抽出補助
- host 固有 canonicalization
- fuzzy dedupe
- richer provenance 記録
- public JSON の sharding / pagination


### 14.6 `FS-QA-02` README / docs 導線整理

`FS-QA-02` では、監査で見つかった docs flow の不足に対して、repo 直下の `README.md` を入口として追加し、以下を一貫した導線として揃える。

- FeedShelf の目的と MVP 前提
- 最低限のセットアップ手順
- `pnpm run ci` / `pnpm run pipeline:update` / `python -m http.server --directory public` によるローカル確認手順
- GitHub Actions / GitHub Pages 前提の公開フロー概要
- `SPEC_V1` / `DECISIONS` / `TRACEABILITY` / `TYPESCRIPT_MIGRATION` / `PLAN` の読み分け

このタスクでは、新しい実装機能や dev server script を追加せず、既存コマンドと既存 docs を最小差分でつなぐことを優先する。

また、`README.md` は人間の入口として扱う一方、仕様の正本は引き続き `docs/SPEC_V1.md`、判断理由の正本は `docs/DECISIONS.md`、仕様と実装・テストの対応表は `docs/TRACEABILITY.md` として分離する。

これにより、Phase 5 の残タスクは `FS-QA-03` の受け入れ証跡整理へ絞られる。

### 14.7 `FS-QA-03` MVP 受け入れ確認

`FS-QA-03` では、新機能追加ではなく、既存の workflow / tests / checked-in assets / docs を根拠に v1 MVP の受け入れ条件を確認する。

受け入れ根拠として使う既存 evidence:

- データ取得・正規化・dedupe・公開 JSON 契約は `tests/load-feeds.test.ts` で確認する
- 更新 workflow・partial failure policy・deploy 境界は `.github/workflows/update-public-data.yml` と `tests/update-workflow.test.ts` で確認する
- 新着 / カテゴリ別 / 媒体別の一覧導線と safe external link handling は `tests/web-home.test.ts` / `tests/web-categories.test.ts` / `tests/web-sources.test.ts` で確認する
- TypeScript tooling と checked-in browser asset の同期は `tests/typescript-tooling.test.ts` と `scripts/verifyWebBuild.ts` で確認する

最小手動確認は以下とする。

1. 少なくとも 1 件の `enabled: true` feed を用意する
2. `pnpm run ci` を通す
3. `pnpm run pipeline:update` で `public/data/articles.json` / `categories.json` / `sources.json` / `meta.json` を生成する
4. `python -m http.server 4173 --directory public` などで `public/` を静的配信する
5. `/` / `/categories/` / `/sources/` を開き、一覧表示と絞り込み導線が成立することを確認する

この確認観点に照らして blocking gap が残っていない場合、FeedShelf v1 の MVP は受け入れ条件を満たしたと扱う。

### 14.8 Phase DX の docs-first planning

Phase DX は、実装に入る前に `FS-DX-00` で Biome / quality gate / CI / failure handling の責務を docs に固定してから進める。

- `FS-DX-01` は Biome の baseline 導入を責務とし、formatting / linting の対象範囲と除外対象を最小差分で固定する
  - `@biomejs/biome` を devDependency として追加し、`biome.json` で `.diffship/**` / `public/**` / `scripts/**/*.js` を対象外にした上で、`biome.json` / `package.json` / `tsconfig*.json` / `data/feeds.json` / `src` / `scripts` / `tests` を明示対象として hand-authored な TS / JSON / config を中心に扱う
  - `format` / `format:check` / `lint:biome` を導入するが、既存の `lint` と `pnpm run ci` への統合は `FS-DX-02` まで遅らせる
- `FS-DX-02` は full gate の単一入口、hook の責務分割、repo 固有 check の位置づけ整理を責務とする
  - `check:fast` を hand-authored な TS / JSON / config に絞った `format:check` / `lint:biome` と repo 固有 `lint` の束として追加し、`pnpm run ci` は `check:fast` に `typecheck` / `test` / `verify:web-ui` を加えた単一入口とする
  - `just ci` は `pnpm run ci` の薄いラッパーとし、lefthook は pre-commit=`just check-fast`、pre-push=`just ci` に分担する
  - 初期 lint gate では既存 runtime の unrelated refactor を避けるため、`biome.json` で `useOptionalChain` / `useArrowFunction` / `useLiteralKeys` / `noGlobalEval` を `off` に固定する
- `FS-DX-03` は通常の品質確認 CI workflow を追加し、既存の update / deploy workflow と責務を分ける
  - `.github/workflows/ci.yml` を追加し、`push` / `pull_request` ごとに `pnpm run ci` を実行する routine quality gate を担わせる
  - `update-public-data` workflow には `pipeline:update` / Pages artifact / deploy を残し、Pages 固有処理を通常 CI へ混ぜない
- `FS-DX-04` は tests / docs / workflow の追跡を同期し、tooling 変更を traceability と確認手順へ反映する
  - `README.md` に pre-commit / pre-push / CI failure 時の運用入口を追加し、working tree を保持したまま `git rev-parse HEAD` と failure log を diffship 修正ループへ渡す手順を repo 直下から読めるようにする
  - `tests/dx-docs-sync.test.ts` を追加し、README / SPEC / DECISIONS / TRACEABILITY / PLAN の DX 契約が workflow ファイルと同じ境界を指していることを継続確認できるようにする
- Phase DX では新しい runtime 機能追加よりも、既存 workflow / docs / package scripts の契約ズレを先に解消することを優先する

既知の契約差として、workflow / README / tests は `pnpm run ci` を前提にしている。`FS-DX-00` では verify failure を避けるため `package.json` に最小の `ci` script を補完し、hook / workflow / repo 固有 check の統合は `FS-DX-02` で行う。

運用上は、pre-commit や CI が失敗した場合でも原則 stash を前提にせず、失敗した変更を working tree に保持したまま exact HEAD と failure log を diffship 修正ループへ渡せるようにする。この運用は `README.md` の失敗時ガイドと `tests/dx-docs-sync.test.ts` の docs 追跡でも確認できる状態に保つ。



## 16. Phase 6 の docs-first planning

Phase 6 では、既存の「新着 / カテゴリ / 媒体」中心の UI をいきなり全面置換するのではなく、まず docs で以下を固定してから実装へ進む。

- `FS-IA-00` では、FeedShelf を「新着を効率よく追うダッシュボード」ではなく「興味を惹かれる記事へ出会う読み物棚」として再定義する
- `FS-IA-01` では、`data/shelves.yaml` と `data/feeds.json` の責務分離、`shelfIds[]`、source 手動タグ、best-effort `entryTags` を正式仕様候補として固定する
- `FS-IA-02` では、GitHub Pages 単一サイト前提の route policy と reserved ids を固定し、棚ページを `/<shelfId>/`、補助導線を固定 route (`/tags/`, `/search/`, `/sources/`) として整理する
- `FS-IA-03` では、公開 JSON と検索 index の責務を明確化し、build-time 生成 + client-side 消費だけで棚・タグ・検索が成立する契約を定義する
- `FS-UX-00` では、ルート `/` を「site intro + 棚カタログ + 補助 discovery 導線」という情報階層に固定し、全体新着や source 一覧を主役から外す
- `FS-UX-01` では、`/<shelfId>/` を「概要 → 注目 → 新着 → source 導線」の情報階層で定義し、棚ページの主役を source 一覧ではなく discovery-first な記事探索へ寄せる
- `FS-UX-04` では、モバイル表示、loading / empty / error、long tag / long title の edge case を docs で固定し、Phase 6 UI 実装の崩れ基準を先に明文化する
- `FS-UX-*` では、ルート `/` を棚カタログとして再設計し、source 導線を主役から補助導線へ位置づけ直す
- `FS-TAG-*` では、source 手動タグと記事 metadata 由来タグの差を保ったまま、タグ一覧・タグ別導線・tag summary の生成を計画する
- `FS-SEARCH-*` では、有料API・外部検索基盤・AI semantic search を使わず、title / sourceName / sourceTags / entryTags を対象にした静的検索を定義する
- `FS-FEED-*` では、source 追加、新棚追加、tag 追加の contribution rule と QA 観点を docs に残し、将来この議論を忘れても拡張できる状態を目指す

Phase 6 では UI 実装だけでなく、情報設計・データ契約・検索・tag・contributor flow を 1 つの V1 extension として扱う。
