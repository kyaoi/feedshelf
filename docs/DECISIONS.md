# FeedShelf Decisions

## D-001: 記事本文は保持しない

- 決定: v1 では記事本文を自サイト内に保持しない
- 理由: 公開RSSの多くは本文配信を保証せず、本文抽出は技術的・運用的に重くなりやすいため
- 影響: FeedShelf は一覧・要約・リンク集約を主目的とする

## D-002: 記事閲覧は外部遷移とする

- 決定: ユーザーは FeedShelf から元記事へ遷移して本文を読む
- 理由: RSS品質差や本文取得の不確実性を避け、MVPの実装を軽量化するため
- 影響: UI は「最短で元記事へ飛べること」を重視する

## D-003: オフライン閲覧は v1 の対象外とする

- 決定: オフラインキャッシュやPWA必須対応は行わない
- 理由: 記事本文を保持しない設計と整合し、初期実装コストを下げるため
- 影響: モバイル対応は行うが、オフライン読書は提供しない

## D-004: 公開 RSS / Atom のみを収集対象とする

- 決定: v1 の入力は公開RSS / Atomフィードのみとする
- 理由: ソース追加・更新・運用を単純に保つため
- 影響: API連携やスクレイピングは v1 では扱わない

## D-005: GitHub Pages + GitHub Actions を標準構成とする

- 決定: 公開は GitHub Pages、定期更新は GitHub Actions を前提とする
- 理由: 無料寄り・低運用負荷・静的配信との相性がよいため
- 影響: v1 はバックエンド常駐を前提にしない

## D-006: まずは仕様書先行で進める

- 決定: 実装前に `docs/SPEC_V1.md` / `docs/TRACEABILITY.md` / `.diffship` ガイドを整える
- 理由: diffship 前提の spec-first workflow と相性がよいため
- 影響: 挙動変更は docs と traceability の更新を伴う

## D-007: v1 は静的生成データを正とする

- 決定: v1 ではランタイムDBや常設バックエンドを前提とせず、GitHub Actions で生成した静的データを UI の正とする
- 理由: GitHub Pages 前提の構成と整合し、低コスト・低運用負荷を維持できるため
- 影響: `feeds`, `articles`, `categories`, `sources` などの生成成果物仕様が重要になる

## D-008: ルーティングは一覧中心とする

- 決定: v1 の主要導線はトップ / カテゴリ別 / 媒体別とし、記事詳細ページは任意機能として扱う
- 理由: 「一覧から素早く外部遷移する」利用体験が中心であり、詳細ページを必須にすると初期実装範囲が広がるため
- 影響: 最初の実装は一覧体験を優先し、詳細ページは後回しにできる

## D-009: フィード定義は `data/feeds.json` に集約する

- 決定: v1 のフィード定義ソースはリポジトリ配下の `data/feeds.json` に一本化する
- 理由: GitHub Pages + GitHub Actions 前提の静的構成と相性がよく、差分レビューや feed 追加作業を単純化できるため
- 影響: 取得処理は `data/feeds.json` を入力として読み、v1 では DB や管理UIを持たない

## D-010: フィードIDは安定したキーとして扱う

- 決定: フィードの `id` は ASCII kebab-case を基本とし、表示名とは別の安定キーとして扱う
- 理由: 生成JSONの参照、ルーティング、内部キーとして再利用しやすくするため
- 影響: UI 表示名の変更と内部識別子の変更を分離できる

## D-011: 記事正規化オブジェクトは canonical な中間表現として扱う

- 決定: 取得後の記事は UI 直結の最終生成物ではなく、共通の canonical article object に正規化する
- 理由: RSS / Atom 差分を一度吸収し、後段の dedupe・JSON 生成・UI 参照の責務を分離しやすくするため
- 影響: `FS-DATA-04` では生成物 shape を別途決め、`FS-DATA-02` では記事 1 件の共通契約を優先する

## D-012: optional 項目の欠損表現は `null` / `[]` に固定する

- 決定: 単数の optional 項目は `null`、配列項目は `[]` を使い、v1 では省略しない
- 理由: UI と生成処理の分岐を減らし、JSON shape を安定させるため
- 影響: `summary`, `publishedAt`, `author`, `imageUrl`, `sourceItemId` は nullable、`tags` は常に配列になる

## D-013: `publishedAt` は nullable、`fetchedAt` は必須とする

- 決定: フィードが公開日時を持たない場合でも記事を保持できるようにし、取得時刻 `fetchedAt` は必ず保存する
- 理由: 日時品質の低い RSS / Atom を過剰に捨てず、ソートやデバッグに使える最低限の時刻情報を確保するため
- 影響: 一覧表示や並び順では `publishedAt ?? fetchedAt` を前提に扱える

## D-014: 記事側にも表示用メタデータを冗長保持する

- 決定: `sourceName` / `category` / `language` は `data/feeds.json` 由来でも記事オブジェクト側に保持する
- 理由: 生成物や UI が feed 定義への追加 join なしで最低限の表示に必要な情報を読めるようにするため
- 影響: 記事 1 件だけを参照しても媒体名・カテゴリ・言語が分かる

## D-015: `summary` は表示用の正規化済み文字列として扱う

- 決定: `summary` は表示用の短い正規化済み文字列とし、raw HTML 全文の保持は前提にしない
- 理由: 静的 UI でのサニタイズ負荷と実装分岐を増やさず、v1 の一覧用途に必要十分な情報量へ絞るため
- 影響: 正規化処理は HTML をそのまま保存するのではなく、表示向けの文字列整形を行う

## D-016: dedupe は v1 でも全 feed 横断だが conservative に行う

- 決定: dedupe は feed 内限定ではなく全 feed 横断で行うが、判定は `normalizedUrl` と `(feedId, sourceItemId)` のみを使う
- 理由: 一覧での重複表示を抑えつつ、タイトル類似だけによる誤爆を避けるため
- 影響: v1 では fuzzy dedupe を入れず、同じ話題でも URL や source item が異なれば別記事として残りうる
- V2 メモ: title/date 類似や内容類似を使う fuzzy dedupe は別タスクで再検討する

## D-017: URL 正規化は「壊さない」変形だけに限定する

- 決定: scheme / host の lowercase、default port 除去、fragment 除去、tracking query 除去など安全な正規化のみ行う
- 理由: dedupe 精度を上げつつ、host 固有ルールや推測変換による誤変形を避けるため
- 影響: `normalizedUrl` は v1 の dedupe 用 canonical 値になるが、完全 canonical URL を保証しない
- V2 メモ: redirect 解決、AMP → canonical、host 固有ルールは後続タスクで扱う

## D-018: 記事 ID は URL 優先の段階的 hash で生成する

- 決定: `id` は `normalizedUrl` → `(feedId, sourceItemId)` → `feedId + normalizedTitle + publishedAt` fallback の順で hash 生成する
- 理由: feed をまたいでも安定しやすい識別子を優先しつつ、URL や source item が弱い feed でも最低限の内部キーを作るため
- 影響: `id` は内部安定キーとして扱い、UI の表示文字列や外部URLそのものとしては使わない
- V2 メモ: canonical URL 解決や richer provenance を導入した場合は ID 生成式の再評価余地がある

## D-019: 重複マージは richest-wins + earliest fetchedAt とする

- 決定: duplicate merge では情報量の多い record を winner にしつつ、`fetchedAt` は最初に観測した時刻を残す
- 理由: 一覧表示で必要な情報をなるべく失わず、いつ最初に観測したかも保持したいため
- 影響: `summary` / `author` / `imageUrl` / `tags` / `seenInFeeds` などは統合ルールを前提に扱う
- V2 メモ: 本文抜粋、score、信頼度など richer merge policy が必要になれば別 decision を追加する

## D-020: v1 の provenance は `seenInFeeds[]` に限定する

- 決定: 全 feed 横断 dedupe の結果として、同一記事が観測された feed は `seenInFeeds[]` に `feedId` 集合として保持する
- 理由: cross-feed provenance を完全に捨てずに残しつつ、canonical article object の複雑化を最小限に抑えるため
- 影響: `feedId` / `sourceName` / `category` / `language` は primary record の値を採用し、完全 provenance graph は持たない
- V2 メモ: feed ごとの observedAt や source metadata を含む richer provenance object は後続タスクで再検討する

## D-021: canonical article object と公開 JSON の責務を分離する

- 決定: canonical article object は取得・正規化・dedupe 用の内部中間表現とし、UI が読む公開 JSON は listing-ready shape を別契約で持つ
- 理由: 後続の dedupe / provenance / pipeline 実装を変えても、UI 契約の揺れを抑えやすくするため
- 影響: `articles.json` / `categories.json` / `sources.json` / `meta.json` の shape を別途固定する
- V2 メモ: internal cache と public export のレイヤ分離をさらに強める場合は、保存形式を再設計する

## D-022: v1 の公開 JSON は 4 ファイルを基本単位とする

- 決定: v1 の公開 JSON は `articles.json` / `categories.json` / `sources.json` / `meta.json` を基本単位とし、sharding や pagination は導入しない
- 理由: UI 導線に必要な情報を過不足なく持たせつつ、初期実装を複雑化しないため
- 影響: `articles.json` は listing-ready summary object 配列、`categories.json` / `sources.json` は導線用 summary object 配列、`meta.json` は生成時刻と件数を持つ
- V2 メモ: route 単位 JSON、検索 index、pagination、日付 shard を再検討する

## D-023: `categoryId` は公開 JSON 用の安定 slug とする

- 決定: 公開 JSON の `categoryId` は表示ラベルとは別の安定キーとして扱い、v1 ではカテゴリラベル由来の stable slug を使う
- 理由: ルーティングや内部参照を表示名変更から切り離すため
- 影響: slug 衝突は build error とし、`categoryLabel` は表示専用とする
- V2 メモ: category master data を hand-authored source に昇格させるか再検討する

## D-024: Phase 2 の実行モデルは GitHub Actions-first とする

- 決定: v1 の取得・生成パイプラインは GitHub Actions からの定期実行を標準とし、公開向け CLI 契約は必須にしない
- 理由: GitHub Pages + GitHub Actions 前提の運用と整合し、MVP で必要な責務を最小差分で実装できるため
- 影響: 実装は workflow から呼べる内部 entrypoint を持つが、v1 では配布用 CLI を前提にしない
- V2 メモ: ローカル運用や外部 scheduler を強める場合は CLI / service interface を再検討する

## D-025: 長期保持する取得 state は cache / artifact ではなく管理された実データとして保存する

- 決定: 記事履歴や dedupe 用 state の正本は Actions cache や artifact に依存させず、repository 管理下の保存先に置く
- 理由: cache / artifact は長期永続の前提が弱く、履歴や再取得戦略の基盤としては不安定なため
- 影響: v1 では専用 `data` branch など、公開成果物と分離した保存先を採用してよい
- V2 メモ: データ量や更新頻度が増えたら DB / object storage への移行を再検討する

## D-026: 内部 pipeline entrypoint は Actions とローカル再現の両方から呼べる形にする

- 決定: 取得・正規化・生成処理は `pnpm` scripts などから呼べる内部実行入口として実装し、Actions とローカル再現で同じ処理系を使う
- 理由: 実装責務を workflow YAML に埋め込みすぎず、検証と保守をしやすくするため
- 影響: v1 の `FS-PIPE-01` は「GitHub Actions から呼べる取得入口」を作るタスクとして扱う
- V2 メモ: パイプラインが複雑化した場合はジョブ分割や専用 runner 向けの実行設計を見直す

## D-027: 公開用生成物と内部 state は責務を分離する

- 決定: GitHub Pages に出す公開 JSON / 静的サイトと、dedupe や履歴のための内部 state は別レイヤとして扱う
- 理由: 公開契約を安定させつつ、内部の取得戦略や履歴表現を後から拡張しやすくするため
- 影響: `articles.json` などの公開生成物だけを長期運用の正本として扱わない
- V2 メモ: public export と internal cache の保存形式をさらに強く分離する場合は別仕様を追加する

## D-028: v1 の pipeline entrypoint は Node script + `pnpm` script で固定する

- 決定: `FS-PIPE-01` の内部 entrypoint は `scripts/pipeline/run.js` とし、`pnpm run pipeline:run` から呼べる形で実装する
- 理由: workflow YAML に処理を埋め込みすぎず、GitHub Actions とローカル再現で同じ実行入口を共有するため
- 影響: リポジトリには `package.json` / `justfile` / `mise.toml` を置き、apply 後のローカル自動処理は `mise install` → `just bootstrap` → `just ci` で揃える
- V2 メモ: pipeline が複雑化した場合は TypeScript 化や `src/` への昇格を再検討する

## D-029: FS-PIPE-02 では RSS / Atom の core field だけを canonical article object に正規化する

- 決定: `FS-PIPE-02` は RSS `<item>` と Atom `<entry>` の core field を canonical article object へ正規化し、本文取得・dedupe・公開 JSON 生成は後続タスクへ分離する
- 理由: Phase 2 を「取得入口 → 正規化 → dedupe → 公開生成」の順で責務分離し、最小差分で安全に進めるため
- 影響: この段階では `title` / `url` が欠けた item はスキップし、`summary` / `publishedAt` / `author` / `imageUrl` / `sourceItemId` は nullable contract に従って埋める
- V2 メモ: 名前空間の多い feed や HTML-rich content の扱いが不足する場合は、専用 parser 導入を後続で検討する

## D-030: FS-PIPE-03 の dedupe は `normalize -> dedupe` の独立段として実装する

- 決定: `FS-PIPE-03` は `scripts/pipeline/dedupeArticles.js` を独立段として追加し、`runPipeline` では canonical article object の配列を受け取って dedupe してから後続段へ渡す
- 理由: `FS-PIPE-02` の正規化責務を崩さず、dedupe key / merge rule / provenance-lite を単体テストしやすい境界として分離するため
- 影響: `runPipeline` の summary には `dedupedArticles` と `duplicatesCollapsed` を含め、ログでも dedupe 結果を確認できる
- V2 メモ: 履歴 state や公開 JSON 生成が入る段階で、dedupe module を internal state layer と接続するか再検討する


## D-031: FS-PIPE-04 の公開 JSON 生成は専用 module で `public/data` へ出力する

- 決定: `FS-PIPE-04` は `scripts/pipeline/buildPublicExports.js` を追加し、`runPipeline` では dedupe 済み canonical article object から `articles.json` / `categories.json` / `sources.json` / `meta.json` を生成して標準では `public/data/` へ書き出す
- 理由: 公開 JSON 契約を dedupe や将来の UI 実装から分離し、出力先も静的配信用の分かりやすい既定値へ固定したいため
- 影響: `runPipeline` の summary には公開件数と `outputDir` / `generatedAt` を含め、`--dry-run` では同じ shape を in-memory で検証できる
- 影響: `categoryId` slug は v1 では transliteration を行わず、Unicode を保持した deterministic slug + collision error を採用する
- V2 メモ: feed fetch / state save / static page build が入ったら、public export module を build orchestration からさらに分離するか再検討する

## D-032: Phase 3 の Web UI は static HTML / CSS / JS とする

- 決定: v1 の Web UI は `public/` 配下の static HTML / CSS / JS として実装する
- 理由: GitHub Pages 前提の構成と整合し、Phase 3 を最小差分で安全に進めるため
- 影響: Phase 3 では framework 導入や SSR / SPA router 前提の実装を必須にしない

## D-033: Web UI は `public/data` の read-only consumer とする

- 決定: v1 の UI は `public/data/articles.json` / `categories.json` / `sources.json` / `meta.json` を read-only に読み、追加の dedupe や canonicalization を再実装しない
- 理由: pipeline と UI の責務を分離し、公開 JSON 契約を安定させるため
- 影響: UI は listing-ready JSON をそのまま表示できる shape を前提にする
- 影響: `summary` / `publishedAt` / `imageUrl` など nullable 項目の欠損には UI 側で耐性を持たせる

## D-034: `.diffshipignore` で handoff ノイズを既定除外する

- 決定: `node_modules/`、`.pnpm-store/`、`coverage/`、`*.log`、`public/data/`、`.env*` などのローカル依存物・生成物・秘密情報は `.diffshipignore` で既定除外する
- 理由: AI に不要な差分を handoff へ載せず、bundle を小さく安定させるため
- 影響: 生成済み `public/data/` を AI に見せたいタスクでは、明示 include か一時的な除外調整が必要になる

## D-035: `FS-WEB-01` ではトップ `/` の summary sections を先に成立させる

- 決定: `FS-WEB-01` ではトップ `/` に新着一覧・カテゴリ summary・媒体 summary を表示し、専用一覧ルートへのリンク化は `FS-WEB-02` / `FS-WEB-03` で追加する
- 理由: Phase 3 の最初の UI を最小差分で成立させつつ、未実装ルートへの 404 リンクを避けるため
- 影響: Phase 3 の中間段階ではカテゴリ / 媒体表示は summary section としてよく、導線の完全実装は後続タスクで行う

## D-036: `public/data` 未生成時はトップページで案内を出す

- 決定: `public/data/articles.json` などが 404 の場合、トップページでは generic fetch failure と分けて pipeline 未実行を示す案内を表示する
- 理由: 初回 clone 直後や CI 未実行の状態でも、何が足りないかを分かりやすく伝えるため
- 影響: `FS-WEB-01` の fallback 表示は `missing-data` と `generic error` を区別する

## D-037: `FS-WEB-02` のカテゴリ選択は query parameter 方式とする

- 決定: `FS-WEB-02` のカテゴリ別一覧は `public/categories/index.html` を単一 entrypoint とし、対象カテゴリは `?id=<categoryId>` で指定する
- 理由: GitHub Pages 前提の static hosting で 404 を増やさず、差分を最小に保てるため
- 影響: トップページのカテゴリ chip は `/categories/?id=<categoryId>` へリンクし、`id` 未指定・不正値時はカテゴリ選択導線と案内を表示する


## D-038: `FS-WEB-03` の媒体選択は query parameter 方式とする

- 決定: `FS-WEB-03` の媒体別一覧は `public/sources/index.html` を単一 entrypoint とし、対象媒体は `?id=<sourceId>` で指定する
- 理由: GitHub Pages 前提の static hosting で 404 を増やさず、カテゴリ別一覧と同じ構造で保守できるため
- 影響: トップページの媒体 pill は `/sources/?id=<sourceId>` へリンクし、`id` 未指定・不正値時は媒体選択導線と案内を表示する

## D-039: `FS-WEB-04` の元記事リンクは http/https のみを有効扱いにする

- 決定: 記事カードの元記事リンクは `http` / `https` URL のみ外部遷移として有効化し、それ以外は非活性表示へフォールバックする
- 理由: `javascript:` などの unsafe URL をそのまま描画せず、壊れたデータが混ざっても UI を安全に保つため
- 影響: 有効リンクは新しいタブで開き `noopener noreferrer` を付与し、無効 URL ではタイトルと CTA を非リンク表示にする
- V2 メモ: 外部リンクポリシーや analytics を足す場合は `referrerpolicy` や allowlist を再検討する


## D-040: TypeScript 移行は docs-first の段階移行で進める

- 決定: TypeScript 化は `FS-TS-00` で docs を先に固定し、その後に小さな実装タスクへ分割して進める
- 理由: pipeline / web UI / tests / tooling を一度に動かす大規模変更を避け、diffship 前提で最小差分を保つため
- 影響: 先に `PLAN.md` / `SPEC_V1.md` / `DECISIONS.md` / `TRACEABILITY.md` / `docs/TYPESCRIPT_MIGRATION.md` を更新し、実装は後続タスクで段階投入する

## D-041: 最初に型として固定するのは公開 JSON 契約と pipeline 入出力である

- 決定: TypeScript 化の初手では `articles.json` / `categories.json` / `sources.json` / `meta.json` の shape と pipeline 内の canonical article object 周辺を優先して型付けする
- 理由: pipeline・UI・tests が同じ契約を共有できると、以降の移行が局所化しやすいため
- 影響: `public/assets/app.js` のような UI ロジックも、まず共有型を読む方向で移行計画を立てる

## D-042: 初期導入では `tsx` 実行 + `tsc --noEmit` を採用する

- 決定: TypeScript 初期導入では build 済み `dist/` の必須化を避け、`tsx` による直接実行と `tsc --noEmit` の型検査を基本案とする
- 理由: 現在の Node script 中心の実行モデルに近く、差分を小さく保ったまま型安全化を始めやすいため
- 影響: `dist/` 出力は初期フェーズの必須要件ではないが、将来導入する場合は ignore と運用ルールを先に整備する

## D-043: TypeScript 由来の生成物は repo と handoff の両方で既定除外する

- 決定: 将来 `dist/`、`*.tsbuildinfo`、型検査キャッシュなどが導入された場合は `.gitignore` と `.diffshipignore` の両方で既定除外する
- 理由: handoff ノイズやレビュー対象外の生成物を bundle に混ぜず、AI に渡す差分を小さく保つため
- 影響: 型安全化の実装タスクでは、ignore 更新をセットで扱う


## D-044: `FS-TS-01` では JS entrypoint を `tsx` 実行へ寄せる

- 決定: pipeline / lint の実行入口は、ファイル拡張子がまだ `.js` の段階でも `tsx` から起動する
- 理由: 後続タスクで `.ts` 化しても package script の入口を大きく変えずに済み、移行差分を局所化できるため
- 影響: `package.json` の `pipeline:run` / `lint` は `tsx` ベースとなり、JS と TS の共存期間を許容する

## D-045: `FS-TS-01` から型検査を通常の品質ゲートに含める

- 決定: `tsc --noEmit` を `typecheck` script として導入し、`just ci` / `pnpm run ci` の一部として実行する
- 理由: 実ファイルの全面 `.ts` 化を待たずに、型安全化の入口を早い段階で継続的に検証したいため
- 影響: TypeScript 移行以後の実装は `lint` / `typecheck` / `test` の 3 系統を通す前提で進める


## D-046: `FS-TS-02` の共有型は `src/shared/contracts.ts` に集約する

- 決定: pipeline と公開 JSON 契約で先行導入する TypeScript の共有型は `src/shared/contracts.ts` にまとめる
- 理由: `FeedDefinition` / `CanonicalArticle` / 公開 JSON shape を 1 箇所に置くと、後続の web UI / tests 移行でも同じ契約を参照しやすいため
- 影響: `scripts/pipeline/*.ts` は同ファイルの型を読む前提になり、UI 側の TS 化でも同じ契約を再利用する

## D-047: `FS-TS-02` では pipeline の JS wrapper を一時維持する

- 決定: `scripts/pipeline/*.ts` へ主要処理を移しつつ、同名の `.js` wrapper を残して既存 entrypoint と require 導線を維持する
- 理由: `FS-TS-04` 前に test / lint / package scripts の全面切り替えを強制せず、最小差分で pipeline 本体だけを型安全化したいため
- 影響: 現時点では runtime の入口名は維持されるが、実装の正本は `.ts` 側となる

## D-048: `FS-TS-03` では Web UI の source-of-truth を `src/web/app.ts` に置く

- 決定: `public/assets/app.js` の browser asset path は維持しつつ、Web UI ロジックの source-of-truth は `src/web/app.ts` に移す
- 理由: static HTML の `<script src>` や既存テストの import path を大きく変えずに、UI ロジックだけを段階的に TS 化したいため
- 影響: `public/*.html` はそのまま使え、以後の UI ロジック修正は `src/web/app.ts` を正本として行う

## D-049: `FS-TS-03` の browser asset 再生成は dedicated TypeScript config で行う

- 決定: Web UI 用の emit は `tsconfig.web.json` と `build:web-ui` script に分離し、通常の `tsc --noEmit` と責務を分ける
- 理由: Node 向け pipeline / test の型検査設定と browser asset の emit 設定を分けた方が、移行中の差分と失敗要因を局所化しやすいため
- 影響: `FS-TS-03` 時点では browser asset を再生成できるが、build verify を通常ゲートへ組み込むのは `FS-TS-04` 以降で扱う

## D-050: `FS-TS-04` では tests / lint の entrypoint も `.ts` を正本にする

- 決定: `tests/*.test.ts` と `scripts/lint.ts` を追加し、test / lint の package script は `.ts` entrypoint を直接 `tsx` から実行する
- 理由: pipeline / web UI の source-of-truth が TS 化された段階で、品質ゲート側も同じ実装言語へ揃えた方が diffship 向けの差分追跡と型検査を一貫させやすいため
- 影響: 以後の test / lint 修正は `.ts` ファイルを正本とし、残る `.js` は runtime wrapper または生成 asset に限定される

## D-051: `FS-TS-04` では browser asset の同期を dedicated verify で担保する

- 決定: `public/assets/app.js` は引き続き checked-in browser asset として保持しつつ、`verify:web-ui` で `tsconfig.web.json` から再生成した出力と一致するかを比較する
- 理由: `ci` のたびに tracked file を上書きするよりも、source-of-truth と checked-in asset のズレを検知する専用 verify の方が安全で差分も明確なため
- 影響: `pnpm run ci` / `just ci` は `verify:web-ui` を含み、`src/web/app.ts` を変えた場合は regenerate 後の `public/assets/app.js` も同時に更新する前提となる


## D-052: `FS-TS-05` では strictness 引き上げの初手を `strict: true` に限定する

- 決定: `FS-TS-05` では `tsconfig.json` の `strict` を `true` へ引き上げ、`DOM.Iterable` の追加と最小限の型注釈・null/undefined ガードで既存 TS 実装を適合させる
- 理由: `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` / `allowJs` 撤去まで同時に進めると変更範囲が広がり、strictness 導入と大規模整理が混ざって差分が不安定になるため
- 影響: `strict: true` は通常の `typecheck` で担保し、残る追加 strictness は後続タスクとして段階投入する

## D-053: Phase 4 は `FS-OPS-00` の docs-first planning から始める

- 決定: Phase 4 は `FS-OPS-01` に入る前に、`FS-OPS-00` として workflow / deploy / failure handling の責務分割と実装順を docs に固定する
- 理由: spec 上の更新フローには state 読み書きや公開まで含まれる一方、現行タスクリストは workflow / deploy / failure handling の境界がまだ粗いため、先に責務を整理した方が最小差分で安全に進められる
- 影響: `PLAN.md` / `SPEC_V1.md` / `DECISIONS.md` / `TRACEABILITY.md` を先に更新し、その後の実装タスクはこの分割に従って進める

## D-054: `FS-OPS-01` / `02` / `03` で update・deploy・failure handling を分離する

- 決定: `FS-OPS-01` は update workflow、`FS-OPS-02` は Pages deploy、`FS-OPS-03` は partial failure policy を主責務として分ける
- 理由: 取得・生成・公開・失敗継続を 1 タスクへ混ぜると、workflow YAML だけでなく pipeline 周辺のコード変更まで一度に膨らみやすいため
- 影響: `FS-OPS-01` の時点では deploy を抱え込まず、Pages へ渡す artifact boundary を先に固定する

## D-055: Pages deploy は成功した update artifact からのみ行う

- 決定: GitHub Pages への deploy は、update job が成功し、publish 条件を満たしたときに生成された artifact だけを対象にする
- 理由: 更新失敗や publish 条件未達の状態で新しい生成物を上書き公開すると、前回成功済みサイトを壊すリスクがあるため
- 影響: `FS-OPS-02` では artifact upload/deploy の責務を明確にし、`FS-OPS-03` では deploy skip 条件を実装へ落とし込む

## D-056: feed の実取得は core pipeline の外側に薄く分離してよい

- 決定: `scripts/pipeline/run.js` の core pipeline は pre-fetched `feedDocuments` を受け取る形を維持してよく、enabled feed の network fetch は workflow から呼ぶ薄い orchestration layer として追加してよい
- 理由: 正規化・dedupe・public export の core 処理と、外部 I/O を含む取得責務を分けた方がテストしやすく、既存の pipeline 契約も壊しにくいため
- 影響: `FS-OPS-01` では workflow 追加だけでなく、必要なら feed fetch helper を最小差分で追加する前提を許容する

## D-057: `FS-OPS-01` は `public/` を Pages artifact 境界として固定する

- 決定: `FS-OPS-01` では `.github/workflows/update-public-data.yml` と `scripts/pipeline/update.ts` を追加し、quality gate 通過後に `public/data/` を更新したうえで `public/` 全体を `actions/upload-pages-artifact@v4` に渡す
- 理由: deploy job をまだ導入しない段階でも、Pages へ渡す artifact boundary を先に固定しておくと `FS-OPS-02` で deploy を足しやすく、checked-in static assets と生成 JSON の責務も明確になるため
- 影響: `FS-OPS-02` はこの artifact を deploy する job の追加に集中でき、`FS-OPS-03` は update job の失敗条件と deploy skip 条件の実装に集中できる



## D-058: `FS-OPS-02` は Pages deploy job を workflow 内で分離して追加する

- 決定: `FS-OPS-02` では `.github/workflows/update-public-data.yml` に `deploy-github-pages` job を追加し、`needs: build-public-data`、`environment: github-pages`、`url: ${{ steps.deployment.outputs.page_url }}`、`pages: write` / `id-token: write` permissions、`actions/deploy-pages@v4` を固定する
- 理由: GitHub Pages の custom workflow では deploy job に `pages: write` と `id-token: write` permissions、`needs`、`environment`、`page_url` 出力が必要であり、artifact upload と deploy を分離した方が更新と公開の境界も追跡しやすいため
- 影響: `FS-OPS-02` 完了時点で、成功した update artifact からの公開は workflow 上で自動化される。一方で単一フィード失敗時の継続判定や deploy skip 条件の詳細実装は `FS-OPS-03` に残る

## D-059: `FS-OPS-03` の publish 条件は「enabled feed 1 件以上成功」に固定する

- 決定: `scripts/pipeline/update.ts` では feed ごとの fetch 失敗を収集しつつ継続し、enabled feed のうち 1 件以上の取得に成功した場合のみ pipeline を進める。enabled feed 0 件または全件失敗時は build を失敗させ、deploy を走らせない
- 理由: 単一フィード失敗で全体を止めないという v1 要件を満たしつつ、取得結果 0 件の更新で空の公開物や不完全な公開物へ切り替えて前回成功済みサイトを壊すことを避けるため
- 影響: `FS-OPS-03` では workflow YAML を大きく増やさず、`update.ts` の orchestration layer に partial failure policy を集約する。テストでは「一部失敗なら継続」「全件失敗なら build 失敗」の両方を確認する

## D-060: Phase 5 は `FS-QA-00` の docs-first planning から始める

- 決定: Phase 5 は `FS-QA-01` に入る前に、`FS-QA-00` として spec 実装差分監査 / README・docs 導線整理 / MVP 受け入れ確認の責務分割と実装順を docs に固定する
- 理由: Phase 4 までで MVP に必要な主要実装はほぼ揃っているため、ここで新機能追加と仕上げ作業を混ぜるより、まず監査と受け入れ確認の観点を固定した方が差分を小さく安全に進められるため
- 影響: `PLAN.md` / `docs/SPEC_V1.md` / `docs/TRACEABILITY.md` を先に更新し、その後の Phase 5 タスクはこの境界に従って進める

## D-061: Phase 5 は `FS-QA-01` / `02` / `03` で audit・docs flow・acceptance verification を分離する

- 決定: `FS-QA-01` は差分監査、`FS-QA-02` は README / docs 導線整理、`FS-QA-03` は MVP 受け入れ確認を主責務として分ける
- 理由: 仕様との差分検出・利用者向け導線整備・完了判定は必要なファイルと確認観点が異なり、1 タスクにまとめると docs 変更と実装修正の境界が曖昧になりやすいため
- 影響: `FS-QA-01` では不足の記録を優先し、`FS-QA-02` では README / docs を最小差分で整え、`FS-QA-03` ではテストと手動確認の証跡整理に集中する

## D-062: `FS-QA-01` では残課題を docs flow と acceptance evidence へ絞る

- 決定: `FS-QA-01` の監査結果として、MVP 中核機能は spec / workflow / tests / checked-in assets の範囲で追跡可能と整理し、Phase 5 の残課題を README / docs 導線整備と受け入れ証跡の記録へ絞る
- 理由: この段階で新しい必須機能を追加するより、既存実装との整合確認で見えた docs 入口不足と完了判定不足を先に埋めた方が、差分が小さく安全に Phase 5 を閉じられるため
- 影響: `FS-QA-02` は README / docs 入口の整備に集中し、`FS-QA-03` は既存 quality gate と最小手動確認の証跡化に集中する


## D-063: `FS-QA-02` では `README.md` を人間向け入口、spec docs を正本として分離する

- 決定: `FS-QA-02` では repo 直下に `README.md` を追加し、セットアップ / ローカル確認 / Actions・Pages 前提 / docs の読み順をそこで案内する。一方で、仕様・判断理由・traceability の正本は既存の `docs/` 配下に維持する
- 理由: Phase 5 監査で不足として見えたのは、新機能ではなく入口不足であり、README に利用開始導線を集約しつつ詳細契約は既存 docs へ委ねる方が最小差分で安全なため
- 影響: 以後の利用者向け導線更新はまず `README.md` を見直し、契約変更を伴う場合のみ `SPEC_V1` / `DECISIONS` / `TRACEABILITY` を対応更新する

## D-064: `FS-QA-03` は既存 quality gate と最小手動確認を acceptance evidence として扱う

- 決定: `FS-QA-03` では新しい MVP 機能を追加せず、既存の tests / workflow / checked-in assets / docs を受け入れ根拠として整理し、完了判定は `pnpm run ci` と `pnpm run pipeline:update`、および `/` / `/categories/` / `/sources/` の最小手動確認で行う
- 理由: Phase 5 の目的は機能追加ではなく、MVP として公開可能かを安全に判定することであり、すでに揃っている実装と quality gate を受け入れ証跡として束ねる方が最小差分で安全なため
- 影響: Phase 5 は docs と既存 verification flow の整理で閉じられ、次フェーズでは新しい v2 backlog や運用改善を別タスクとして定義できる

## D-065: Phase DX は `FS-DX-00` の docs-first planning から始める

- 決定: Biome / quality gate / CI 導入は、まず `FS-DX-00` で責務分割と実装順を docs に固定してから進める
- 理由: 既存の workflow / README / tests / package scripts に quality gate 契約のズレがあり、いきなり実装へ入ると formatter 導入・hook 変更・CI 追加が一度に混ざって差分が荒れやすいため
- 影響: `PLAN.md` / `docs/SPEC_V1.md` / `docs/TRACEABILITY.md` を先に更新し、その後の `FS-DX-01` 以降はこの境界に従って進める

## D-066: Biome は baseline formatter / linter とし、repo 固有 check は分離して扱う

- 決定: Biome は formatting / linting の共通基盤として導入し、repository 固有の整合確認は既存の custom script に残す前提で計画する
- 理由: `scripts/lint.ts` には単なる整形・静的解析以外の repo 事情が混ざりうるため、Biome へ責務を寄せすぎると導入時の差分と破壊範囲が大きくなるため
- 影響: `FS-DX-01` は Biome config と対象範囲の追加に集中し、repo 固有 check の整理や統合は `FS-DX-02` で扱う

## D-067: full gate の単一入口は `pnpm run ci` とし、hook は軽量化して分担する

- 決定: full quality gate は `pnpm run ci` を単一入口として扱い、pre-commit は高速で局所的な検査、pre-push と GitHub Actions は full gate を担う方針で進める
- 理由: formatter / lint / typecheck / test / verify を毎回 pre-commit に寄せると開発体験が重くなり、commit 失敗時の修正ループも不安定になりやすいため
- 影響: `FS-DX-00` では verify failure を避けるため `package.json` に最小の `ci` script を補完し、`FS-DX-02` では `justfile` / `lefthook.yml` / repo 固有 check を含む full gate 契約全体を揃える

## D-068: 通常 CI workflow と定期更新 / deploy workflow は分離する

- 決定: Biome / typecheck / test / verify などの通常品質確認は専用 CI workflow へ分離し、既存の `update-public-data` workflow は定期更新と Pages deploy の責務へ寄せる
- 理由: 更新 workflow に通常 CI の責務まで背負わせると、定期実行・手動更新・公開境界の確認と、日常的な品質確認の意図が混ざって追跡しづらくなるため
- 影響: `FS-DX-03` では `.github/workflows/ci.yml` を追加し、`FS-DX-04` では tests / docs / traceability もこの分割へ合わせて更新する

## D-069: pre-commit / CI failure 時は原則 stash せず、working tree を保持して diffship 修正ループへ渡す

- 決定: hook や CI が失敗した場合、原則として失敗したタスクの変更は stash せず working tree に残し、exact HEAD と failure log を添えて diffship 修正ループへ渡す
- 理由: 失敗状態の差分とログをそのまま材料にした方が、AI へ渡す修正対象が明確で、stash / 再適用による unrelated diff 混入も避けやすいため
- 影響: `FS-DX-00` では運用方針を docs に固定し、後続の実装タスクでは hook / CI 失敗時の修正依頼に必要な情報として `git rev-parse HEAD` と failure log を渡す前提を採る

## D-070: FS-DX-01 では Biome を hand-authored な TS / JSON 向け baseline として固定する

- 決定: `FS-DX-01` では `@biomejs/biome` 1.9.4 と `biome.json` を追加し、`.diffship/**` / `public/**` / `scripts/**/*.js` を除外した baseline formatter / linter を導入する
- 理由: checked-in browser asset や JS wrapper、diffship ローカル運用ファイルまで一度に formatter 対象へ含めると差分が荒れやすく、導入初手としては破壊範囲が大きいため
- 影響: `package.json` には `format` / `format:check` / `lint:biome` を追加するが、既存の `lint` は repo 固有 check のまま維持し、full gate や hook との統合は `FS-DX-02` で扱う

## D-071: FS-DX-02 では `check:fast` と `pnpm run ci` の 2 層で gate を揃える

- 決定: `FS-DX-02` では `check:fast` を `format:check` / `lint:biome` / repo 固有 `lint` の束として追加し、full gate は `pnpm run ci = check:fast + typecheck + test + verify:web-ui` とする
- 理由: Biome 導入後も repo 固有 check を分離したまま、pre-commit に載せる高速チェックと pre-push / workflow で使う full gate を同じ script 契約から組み立てた方が、運用と修正ループの両方で見通しがよいため
- 影響: `package.json` / `justfile` / `lefthook.yml` / `tests/typescript-tooling.test.ts` を更新し、`just ci` は `pnpm run ci` の薄いラッパー、pre-commit は `just check-fast`、pre-push は `just ci` へ揃える
- 補足: 既存 runtime の unrelated refactor を `FS-DX-02` へ混ぜないため、initial gate の `biome.json` では `useOptionalChain` / `useArrowFunction` / `useLiteralKeys` / `noGlobalEval` を `off` にして baseline lint を安定化する

## D-072: FS-DX-03 では routine quality gate を `.github/workflows/ci.yml` へ切り出す

- 決定: `FS-DX-03` では `.github/workflows/ci.yml` を追加し、`push` / `pull_request` ごとに `actions/checkout`、`actions/setup-node`、`corepack enable`、`pnpm install --frozen-lockfile`、`pnpm run ci` を実行する通常 CI workflow を導入する
- 理由: pre-push だけに full gate を閉じ込めると GitHub 上の変更でも routine quality gate の結果を追いにくく、更新 / deploy workflow に Pages 固有処理が混ざったままでは通常 CI の失敗原因も切り分けにくいため
- 影響: `.github/workflows/update-public-data.yml` は定期更新 / Pages deploy に専念し、通常の品質確認は `tests/ci-workflow.test.ts` と合わせて `.github/workflows/ci.yml` で追跡する

## D-073: FS-DX-04 では DX docs の契約を workflow と専用 test に同期する

- 決定: `FS-DX-04` では `README.md` に quality gate failure 時の運用入口を追加し、`tests/dx-docs-sync.test.ts` で README / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `docs/TRACEABILITY.md` / `PLAN.md` が `.github/workflows/ci.yml` と `.github/workflows/update-public-data.yml` の境界、ならびに diffship 修正ループ運用を同じ内容で指していることを確認する
- 理由: Biome / hook / workflow の実装だけ整っても、repo 直下の入口と traceability が追随しなければ、将来の修正時に「どの gate がどこで走るか」「失敗時に何を渡すか」の判断が再び docs と実装でずれやすいため
- 影響: `README.md` / `PLAN.md` / `docs/SPEC_V1.md` / `docs/TRACEABILITY.md` を更新し、DX の docs 契約は `tests/dx-docs-sync.test.ts` で継続監視する

## D-074: `tsx` で直接起動する TS CLI entrypoint は direct-execution guard で self-execute する

- 決定: `package.json` から `tsx scripts/pipeline/run.ts` / `tsx scripts/pipeline/update.ts` を直接起動する entrypoint は、各 `.ts` ファイル自身が `process.argv[1]` と自分の相対パスを比較する direct-execution guard を持ち、CLI 実行時だけ `main()` を呼ぶ
- 理由: exported `main()` だけを持つ module のままだと `tsx <file>.ts` 実行時に no-op となり、`public/data` が生成されない不具合を防げないため。`import.meta` や `require.main` への固定は現行の TypeScript / runtime 組み合わせと相性差分があるため避ける
- 影響: require 用の `.js` wrapper に依存しなくても、CLI の正本挙動は `.ts` entrypoint 単体で完結している必要がある。guard は current tsconfig と `tsx` / Node 実行の両方で安全に評価できる形に保つ


## D-075: V1 の残スコープは shelf-first な読み物棚体験へ拡張する

- 決定: 旧MVPで成立している「新着 / カテゴリ / 媒体」中心の静的RSSリーダーを、Phase 6 では「興味を惹かれる記事へ出会いやすい読み物棚」へ拡張する
- 理由: 今後の V1 では速報性や一覧効率よりも、惹かれる記事を見つけやすい discovery-first な体験を優先したいため
- 影響: ルート `/` の役割、主要 route、公開 JSON、tag / search、contributor flow まで含めて再設計対象になる

## D-076: GitHub Pages は単一サイト構成を維持し、棚ページはその内部 route として提供する

- 決定: GitHub Pages は 1 repo / 1 site を前提とし、`/<shelfId>/` を root-level shelf route、`/tags/` / `/search/` / `/sources/` を固定補助 route として提供する
- 理由: 無料・低運用負荷を維持しつつ、棚ごとの閲覧体験を分けたいが、repo 分割や複数 Pages site 運用は採らないため
- 影響: 棚追加は新しい Pages site 追加ではなく、単一 build artifact 内の route 追加として扱う

## D-077: 棚定義と source 定義は `data/shelves.yaml` と `data/feeds.json` に責務分離する

- 決定: 棚定義は `data/shelves.yaml`、source 定義は `data/feeds.json` に置き、両者の責務を分離する
- 理由: 棚の説明と route policy、source の取得設定と所属情報を分けた方が contributor が扱いやすく、将来の拡張にも耐えやすいため
- 影響: `feeds.json` に UI 文章や custom path を混ぜず、`shelves.yaml` は site / shelf の説明だけを持つ
- 影響: `shelves.yaml` に `feedUrl` / `siteUrl` / `enabled` / source tag のような取得設定を持たせない
- 影響: contributor は「棚追加は `shelves.yaml`、source 追加・棚紐付け・source tag 更新は `feeds.json`」という編集境界を前提にする

## D-078: 棚 route は `shelfId` から決定し、v1 では custom path を持たない

- 決定: v1 の棚 route は `/<shelfId>/` とし、`path` のような自由入力フィールドは導入しない
- 理由: GitHub Pages 単一サイト構成と相性がよく、route 競合や設定ミスを避けやすいため
- 影響: `shelfId` は安定した ASCII kebab-case とし、reserved ids との衝突を docs で管理する

## D-079: source の棚所属は `category` ではなく `shelfIds[]` で表現する

- 決定: source の棚所属は `category` 文字列ではなく `shelfIds[]` 配列で持つ
- 理由: 1 source が複数棚に属する余地を残しつつ、`category` という語の曖昧さを避けたいため
- 影響: loader / contract / UI / search は `shelfIds[]` を前提に設計する。単数・複数の union は導入しない

## D-080: `feeds.json.tags` は source に対する手動キュレーションタグとする

- 決定: `data/feeds.json` の `tags` は feed / source に手で付与する curator-managed tag とする
- 理由: source の性格や棚の雰囲気を安定して表現でき、source 追加時の意図共有にも使いやすいため
- 影響: UI では source 補助情報、tag page、search 対象の 1 つとして扱える

## D-081: 記事ごとの `entryTags` は RSS / Atom metadata から best-effort で抽出する

- 決定: 記事ごとのタグは RSS / Atom metadata に category / tag 相当がある場合のみ `entryTags` として保持し、取れない場合は空配列とする
- 理由: 一部 feed では metadata が利用できる一方で、全 feed での一貫性は保証できないため
- 影響: tag page と search は `entryTags` 欠損に依存せず成立する必要がある
- 影響: `entryTags` は `feeds.json` や `shelves.yaml` に手入力する項目ではなく、pipeline が best-effort で導出する metadata として扱う

## D-082: Phase 6 でも無料運用を維持し、有料API・外部AI・外部検索基盤は採用しない

- 決定: Phase 6 の棚・tag・search 拡張でも、有料API、外部AI、外部検索基盤、常設バックエンドは導入しない
- 理由: GitHub Pages + GitHub Actions の無料寄り・低運用負荷という v1 の前提を崩さないため
- 影響: tag 生成は手動または RSS / Atom metadata 由来に限定し、検索は build-time index + client-side で実装する

## D-083: 検索は title / sourceName / sourceTags / entryTags を対象にした静的検索とする

- 決定: v1 の検索対象は title / sourceName / sourceTags / entryTags を基本とし、build-time に search index を生成して client-side で検索する
- 理由: 棚や tag から辿る discovery 体験を補完しつつ、無料・静的運用を維持できるため
- 影響: title 一致を主とし、tag / source 名一致は補助スコアとして扱う設計候補を取る

## D-084: tag page は sourceTags と entryTags の両方を discovery 導線として扱う

- 決定: v1 の tag page では source 手動タグと記事 metadata 由来タグの両方を導線に載せてよい
- 理由: tag の由来は異なっても、ユーザーにとっては「興味軸から辿る入口」として統合されている方が使いやすいため
- 影響: tag summary では両由来タグを集計してよいが、実装上は sourceTags / entryTags を別フィールドで保持する

## D-085: source 導線は残すが、主役は shelf / tag / search とする

- 決定: `/sources/` は補助導線として維持してよいが、V1 extension 後の主役導線は `/`, `/<shelfId>/`, `/tags/`, `/search/` とする
- 理由: 既存実装の価値を保ちながらも、読み物棚としての体験中心を明確にしたいため
- 影響: source page は残ってもよいが、トップや棚ページの情報設計では source 一覧を主役にしない
