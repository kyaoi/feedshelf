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
- Post-v1 注記: この初期決定のうち pagination / page shard の留保は `D-133` で更新済みとし、現在は GitHub Pages 向け static pagination を build-time page shard で実装済みと扱う
- V2 メモ: route 単位 JSON、検索 index、current page shard を超える finer-grained split、日付 shard を再検討する

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

- 決定: `FS-OPS-01` では `.github/workflows/update-public-data.yml` と `scripts/pipeline/update.ts` を追加し、`workflow_dispatch` / `schedule` / `push(main)` で quality gate 通過後に `public/data/` を更新したうえで `public/` 全体を `actions/upload-pages-artifact@v4` に渡す
- 理由: deploy job をまだ導入しない段階でも、Pages へ渡す artifact boundary を先に固定しておくと `FS-OPS-02` で deploy を足しやすく、checked-in static assets と生成 JSON の責務も明確になるため
- 影響: `FS-OPS-02` はこの artifact を deploy する job の追加に集中でき、`FS-OPS-03` は update job の失敗条件と deploy skip 条件の実装に集中できる



## D-058: `FS-OPS-02` は Pages deploy job を workflow 内で分離して追加する

- 決定: `FS-OPS-02` では `.github/workflows/update-public-data.yml` に `deploy-github-pages` job を追加し、`needs: build-public-data`、`environment: github-pages`、`url: ${{ steps.deployment.outputs.page_url }}`、`pages: write` / `id-token: write` permissions、`actions/deploy-pages@v4` を固定する
- 理由: GitHub Pages の custom workflow では deploy job に `pages: write` と `id-token: write` permissions、`needs`、`environment`、`page_url` 出力が必要であり、artifact upload と deploy を分離した方が更新と公開の境界も追跡しやすいため
- 影響: `FS-OPS-02` 完了時点で、成功した update artifact からの公開は workflow 上で自動化される。一方で単一フィード失敗時の継続判定や deploy skip 条件の詳細実装は `FS-OPS-03` に残る

## D-059: `FS-OPS-03` の publish 条件は「enabled feed 1 件以上の publishable source 成功」に固定する

- 決定: `scripts/pipeline/update.ts` では feed ごとの fetch failure と source-level validation failure を収集しつつ継続し、enabled feed のうち 1 件以上の publishable source が残った場合のみ pipeline を進める。enabled feed 0 件または全件 failure 時は build を失敗させ、deploy を走らせない
- 理由: 単一フィード失敗で全体を止めないという v1 要件を満たしつつ、fetch 自体は成功しても RSS / Atom として解釈できない document で update 全体が止まる穴を埋め、取得結果 0 件の更新で空の公開物や不完全な公開物へ切り替えて前回成功済みサイトを壊すことを避けるため
- 影響: `FS-OPS-03` では workflow YAML を大きく増やさず、`update.ts` の orchestration layer に partial failure policy を集約する。テストでは「fetch failure でも継続」「source-level failure でも継続」「全件失敗なら build 失敗」を確認する

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

- 決定: full quality gate は `pnpm run ci` を単一入口として扱い、lefthook は pre-push の full gate のみを担い、diffship 修正ループは `.diffship/config.toml` の `ops.post_apply` から同じ verify 入口を呼ぶ方針で進める
- 理由: formatter / lint / typecheck / test / verify を毎回 pre-commit に寄せると開発体験が重くなり、clean sandbox を前提にする diffship loop と通常開発で verify 入口が分岐しやすくなるため
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

- 決定: `FS-DX-01` では `@biomejs/biome` を baseline formatter / linter として導入し、hand-authored な TS / JSON / config を明示対象にした `biome.json` を採用する
- 理由: checked-in browser asset や JS wrapper、diffship ローカル運用ファイルまで一度に formatter 対象へ含めると差分が荒れやすく、導入初手としては破壊範囲が大きいため
- 影響: `package.json` には `format` / `format:check` / `lint:biome` を追加するが、既存の `lint` は repo 固有 check のまま維持し、full gate や hook との統合は `FS-DX-02` で扱う

## D-071: FS-DX-02 では `check:fast` と `pnpm run ci` の 2 層で gate を揃える

- 決定: `FS-DX-02` では `check:fast` を `format:check` / `lint:biome` / repo 固有 `lint` の束として追加し、full gate は `pnpm run ci = check:fast + typecheck + test + verify:web-ui` とする
- 理由: Biome 導入後も repo 固有 check を分離したまま、pre-commit に載せる高速チェックと pre-push / workflow で使う full gate を同じ script 契約から組み立てた方が、運用と修正ループの両方で見通しがよいため
- 影響: `package.json` / `justfile` / `lefthook.yml` / `README.md` / `tests/typescript-tooling.test.ts` を更新し、`just ci` は `pnpm run ci` の薄いラッパー、lefthook は pre-push=`just ci` のみ、diffship local config は `ops.post_apply` から install / `build:web-ui` / `ci` を呼ぶ前提へ揃える
- 補足: 既存 runtime の unrelated refactor を `FS-DX-02` へ混ぜないため、initial gate の `biome.json` では `useOptionalChain` / `useArrowFunction` / `useLiteralKeys` / `noGlobalEval` を `off` にして baseline lint を安定化する

## D-072: FS-DX-03 では routine quality gate を `.github/workflows/ci.yml` へ切り出す

- 決定: `FS-DX-03` では `.github/workflows/ci.yml` を追加し、`push` / `pull_request` ごとに `actions/checkout`、`actions/setup-node`、`corepack enable`、`pnpm install --frozen-lockfile`、`pnpm run ci` を実行する通常 CI workflow を導入する
- 理由: pre-push だけに full gate を閉じ込めると GitHub 上の変更でも routine quality gate の結果を追いにくく、更新 / deploy workflow に Pages 固有処理が混ざったままでは通常 CI の失敗原因も切り分けにくいため
- 影響: `.github/workflows/update-public-data.yml` は定期更新 / Pages deploy に専念し、通常の品質確認は `tests/ci-workflow.test.ts` と合わせて `.github/workflows/ci.yml` で追跡する

## D-073: FS-DX-04 では DX docs の契約を workflow と専用 test に同期する

- 決定: `FS-DX-04` では `README.md` に quality gate failure 時の運用入口を追加し、`tests/typescript-tooling.test.ts` に docs sync assertion を追加し、README / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `docs/TRACEABILITY.md` / `PLAN.md` が `.github/workflows/ci.yml` と `.github/workflows/update-public-data.yml` の境界、ならびに diffship 修正ループ運用を同じ内容で指していることを確認する
- 理由: Biome / hook / workflow の実装だけ整っても、repo 直下の入口と traceability が追随しなければ、将来の修正時に「どの gate がどこで走るか」「失敗時に何を渡すか」の判断が再び docs と実装でずれやすいため
- 影響: `README.md` / `PLAN.md` / `docs/SPEC_V1.md` / `docs/TRACEABILITY.md` を更新し、DX の docs 契約は `tests/typescript-tooling.test.ts` で継続監視する

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

## D-086: v1 の URL namespace は root-level shelf route と固定補助 route に限定する

- 決定: v1 の canonical route は `/`, `/<shelfId>/`, `/tags/`, `/search/`, `/sources/` を基本とし、tag / search / source の detail state は各固定ページ上の query parameter (`?id=` / `?q=`) で表現する
- 理由: GitHub Pages の単一サイト・静的ホスティングと相性がよく、route 木を増やしすぎずに情報設計を安定させやすいため
- 影響: v1 では per-tag / per-source / per-article の root-level route を追加しない
- 影響: internal link は trailing slash 付き directory route を canonical とする

## D-087: `shelfId` は reserved ids と衝突させない

- 決定: `shelfId` には少なくとも `tags`, `search`, `sources`, `categories`, `assets`, `data`, `index` を予約語として確保し、棚 ID に使わない
- 理由: 固定 route、静的 asset path、公開 JSON path と棚 route の衝突を防ぎ、GitHub Pages 単一サイト前提の URL 空間を保守しやすくするため
- 影響: 既存の `/categories/` を互換導線として残す場合も reserved route として扱う
- 影響: 将来 root-level route を追加する場合は reserved ids 一覧と docs を同時更新する

## D-088: `articles.json` を article card 表示用の canonical public listing とする

- 決定: Phase 6 の公開 JSON では `articles.json` を article card 表示用の canonical public listing とし、`tags.json` と `search-index.json` は補助 summary / index として扱う
- 理由: article title / summary / image / source などの表示 payload を複数 JSON に二重保持すると、静的生成物の契約ズレが起きやすいため
- 影響: 棚ページ・tag detail・search result の最終的な article card 表示は `articles.json` を正本として構築する

## D-089: `tags.json` は tag list summary とし、tag detail 本体は `articles.json` から解決する

- 決定: `tags.json` は tag 一覧や tag 導線向け summary に留め、tag detail の article 一覧は `articles.json` の `sourceTags` / `entryTags` を使って解決する
- 理由: tag summary と article card payload の責務を分け、tag ごとの重複データや route ごとの専用 JSON を増やしすぎないため
- 影響: v1 では `tags/<id>.json` のような per-tag article export を必須にしない
- 影響: sourceTags と entryTags は集計上統合してよいが、将来は由来別 count を拡張できるようにしてよい

## D-090: `search-index.json` は lightweight ranking index とし、結果表示は `articles.json` へ解決する

- 決定: `search-index.json` は title / sourceName / sourceTags / entryTags に対する build-time 検索用の lightweight ranking index とし、検索結果の article card 表示 payload は `articles.json` を正本とする
- 理由: 無料・静的運用のまま検索を成立させつつ、検索専用 JSON に full article payload を二重保持しないため
- 影響: client-side search は `search-index.json` で match / score / sort 候補を作り、`articleId` をキーに `articles.json` へ解決する
- 影響: v1 では外部検索基盤や server-side query API を導入しない

## D-091: ルート `/` は全体新着ページではなく棚カタログを主役にする

- 決定: ルート `/` の主役は「全記事の新着一覧」ではなく、site intro と棚カード一覧から成る棚カタログとする
- 理由: Phase 6 で優先したいのは速報性より discovery-first な導線であり、最初の画面で「どの棚を見るべきか」が伝わる方が product 価値に合うため
- 影響: root の source 一覧・全体新着一覧は残してもよいが、情報階層上は棚カード一覧より下位の補助セクションとして扱う
- 影響: root の first view では検索導線と主要棚を優先し、「カテゴリ / 媒体 / 新着を全部並べる dashboard」へ戻さない

## D-092: root の棚カタログは `shelves.yaml` 順の棚カードを正本にする

- 決定: root の棚カード順は件数順や freshest 順ではなく `data/shelves.yaml` の棚定義順を基本とし、各カードは `title` / `description` / `articleCount` / `sourceCount` / `latestSortAt` / optional `sampleTags` を表示候補とする
- 理由: FeedShelf の棚は単なる集計結果ではなく curator が意図を持って並べる導線であり、root は「今多い順」より「どう巡るとよいか」を伝えるカタログであるべきため
- 影響: `shelves.json` は root の棚カードを直接描画できる summary を持つ前提でよく、`sampleTags` のような雰囲気補助情報を optional に含めてよい
- 影響: 棚ごとの専用画像や重い演出 asset は v1 の必須要件にせず、文章・count・freshness・tag で雰囲気を表現する


## D-093: 棚ページの first view は「概要 → 注目」を優先する

- 決定: `/<shelfId>/` の first view は、少なくとも棚概要と注目記事で構成し、新着一覧や source 一覧より先に「この棚は何を見る場所か」を伝える
- 理由: shelf-first な UI では、棚ページを開いた直後に記事の雰囲気が掴めることが discovery 体験の中心になるため
- 影響: 棚ページは単なる source 別一覧の焼き直しではなく、概要・代表記事・新着の 3 層で構成する前提になる
- 影響: `source` 一覧は残してよいが、棚ページの first view や主要 CTA を占有しない

## D-094: 棚ページの注目記事は既存公開 JSON から導出し、専用 curated contract を必須にしない

- 決定: 棚ページの注目記事は、その棚に属する `articles.json` の範囲から build-time または client-side に導出してよく、v1 では手動 curated list や per-shelf detail JSON を必須にしない
- 理由: `FS-UX-01` の段階で新たな registry や保存契約を増やすより、既存の `articles.json` / `shelves.json` / `sources.json` を再利用する方が最小差分で安全なため
- 影響: 注目は freshness に加えて summary / image / tag richness を使った軽量な優先付けで十分とする
- 影響: 後続タスクは UI 実装に集中でき、棚ページのためだけの追加 JSON 生成や手動運用を初期必須にしなくてよい

## D-095: 記事カードは title → tags → source の順で認知される階層を正本にする

- 決定: Phase 6 の article card は metadata-first ではなく、title / visible tags / source name を主軸に構成し、公開日時や category は補助情報へ下げる
- 理由: 棚・tag・search の主目的は詳細比較よりも「開いてみたい記事を見つける」ことであり、カード先頭に metadata pills が密集すると discovery の視線が分散しやすいため
- 影響: title が最も強い visual weight を持ち、source / freshness は supporting info として扱う
- 影響: 棚ページでは current shelf / category の繰り返し表示を必須にしない

## D-096: 記事カードの visible tags は `entryTags` 優先 + `sourceTags` 補完で導出し、専用 field を増やさない

- 決定: 記事カードに出す visible tag chips は `entryTags` を優先し、足りなければ `sourceTags` で補う軽量導出とし、`cardTags` のような専用公開 field は v1 で追加しない
- 理由: 既存 public JSON を再利用したまま記事ごとの topical cue を確保でき、source の性格タグも discovery 補助として自然に再利用できるため
- 影響: tag chips は 0〜3 件程度の compact 表示でよく、重複は除外する
- 影響: pipeline / UI は既存 `articles.json` だけで article card の tag 表示を構築できる

## D-097: discovery-first な記事カードでは余白を情報階層のために使い、summary 欠損を大きく目立たせない

- 決定: article card では title block / tag block / supporting meta の余白を確保し、summary が欠ける場合に大きな placeholder 文でカード面積を埋めることを必須にしない
- 理由: 限られたカード面積では「どんな記事か」が一瞬で掴めることが重要で、欠損 placeholder や dense meta row は視線を散らしやすいため
- 影響: summary や image は optional な補助情報として扱い、欠けても title / tags / source の階層だけでカードが成立する前提になる
- 影響: long title / long tag などの edge case は `FS-UX-04` で崩れ対策を詰める

## D-098: `/sources/` は source directory / profile とし、探索の開始地点にはしない

- 決定: `/sources/` は source 一覧と source profile を確認するための補助 route とし、FeedShelf の primary entry は引き続き `/`, `/<shelfId>/`, `/tags/`, `/search/` に置く
- 理由: source 名から逆引きしたい needs は残る一方、棚-first な発見体験を source directory が再び上書きしないようにする必要があるため
- 影響: root や棚ページで source 導線を見せる場合も、full directory を主役表示するのではなく compact CTA / short list に留める

## D-099: source detail は関連 shelf / tag / recent articles へ戻れる bridge とする

- 決定: `/sources/?id=<sourceId>` では source の identity を示すだけで終わらせず、その source が属する `shelfIds`、関連 `tags`、recent articles を通じて shelf-first な探索へ戻れる構成を取る
- 理由: source page が孤立した終点になると、棚・tag・検索と分断された旧来の source-first IA に戻りやすいため
- 影響: source profile では `shelfIds` と `tags` を visible に使ってよく、棚へのリンクを主要な secondary CTA 候補とする

## D-100: source page 専用の detail JSON は追加せず、`sources.json` と `articles.json` を再利用する

- 決定: `/sources/` の directory / profile は `sources.json` の summary object を正本にし、source detail の article 一覧は `articles.json` の `sourceId` 絞り込みで解決する
- 理由: source page のためだけに `sources/<id>.json` や curated source registry を増やすより、既存 public JSON の責務を保った方が最小差分で安全なため
- 影響: source page 実装は既存の公開 JSON 契約だけで進められ、pipeline 追加変更を初期必須にしなくてよい

## D-101: Phase 6 の主要閲覧 surface は narrow viewport で 1 カラムへ安全に縮退する

- 決定: root / shelf / source / tag / search の主要閲覧 surface は narrow viewport では 1 カラムを基本とし、複数カラムや横並び要素は縦積みへ安全に縮退できる前提を取る
- 理由: discovery-first な UI はモバイルでも成立する必要があり、横スクロールや固定幅カード前提のままでは棚・tag・検索導線が破綻しやすいため
- 影響: article card の image / meta / tag / stats は narrow viewport で縦積みへ送ってよく、touch target と可読性を優先する
- 影響: v1 では desktop 専用の dense dashboard を正本にせず、まず 1 カラムで読みやすいことを満たす

## D-102: loading / empty / error は同一 status surface 契約で扱い、empty と error を混同しない

- 決定: fetch 中、0件、fetch 失敗、pipeline 未実行は同一の status surface 契約で表現してよいが、empty と error は copy / visual tone / 次アクションを分ける
- 理由: 静的サイトでは「データがまだない」のか「壊れている」のかが分かりにくくなりやすく、誤った文言は UX と運用判断の両方を悪化させるため
- 影響: empty state では別棚・別tag・別source への回遊や次回生成待ちを案内し、error state では再読込や pipeline / static server 確認へ誘導する
- 影響: loading は layout shift を抑えた軽量な status / skeleton で十分とし、派手な演出を必須にしない

## D-103: long title / long tag は横溢れさせず、card の優先順位を守る

- 決定: article card や chip list では long title / long tag を wrap / clamp / compact chip 数制限で吸収し、1 件の長文が panel 幅を押し広げたり、重要な supporting info を画面外へ押し出したりしないようにする
- 理由: FeedShelf は日本語・英語・複合語・固有名詞が混在しやすく、タグや記事名が短い前提で設計するとモバイルで崩れやすいため
- 影響: single-line 固定 chip や nowrap 前提 title を正本にせず、必要に応じて 2〜3 件の visible tag と複数行 title で discovery を維持する
- 影響: 横スクロールや off-canvas overflow を許容する代わりに情報を増やす設計は採らない


## D-104: Phase 6 は docs freeze 完了後に `*-10` 系 implementation task へ進む

- 決定: Phase 6 では、まず `FS-IA-*` / `FS-UX-*` / `FS-TAG-*` / `FS-SEARCH-*` / `FS-FEED-*` / `FS-QA-*` の docs task を最後まで完了させ、その後に `FS-UX-10` / `FS-TAG-10` / `FS-SEARCH-10` / `FS-FEED-10` / `FS-QA-10` の implementation task へ進む
- 理由: Shelf-first UI / tags / search / contributor flow は相互依存が強く、途中で実装を始めると route、public JSON、UI 優先度、acceptance 条件のズレが広がりやすいため
- 影響: `PLAN.md` では docs task と implementation task を明確に分離し、Phase 6 の最初のコード実装は docs freeze 完了後の `FS-UX-10` とする
- 影響: docs freeze 中は runtime / pipeline / checked-in public asset 変更を必須にしない

## D-105: Phase 6 の実装順は `UX -> TAG -> SEARCH -> FEED -> QA` を基本とする

- 決定: docs freeze 後の Phase 6 実装順は、`FS-UX-10`、`FS-TAG-10`、`FS-SEARCH-10`、`FS-FEED-10`、`FS-QA-10` を基本とする
- 理由: まず棚-first な route shell と主要閲覧 surface を成立させてから、tag / search の発見導線を重ね、その後に input registry と public JSON export、最後に acceptance と migration を締めた方が差分を小さく保てるため
- 影響: `FS-IA-*` は docs で固定した契約を後続 implementation task が消費する位置づけとし、IA 専用の先行実装タスクは必須にしない
- 影響: `FS-FEED-10` では `data/shelves.yaml` / `data/feeds.json` / generated public JSON が Phase 6 契約に追随していることを確認する

## D-106: Phase 6 実装中の方向転換は影響分析と docs 更新を先に行う

- 決定: Phase 6 実装中に仕様変更や方向転換が必要になった場合は、先に affected task、`SPEC_V1`、`DECISIONS`、`TRACEABILITY`、tests、public JSON 契約、互換導線への影響を分析し、必要なら docs task を挟んでから implementation task へ戻る
- 理由: Shelf-first extension は route、検索、tag 集計、contributor flow が互いに参照し合うため、コードだけ先に曲げると他タスクとの整合が崩れ、後からバグや docs 欠落として現れやすいため
- 影響: 実装中の方針変更は「その場でコードだけ直す」のではなく、「影響分析 -> docs 更新 -> 実装更新」の順で進める
- 影響: traceability と acceptance 条件も変更対象に含め、周辺 task へ波及する場合は `PLAN` の next steps と task 分割を見直す

## D-107: tag identity は raw label ではなく compare key / URL-safe `tagId` で安定化する

- 決定: `sourceTags` / `entryTags` の raw label は UI 表示に使ってよいが、tag の identity は NFKC・trim・空白縮約などを通した compare key を正本にし、公開 `tagId` はそこから決定的に導出する URL-safe key とする
- 理由: 日本語・英語・大文字小文字・空白揺れが混在するため、raw label や英字 slug 前提のままでは tag detail の一致判定や URL が壊れやすいため
- 影響: `tags.json.id` は必ずしも human-readable slug に固定しない
- 影響: UI / pipeline は tag label の見た目と tag identity を分けて扱う

## D-108: tag detail は `tags.json` summary と `articles.json` union filter だけで解決する

- 決定: `/tags/?id=<tagId>` の summary は `tags.json` を正本にし、article 一覧は `articles.json` の `sourceTags` / `entryTags` を同じ compare rule で絞り込んだ union として構築する
- 理由: per-tag article export を増やさなくても、tag list / tag detail / article card tag 表示を同じ公開 JSON 群で一貫して実装できるため
- 影響: 1 件の記事が両由来で一致しても detail では 1 件として扱う
- 影響: invalid `tagId` や 0 件の tag でも `/tags/` 自体は壊さず、tag directory と棚・search への戻り導線を表示する

## D-109: `entryTags` は feed metadata 限定の best-effort 抽出とし、推測生成しない

- 決定: `entryTags` は RSS / Atom の category / tag 相当 metadata から取れる場合のみ生成し、本文全文解析、AI keyword extraction、手動 article override は v1 で行わない
- 理由: tag 契約を deterministic に保ち、source ごとの欠損差を受け入れた方が pipeline の挙動と docs の整合を保ちやすいため
- 影響: `entryTags` 欠損は正常系として扱い、tag page / search / article card は `sourceTags` と組み合わせて成立する必要がある
- 影響: 実装は parser から取れる metadata に閉じ、free text inference は後続フェーズへ送る

## D-110: tag directory は件数と freshness を優先し、棚より上位の IA にしない

- 決定: `/tags/` の directory は `articleCount` 降順、同点なら `latestSortAt` 降順、さらに同点なら `label` 昇順を基本とし、page は tag から棚・search へ戻る補助導線を常に持つ
- 理由: tag discovery の入口としては件数と鮮度が分かる方が有用だが、tag 自体を primary dashboard にすると shelf-first IA が崩れるため
- 影響: tag page header / detail では tag summary と recent articles を主役にし、棚への戻り CTA を secondary に置く
- 影響: UI 実装は tag popularity と freshness を見せつつ、root や shelf を置き換えない構成を守る

## D-111: 検索 query と index matching は deterministic な正規化 + 空白区切り AND 検索を基本とする

- 決定: `/search/` の query と `search-index.json` の比較文字列は、少なくとも Unicode 正規化（NFKC）、前後空白除去、連続空白縮約、ASCII / Latin の case 差吸収を行い、multi-term query は空白区切り term の AND 条件を基本とする
- 理由: 日本語と英語が混在する静的サイトで、言語依存 tokenizer や外部検索基盤に頼らず deterministic に実装できる最小仕様が必要なため
- 影響: v1 の検索は形態素解析や semantic search を必須にしない
- 影響: query が長くても field ごとの部分一致で判定でき、pipeline と UI が同じ compare rule を共有する必要がある

## D-112: 検索順位は `title > sourceName > tags > freshness` を正本にする

- 決定: v1 の search ranking は title 一致を最優先し、sourceName 一致を次点、sourceTags / entryTags 一致を補助 signal とし、同点時は `sortAt` 降順で解決する
- 理由: FeedShelf の検索は「開いてみたい記事を見つける」ことが目的であり、topic 名や source 名で探しても最終的には title relevance が最も重要な判断材料になるため
- 影響: query 未指定時や低品質な曖昧一致で fresh article を全面に押し上げすぎない
- 影響: UI / tests / pipeline は score tie-break を deterministic に共有する

## D-113: empty query / no result でも `/search/` は article dump にせず helper state を正本にする

- 決定: `/search/` は `q` 未指定時に全 article を一覧表示せず、検索ヒントと棚 / tag / source への戻り導線を示す helper state を正本にし、no result 時も page を壊さず query 再編集導線を出す
- 理由: 検索ページが実質的な「全記事新着一覧」になると shelf-first IA と責務が衝突し、初回表示の負荷と認知コストも上がるため
- 影響: empty state と no result state は `status surface` の一種として扱えるが、文言と次アクションは分ける
- 影響: source / tag / shelf からの deep link でも、query が消えた場合は helper state へ安全に戻せる

## D-114: `search-index.json` は field-separated な比較文字列を持つ lightweight candidate index とする

- 決定: `search-index.json` は `articleId` と `sortAt` に加え、title / sourceName / tags 用の比較文字列を field-separated に保持する lightweight candidate index とし、検索結果 card payload の正本は引き続き `articles.json` とする
- 理由: score の根拠を field weight ごとに決めつつ、summary / image / URL まで検索 index に複製すると JSON 契約が二重化して壊れやすいため
- 影響: client-side search は index 上で candidate selection と scoring を行い、表示時のみ `articles.json` を参照する
- 影響: per-query export や server-side API を導入せずに、build-time index だけで title / source / tag weighting を実装できる

## D-115: contributor は棚追加・source追加・tag付与を registry 境界に沿って分離して行う

- 決定: 棚追加や棚説明の更新は `data/shelves.yaml`、source 追加・無効化・棚紐付け・source manual tag 更新は `data/feeds.json` で行い、記事ごとの手動 `entryTags` や ad-hoc field は v1 で追加しない
- 理由: contributor flow を registry 境界に沿って固定しておくと、棚 taxonomy と source 設定が混ざらず、後から見ても編集先と影響範囲を判断しやすいため
- 影響: 一時的な feed 停止は削除より `enabled=false` を優先してよく、field 追加が必要な場合は先に docs / traceability を更新する
- 影響: 実装は `shelves.yaml` と `feeds.json` の join 契約を前提に進め、article-level manual metadata を input registry へ逆流させない

## D-116: v1 extension の初期 shelf set は `it` / `ai` / `science` の少数 broad shelf とする

- 決定: Phase 6 の初期棚セットは `it`、`ai`、`science` を正本候補とし、棚数を小さく保ったまま shelf-first IA を検証する
- 理由: 既存 source 群を無理なく移行でき、empty shelf や過剰な多重所属を避けつつ discovery-first UI のバランスを確認しやすいため
- 影響: `itmedia-news` / `publickey` は `it`、`openai-news` は `ai`、`sciencedaily-technology` / `nasa-news` は `science` へ寄せる初期割り当てが自然となる
- 影響: 新棚追加は tag の焼き直しではなく独立した読み方が必要な場合に限定し、少なくとも複数 source 候補か近い追加計画を持つことを推奨する

## D-117: curated source 追加は stable public feed / 明確な棚適合 / duplicate 回避を優先する

- 決定: 新しい source は、公開 RSS / Atom が安定しており、媒体 identity が明確で、既存 source と実質 duplicate でなく、対象 shelf の読み口に継続的に合うものを優先する
- 理由: FeedShelf は source 数の多さよりも「棚として読めること」が重要であり、低信号や duplicate な feed を増やすと UI / search / tag summary の品質が同時に悪化しやすいため
- 影響: 初期 curated set は 1 棚あたり少数 source から始めてよく、短期話題だけを理由に source を増やしすぎない
- 影響: `feeds.json.tags[]` は broad tag に留め、棚名や一過性イベント名だけで埋める運用を避ける

## D-118: feed expansion の QA は registry 整合性・public JSON・search / tag・UI 崩れまで確認する

- 決定: 新棚 / 新source / tag 調整を行ったときの QA は、registry 整合性、duplicate feed 兆候、`shelves.json` / `sources.json` / `tags.json` / `search-index.json` への反映、tag / search 導線、long title / long tag / empty state を含む UI 崩れまで確認対象にする
- 理由: Feed 拡張は input registry の変更に見えても、実際には public JSON と discovery surface 全体へ波及するため、source を足しただけのつもりでも検索やタグ、棚カードでバグが出やすいため
- 影響: `FS-FEED-10` と `FS-QA-10` は pipeline / UI / tests でこの checklist を実装へ落とし込む必要がある
- 影響: contributor 向け docs は「何を編集するか」だけでなく「追加後にどこが壊れやすいか」まで示す

## D-119: 最終的な FeedShelf v1 完了判定は旧MVPではなく shelf-first extension 込みで行う

- 決定: Phase 5 で成立した旧MVP acceptance は baseline として維持するが、最終的な FeedShelf v1 完了判定は Phase 6 の shelf-first UI / tags / search / feed contribution flow / compatibility handling を含めて行う
- 理由: Product の目的を「静的RSSリーダー」から「興味を惹かれる記事へ出会いやすい読み物棚」へ拡張した以上、旧MVP 完了だけでは最終 v1 の完成条件を表せないため
- 影響: `FS-QA-05` と `FS-QA-10` では、旧MVP evidence を再利用しつつ、棚カタログ・棚ページ・tag / search・source bridge・public JSON 更新を追加 acceptance として扱う
- 影響: README や docs でも「Phase 5 でMVP完了済み」と「最終 v1 は Phase 6 込み」を区別して表現する

## D-119A: pipeline export は stale な generated shelf route だけを掃除する

- 決定: `pipeline:update` / `writePublicExports` は current `shelves.yaml` に存在する `shelfId` の `/<shelfId>/index.html` を再生成し、現行棚集合に存在しない route dir については **generated な shelf route marker を持つ場合だけ** 掃除する
- 理由: shelf の rename / delete 後に GitHub Pages 上へ stale な `/<oldShelfId>/` が残ると、仕様上は存在しない棚へ到達できてしまう一方で、固定 route や hand-authored page を directory 名だけで削除するのは危険だから
- 影響: route cleanup は managed marker を持つ棚 route に限定し、`/tags/` / `/search/` / `/sources/` / `/categories/` などの fixed route を誤って削除しない
- 影響: contributor が shelf を削除・rename した場合も、次回 export で generated route shell が docs 上の棚集合と同期する

## D-119B: generated shelf route shell は curator text を HTML escape して埋め込む

- 決定: `writePublicExports` / generated な `/<shelfId>/index.html` route shell は、`shelves.yaml` の `title` / `description` を plain text として扱い、`&` / `<` / `>` / quote を HTML escape して `<title>` / meta description / visible heading に埋め込む
- 理由: shelf metadata は curator-managed text であり、`R&D` や `<beta>` のような通常文字列でも escape しないと generated route shell の title / meta / heading が壊れうるため
- 影響: route shell 生成は reserved route / stale route cleanup だけでなく text safety も担う
- 影響: `FS-QA-10` / post-Phase-6 maintenance では、棚 metadata に HTML special chars が含まれても generated shelf route が壊れないことを tests で確認する

## D-119C: pipeline は `feeds.json.shelfIds[]` と `shelves.yaml` の join を fail-fast で検証する

- 決定: `runPipeline` は public JSON を生成する前に、`feeds.json.shelfIds[]` の各値が `shelves.yaml` の現行棚集合に存在することを検証し、未知の `shelfId` があれば即座に失敗させる
- 理由: shelf を rename / delete したのに `feeds.json` 側の参照だけ古いままだと、orphaned source / article export や「棚一覧に存在しない属先」を含む不整合を後段で作れてしまうため
- 影響: contributor が棚 rename / delete 後の `feeds.json` 更新を忘れた場合でも、`pipeline:update` が明確なエラーで停止し、GitHub Pages へ壊れた shelf-first surface を出しにくくなる
- 影響: README / traceability / tests では、registry join の fail-fast guard を Phase 6 維持の evidence として追跡する

## D-119D: `feeds.json` の source `id` は registry 内で fail-fast に一意性検証する

- 決定: `loadFeeds` は `data/feeds.json` を読む時点で source `id` の重複を拒否し、duplicate な `id` を含む registry をそのまま pipeline へ流さない
- 理由: `sourceId` は public JSON、source detail filter、search / tag 集計の join key であり、同じ `id` を複数 source が共有すると identity 衝突を後段で静かに広げてしまうため
- 影響: contributor は source を追加するときに `id` を stable かつ unique に保つ必要があり、rename や feed 差し替え時も別 source と同じ `id` を再利用しない
- 影響: docs / README / traceability / tests では、cross-registry guard だけでなく duplicate source id guard も Phase 6 維持の evidence として追跡する

## D-119E: 各 source の `shelfIds[]` は source 内で重複を fail-fast に拒否する

- 決定: `loadFeeds` は `data/feeds.json` を読む時点で、同一 source の `shelfIds[]` に同じ shelf id が複数回入っている場合を拒否し、duplicate shelf membership を pipeline へ流さない
- 理由: `shelfIds[]` は source が属する棚集合を表す registry join key であり、同じ shelf を重複させても意味がないうえ、`sources.json` / `articles.json` / source bridge に冗長な属先がそのまま残って後段の挙動を読みにくくするため
- 影響: contributor は source を複数棚へ属させてよいが、同じ shelf id を 1 source 内で繰り返さない
- 影響: README / SPEC / TRACEABILITY / tests では、unknown shelf guard や duplicate source id guard に加えて duplicate shelf membership guard も Phase 6 維持の evidence として追跡する

## D-119F: 各 source の manual `tags[]` は compare key 上で重複を fail-fast に拒否する

- 決定: `loadFeeds` は `data/feeds.json` を読む時点で、同一 source の manual `tags[]` に compare key（NFKC・trim・空白縮約・ASCII-Latin case 差吸収）上で重複する値がある場合を拒否し、duplicate manual tags を pipeline へ流さない
- 理由: source manual tag は `sourceTags` / `tags.json` / `search-index.json` / visible tag 補完へ波及する curator-managed metadata であり、表記揺れだけの duplicate を silent に正規化すると input registry の意図が見えなくなるため
- 影響: contributor は `AI` と ` ai ` のような compare-key 上同一な manual tag を同一 source に併記しない
- 影響: README / SPEC / TRACEABILITY / tests では、registry fail-fast guard の一部として duplicate manual tag guard も Phase 6 維持の evidence として追跡する

## D-119G: manual `tags` field は省略または配列のみを受け入れる

- 決定: `loadFeeds` は `data/feeds.json` を読む時点で、manual `tags` field が存在するのに配列でない source を reject し、shape mismatch を pipeline へ流さない
- 理由: `tags` は curator-managed metadata の入力面であり、string/object を silent に `[]` 扱いすると source editor の typo を見逃して tag directory・search・visible tag 導線の意図が失われるため
- 影響: contributor は manual tag を使わないなら `tags` を省略し、使う場合だけ string array で与える
- 影響: README / SPEC / TRACEABILITY / tests では、duplicate manual tag guard に加えて `tags` field shape guard も Phase 6 維持の evidence として追跡する

## D-119H: manual `tags[]` の各要素は非空文字列のみを受け入れる

- 決定: `loadFeeds` は `data/feeds.json` を読む時点で、manual `tags[]` の各要素が非空文字列でない source を reject し、空文字列や非文字列の tag value を pipeline へ流さない
- 理由: source manual tag は curator-managed metadata の入力面であり、空や非文字列の要素を silent に無視すると tag directory・search・visible tag 補完の欠落が editor typo 由来なのか意図なのか判別しづらくなるため
- 影響: contributor は manual tag を使う場合、各要素を空白だけでない文字列として与える
- 影響: README / SPEC / TRACEABILITY / tests では、`tags` field shape guard や duplicate manual tag guard に加えて invalid manual tag value guard も Phase 6 維持の evidence として追跡する

## D-119I: `feedUrl` / `siteUrl` は absolute な `http/https` URL のみを受け入れる

- 決定: `loadFeeds` は `data/feeds.json` を読む時点で、各 source の `feedUrl` / `siteUrl` が absolute な `http/https` URL でない場合を reject し、相対 URL や非 `http/https` scheme を pipeline へ流さない
- 理由: source registry の URL は fetch 対象と source profile の外部導線の両方で使われるため、壊れた URL を「非空文字列だからOK」として通すと update failure や無効な source bridge を後段まで持ち込んで原因切り分けが遅れるため
- 影響: contributor は `feedUrl` / `siteUrl` を absolute な `http/https` URL で記述し、mailto・相対 path・未解決 placeholder を registry に入れない
- 影響: README / SPEC / TRACEABILITY / tests では、registry fail-fast guard の一部として source URL shape guard も Phase 6 維持の evidence として追跡する

## D-120: `/categories/` は Phase 6 の間 compatibility route として残し、hard 404 にしない

- 決定: Phase 6 で shelf-first IA を主役へ移しても、`/categories/` は v1 extension 完了までは compatibility route として扱い、legacy query parameter deep link を含めて hard 404 にしない
- 理由: 既存 README・tests・公開リンク・利用者の認知がカテゴリ導線を前提にしているため、一度に route を消すと回帰や broken link が見えにくくなるため
- 影響: `/categories/?id=<legacyCategoryId>` は legacy listing を維持しても migration helper state に寄せてもよいが、少なくとも shelf / search / sources へ戻る CTA を持つ
- 影響: 互換導線は primary navigation へ戻さず、root や棚ページの主役を置き換えない

## D-121: Phase 6 の primary public JSON は `articles/shelves/sources/tags/search-index/meta` とし、`categories.json` は互換用途に留める

- 決定: shelf-first extension 後の primary public JSON は `articles.json` / `shelves.json` / `sources.json` / `tags.json` / `search-index.json` / `meta.json` を正本とし、`categories.json` は必要な場合だけ `/categories/` compatibility route を支える補助 export として残してよい
- 理由: categories-first な export を主契約に残すと root / shelf / tag / search の source of truth が二重化し、Phase 6 実装と受け入れ確認が揺れやすくなるため
- 影響: `FS-FEED-10` と `FS-QA-10` では、pipeline / tests / docs が primary export と compatibility export を区別して扱う必要がある
- 影響: checked-in generated data を前提にせず、pipeline 後の `public/data/` を acceptance の確認対象とする

## D-122: compatibility behavior や migration 方針を確定した task では docs / traceability / tests を同時更新する

- 決定: Phase 6 実装で `/categories/` の最終的な helper state・互換 export の有無・migration copy を確定させた task では、同じ task で `PLAN` / `SPEC_V1` / `DECISIONS` / `TRACEABILITY` / tests / checked-in assets を同期する
- 理由: compatibility layer は UI・route・public JSON・README・テストの複数面へ波及するため、どれか 1 つだけ先行して変えると「実装は動くが docs と受け入れ条件が古い」状態になりやすいため
- 影響: `FS-QA-10` は新しい shelf-first surface の受け入れ確認だけでなく、必要なら `/categories/` compatibility behavior の継続確認も担う
- 影響: 将来 compatibility route を廃止する場合も、まず影響分析と docs 更新を行ってから実装へ進む


## D-123: post-v1 の UI refresh は route / public JSON 契約を変えない visual refresh として行う

- 決定: post-v1 の UI 改善は、まず `public/*.html` / generated `/<shelfId>/index.html` / `public/assets/styles.css` / `src/web/app.ts` の visual refresh に限定し、route policy・public JSON・search/tag/source/shelf の filter 契約は変えない
- 理由: Feed 精査や DX 縮退の前に見た目と回遊性だけを改善したいが、この段階で data contract や pipeline behavior まで同時に動かすと差分が広がり、diffship loop での原因切り分けが難しくなるため
- 影響: generated shelf route と fixed route は同じ UI トーンへ寄せるが、受け入れ上は既存 tests が確認している route / JSON / compatibility behavior を維持する
- 影響: lint / formatter の縮退可否は別タスクで扱い、UI refresh task と混ぜない


## D-124: post-v1 の curated source 拡張は personal-fit を優先し、hard-science source は `enabled=false` で残してよい

- 決定: post-v1 の source 精査では、物理専攻の大学生かつエンジニア志向の reader profile を前提に、GIGAZINE / Qiita / Zenn / DevelopersIO / CodeZine / Reddit のような読みやすい community-oriented source を優先して厚くし、NASA や hard-science 一次ソースが読み口に合わない場合は削除より `enabled=false` を選んでよい
- 理由: FeedShelf v1 は厳密な網羅性より「毎日開きたくなる棚」を優先しており、source registry も `enabled` を通じて保留 source を保持できるため、source を完全削除するより軽く棚の温度感を調整しやすいため
- 影響: `science` 棚は宇宙ニュース専用ではなく、物理・Python・理系エンジニア寄りの軽い読み物を含んでよい
- 影響: subreddit の公開 RSS は `.rss` suffix を使う安定した public feed として扱ってよく、`feeds.json` では community source であることが分かる `tags[]` を付けて運用する


## D-125: 記事量を増やす第2波では broad media の追加より profile-aligned tag / topic feed を優先する

- 決定: post-v1 の source 第2波では、一般 tech media を無差別に足すより、`gihyo` のような読み物系 general source を少数追加しつつ、Qiita / Zenn / Reddit の `neovim` / `archlinux` / `llm` のような topic feed を優先して増やす
- 理由: 物理専攻かつエンジニア志向の reader profile では、source 数だけ増やすと棚の温度感がぼやけやすい一方、topic feed を増やすと「Linux / editor / LLM / 個人開発」に寄った記事量を増やしやすいため
- 影響: `it` 棚は Linux / editor / 個人開発寄り、`ai` 棚は LLM / 実装寄りの source 比率が上がる
- 影響: 将来さらに source を増やす場合も、まず topic/tag feed を検討し、それでも不足する場合に broad media を追加する

## D-126: topic feed が揃った後は broad chronological / aggregator feed を一部 `enabled=false` に戻してよい

- 決定: post-v1 の source 第3波では、Qiita / Zenn / Reddit の profile-aligned topic feed が十分に揃った後、`Zenn Feed` / `Hacker News` / `r/programming` のような broad feed を少数 `enabled=false` に戻してよい
- 理由: 記事量の拡張後は、chronological な全体 feed や広すぎる aggregator/community feed が棚の温度感をぼかしやすく、日本語中心・個人開発/Linux/LLM 寄りの読み口を維持したい場合は topic feed を残して broad feed を抑える方が最小差分で調整しやすいため
- 影響: source registry では削除ではなく `enabled=false` を優先し、必要になれば後で再度有効化できる
- 影響: `it` 棚は broad English feed を少し減らしても、Qiita / Zenn topic / gihyo / GIGAZINE / DevelopersIO で十分な記事量を維持する前提とする


## D-127: post-v1 の default source policy は documented feed 優先の cautious default とする

- 決定: site 自身または first-party help / docs で feed 提供が確認しやすい source を既定で有効化し、community source や undocumented topic feed は evidence が揃うまで `enabled=false` にしてよい
- 理由: FeedShelf v1 は source 数の最大化よりも、継続的に安全運用しやすい registry を優先するため
- 影響: Reddit や broad な Zenn global / productivityweekly のような慎重枠は registry に残しても default では無効化してよい一方、first-party docs で feed path が案内されている profile-aligned な Zenn topic feed は default `enabled=true` に寄せてよい

## D-137: Reddit の official RSS wiki がある topic feed は cautious default の範囲で有効化してよい

- 決定: Reddit の `r/reddit.com/wiki/rss` のような first-party docs で `.rss` の付け方が案内されている場合、`r/Python` / `r/rust` / `r/linux` / `r/archlinux` / `r/neovim` / `r/LocalLLaMA` / `r/MachineLearning` のような profile-aligned subreddit feed は default `enabled=true` に寄せてよい
- 理由: Zenn topic と同様に first-party docs で feed path が確認できる topic feed まで常に cautious disabled に留めると、Linux / editor / AI まわりの community signal を source audit の恩恵として取り込みにくく、user profile ともずれやすいため
- 影響: `r/programming` のような broad feed は引き続き `enabled=false` に留め、science 棚を重くしすぎる `r/Physics` は必要になるまで慎重枠として残してよい

## D-138: deferred data backlog の再開順は canonicalization-first とする

- 決定: `FS-DATA-05` / `FS-DATA-06` / `FS-DATA-07` を再開するときは、まず `FS-DATA-06` の host 固有 canonicalization / redirect resolution を docs split から始め、その後に richer provenance、最後に fuzzy dedupe を扱う
- 理由: canonicalization は既存 `normalizedUrl` の内部精度改善として始めやすく、public JSON 契約や UI route を直ちに崩さずに dedupe 基盤を前進させやすい一方、richer provenance は schema 増分を伴いやすく、fuzzy dedupe は誤爆コストが最も高いため
- 影響: 次に deferred backlog を起こす場合、最初の docs task は host 固有 rule / redirect 追跡 / failure fallback の境界整理になり、`seenInFeeds[]` の richer 化や fuzzy dedupe threshold 設計を先に混ぜない

## D-139: `FS-DATA-06` は safe canonicalization の上に積む best-effort precision layer とする

- 決定: `FS-DATA-06` の implementation は pipeline 側の allowlisted host rule と bounded redirect resolution に限定し、失敗時は既存 `normalizeUrl()` の safe canonicalization を fallback として継続する
- 理由: host 固有 canonicalization と redirect 解決の精度向上だけを切り出せば、generic query 除去の拡大や本文 fetch まで広げずに dedupe 基盤を強化でき、runtime / route への波及も抑えやすいため
- 影響: この task では public JSON の shape や route 構造を変えず、影響は internal normalization と rebuild 後に変わりうる article `id` / dedupe winner に留める。`<link rel="canonical">` 解析や本文取得は別タスクとして扱う

## D-140: `FS-DATA-06` は Hatena entry rewrite + bounded redirect follow の最小実装で閉じる

- 決定: 現段階の `FS-DATA-06` は `b.hatena.ne.jp/entry/...` の deterministic rewrite と、その rewrite 後 candidate にだけ適用する bounded redirect follow を実装範囲とし、全 article URL への一律 fetch は行わない
- 理由: 既存 curated source の中で redirector 的な URL を最小コストで改善でき、article ごとの追加 request を無制限に増やさずに precision layer を導入できるため
- 影響: precision layer は `runPipeline` / `runUpdatePipeline` の両方で使えるが、追加 network I/O は allowlisted rewrite が発火した article に限定される。次の deferred backlog は richer provenance (`FS-DATA-05`) へ進める

## D-141: `FS-DATA-05` の first implementation は internal `provenance[]` 追加 + `seenInFeeds[]` 併存で閉じる

- 決定: `FS-DATA-05` の最初の実装では、canonical article object と managed update state に `provenance[]` を追加する一方、既存 `seenInFeeds[]` は derived compatibility summary として残す。`provenance[]` の各 entry は `feedId` / `firstSeenAt` / `lastSeenAt` / `sourceItemId` / `matchedBy` を持ち、`matchedBy` は `primary` / `normalizedUrl` / `feedItem` に限定する
- 理由: richer provenance を入れたい一方で、public JSON・UI・既存 tests まで同時に壊すと差分が広がりすぎるため。まず internal schema と checkpoint / dedupe merge に閉じた最小差分で導入し、既存 `seenInFeeds[]` を互換要約として残す方が安全に進められる
- 影響: `articles.json` など public JSON の shape と route 構造はこの task では変えない。`seenInFeeds[]` は当面 `provenance[]` から導出できる summary として扱い、public provenance export や UI surfacing、per-fetch の完全履歴は後続 docs task へ送る

## D-142: `FS-DATA-07` の first implementation は same-source/title/date fallback に限定する

- 決定: `FS-DATA-07` の最初の実装では、exact dedupe（`normalizedUrl` / `(feedId, sourceItemId)`）で一致しなかった article にだけ fuzzy pass を適用し、candidate は `sourceName` / `language` / `titleCompareKey` 一致 + 両方の `publishedAt` が 72 時間以内である場合に限定する。fuzzy merge が成立した場合の internal provenance / managed update state では `matchedBy=fuzzyTitleDate` を追加で使ってよい
- 理由: fuzzy dedupe は誤爆コストが最も高いため、同一 source の複数 feed や URL ぶれ由来の duplicate に絞って conservative に始めた方が rollback しやすく、public JSON や UI 契約への波及も抑えやすい
- 影響: first implementation は `dedupeArticles()` と internal tests を中心に閉じ、body fetch・HTML 類似度・embedding / LLM・cross-source clustering・manual review UI・public confidence score は含めない。問題が出た場合の rollback は fuzzy pass を外して full rebuild すれば足り、追加 migration は前提にしない


## D-143: `FS-DATA-07` は exact miss 後の conservative fallback として `dedupeArticles()` に閉じて実装する

- 決定: `FS-DATA-07` の first implementation では、exact dedupe で未一致だった article にだけ same `sourceName` / `language` / `titleCompareKey` + `publishedAt` 72 時間 window の fuzzy fallback を適用し、merge 成立時は incoming provenance を `matchedBy=fuzzyTitleDate` として retag する
- 理由: docs split で固定した conservative 境界をそのまま `dedupeArticles()` に閉じて消費すれば、public JSON / route / checked-in HTML shell を変えずに duplicate precision だけを上げられるため。exact key miss 後の fallback に限定すれば rollback も単純で、追加 migration なしに full rebuild で戻せる
- 影響: `src/shared/contracts.ts` / `scripts/pipeline/dedupeArticles.ts` / `scripts/pipeline/update.ts` と internal tests が主な変更対象になる。`matchedBy` の許容値には `fuzzyTitleDate` が増えるが、public exports には surfacing しない


## D-144: deferred data backlog は first implementation 完了後の close-out 状態として扱い、以後は拡張ごとに docs-first で再分割する

- 決定: `FS-DATA-05` / `FS-DATA-06` / `FS-DATA-07` は first implementation まで完了済みとして close-out し、以後の作業は public provenance surfacing、canonicalization の追加 precision rule、fuzzy dedupe の stricter observability / rollback などを別々の docs-first task に切り分けて扱う
- 理由: deferred backlog を未完了のまま残すと、既に実装済みの internal schema / precision layer / conservative fuzzy fallback を再度「未着手 task」と誤認しやすく、次の差分で public JSON や runtime 拡張まで一度に混ぜてしまうため
- 影響: top-level backlog と詳細 task セクションの整合を docs / traceability / alignment test で同期し、今後の拡張は元の `FS-DATA-05` / `FS-DATA-06` / `FS-DATA-07` を直接 reopen せず、新しい docs task から始める

## D-145: public provenance の first implementation は export-only の bounded field に留める

- 決定: internal `provenance[]` を public へ最初に surfacing するときは、`PublicArticleSummary` 系へ optional `alsoSeenInSourceIds: string[]` を追加する export-only task とし、値は `provenance[]` から導出した secondary source id の stable ordered list に限定する。primary source は既存 `sourceId` / `sourceName` を使い続ける
- 理由: multi-source で観測された記事を public JSON で追跡できるようにしつつ、`firstSeenAt` / `lastSeenAt` / `sourceItemId` / `matchedBy` をそのまま露出すると契約が重くなり、audit UI や confidence score まで一緒に設計したくなって差分が肥大化しやすいため
- 影響: 最初の実装対象は `src/shared/contracts.ts` / `scripts/pipeline/buildPublicExports.ts` / page shard 生成 / public JSON tests に限定し、audit UI・`seenInFeeds[]` 除去・provenance badge 表示は別 docs-first task へ送る

## D-146: public provenance の最初の UI surfacing は bounded secondary-source chip に限定する

- 決定: `FS-DATA-09` 後の最初の provenance UI は、shared article card 上で secondary source を補助表示する chip 群に限定する。label と href は既存 `sources.json` / source registry の `sourceId -> name` / source page href 解決を再利用し、最大 2 件 + `+N` overflow までに抑える
- 理由: export-only で public 化した `alsoSeenInSourceIds` を UI で使い始める際に、時系列 audit・confidence・manual review まで一気に混ぜると差分が大きくなりやすい一方、shared article card の補助 chip なら既存 card / source route 資産を再利用しつつ bounded な surfacing に閉じられるため
- 影響: first implementation は `src/web/app.ts` / checked-in shell asset / CSS / web tests に閉じ、new route / filter / query param / sort change / search scoring 変更は別 task とする。unknown source id は黙って無視してよく、`matchedBy` / timestamp / confidence を public UI に追加しない

## D-147: fuzzy dedupe の次の拡張は internal counter + explicit kill switch に限定する

- 決定: `FS-DATA-07` の次の差分では heuristic や candidate 条件を広げず、internal observability と rollback のために `PipelineSummary` / `UpdatePipelineSummary` へ `fuzzyDuplicatesCollapsed` のような aggregate counter を追加し、`run.ts` / `update.ts` には `--disable-fuzzy-dedupe` のような明示的 kill switch を足す境界に限定する
- 理由: fuzzy dedupe は conservative に入っているが、問題が起きた際に「今回の run で何件 collapse したか」と「次の publish で新しい fuzzy merge を止められるか」がすぐ分からないと運用が重い。一方で per-article audit export や broader matching まで同時に入れると public contract や UI へ波及しやすいため、まずは internal summary と明示的 off switch に閉じる方が安全だから
- 影響: 将来の実装対象は `src/shared/contracts.ts` / `scripts/pipeline/run.ts` / `scripts/pipeline/update.ts` / `scripts/pipeline/dedupeArticles.ts` と tests に留め、public JSON / route / checked-in HTML shell は変えない。kill switch は新しい fuzzy merge を止めるためのもので、既に retained output に入った fuzzy merge を自動で元に戻すものではないため、完全 rollback には clean な full rebuild を前提とする

## D-148: fuzzy dedupe observability 実装は aggregate summary と kill switch に閉じる

- 決定: `FS-DATA-10` では `scripts/pipeline/dedupeArticles.ts` に aggregate `fuzzyDuplicatesCollapsed` を返す internal helper を追加し、`PipelineSummary` / `UpdatePipelineSummary` へ同名 count を載せる。`run.ts` / `update.ts` は `--disable-fuzzy-dedupe` を parse して fuzzy fallback だけを無効化する
- 理由: `FS-DOCS-28` で固定した observability / rollback 境界を最小差分で消費するには、dedupe アルゴリズム自体を広げずに aggregate count と explicit off switch を配線するのが最も安全だから。`runUpdatePipeline()` でも同じ switch を尊重すれば、publish 前 diagnosis と clean rebuild 前提の rollback がしやすくなる
- 影響: 変更対象は `src/shared/contracts.ts` / `scripts/pipeline/dedupeArticles.ts` / `scripts/pipeline/run.ts` / `scripts/pipeline/update.ts` / internal tests に留まり、public JSON / route / checked-in HTML shell / UI には波及しない。logger は aggregate count のみを出し、per-article debug surface は今後も別 task に分離する

## D-149: canonicalization の次差分は deterministic allowlisted rule table に限定する

- 決定: `FS-DATA-06` 後の次差分は、既存 precision layer の上に repo 内で version 管理する allowlisted host / path / query rewrite rule table を足す docs-first task とし、追加 network I/O や source registry への manual canonical override を含めない
- 理由: canonicalization の精度は上げたいが、bounded redirect follow まである現状に新しい fetch や host-agnostic stripping を混ぜると failure surface が増える。deterministic rule table なら normalize stage と tests に閉じたまま public contract を触らず改善余地を残せるため
- 影響: 後続実装は `scripts/pipeline/normalizeFeed.ts` と tests を主戦場にし、`data/feeds.json` / public JSON / route / checked-in HTML shell は変更対象外とする。generic query stripping の拡大、HTML canonical parse、本文 fetch、runtime-configurable rule download は別 task に分離する


## D-150: canonicalization deterministic rule-table の first implementation は Reddit presentation cleanup に閉じる

- 決定: `FS-DATA-11` の first implementation では、deterministic rule table に Reddit 用の host alias rewrite と comment-thread query cleanup だけを追加する。対象は `old.reddit.com` / `new.reddit.com` / `www.reddit.com` で、query cleanup は `context` / `depth` / `sort` / `share_id` / `rdt` に限定する
- 理由: repository に既に Reddit feed 群があり、presentation alias や thread-view 用 query を deterministic に落とす価値が高い一方、redirect follow の対象を新しい host へ広げる必要がない。smallest useful rule として採ることで `FS-DOCS-29` の non-network 境界をそのまま消費できる
- 影響: 実装対象は `scripts/pipeline/normalizeFeed.ts` と tests に閉じ、`run.ts` / `update.ts` / source registry / public JSON / route / checked-in HTML shell は変更しない。rule は redirect-aware precision layer の後段で適用し、Reddit cleanup のために追加 fetch を行わない

## D-151: fuzzy dedupe の次差分は explicit opt-in internal audit export に限定する

- 決定: `FS-DATA-10` の次に per-article fuzzy evidence を扱う場合は、default logger や public JSON ではなく、`run.ts` / `update.ts` の明示的 flag からだけ有効になる internal audit export task として切り出す
- 理由: aggregate counter と kill switch だけでは「どの merge が起きたか」を深掘りできないが、既定ログや public data に per-article 情報を流し始めると noisy かつ契約変更が大きい。opt-in export に閉じれば diagnosis 用 evidence を足しつつ、通常 publish の surface を増やさずに済むため
- 影響: first implementation は fuzzy merge ごとの bounded record（`winnerArticleId` / `incomingArticleId` / `winnerFeedId` / `incomingFeedId` / `titleCompareKey` / `publishedAtDeltaHours` / `matchedBy`）に限定し、raw summary / body / HTML / public route / article card UI / broader matching / manual review workflow は同じ task に含めない

## D-152: `FS-DATA-12` は `--fuzzy-audit-file` による opt-in JSON export に閉じる

- 決定: `FS-DATA-12` の first implementation では、`dedupeArticlesWithSummary()` が fuzzy merge ごとの bounded audit record を返し、`run.ts` / `update.ts` は `--fuzzy-audit-file <path>` が明示されたときだけ JSON audit file を書き出す
- 理由: diagnosis 用 evidence は欲しいが、default logger を per-article 出力で noisy にしたくなく、checked-in output や public JSON 契約も広げたくない。明示的 file path flag なら run ごとの一時 evidence に閉じたまま rollback / inspection へ使いやすいため
- 影響: 実装対象は `scripts/pipeline/dedupeArticles.ts` / `run.ts` / `update.ts` / tests に閉じる。audit record は `winnerArticleId` / `incomingArticleId` / `winnerFeedId` / `incomingFeedId` / `titleCompareKey` / `publishedAtDeltaHours` / `matchedBy='fuzzyTitleDate'` に限定し、retained public article payload、manual review workflow、broader fuzzy matching、cross-source fuzzy は含めない

## D-153: fuzzy dedupe の次差分は internal manual-review handoff artifact に限定する

- 決定: `FS-DATA-12` の次に人手確認向けの evidence を足す場合は、default logger や public JSON ではなく、明示的 flag でだけ生成される internal manual-review handoff artifact として切り出す
- 理由: 現在の audit export は machine-readable な bounded record として十分だが、人が triage するには title / URL / source name のような読みやすい情報が不足する。一方でそれらを既定ログや public surface に載せると noise と契約変更が大きいため、opt-in artifact に閉じる方が安全なため
- 影響: 後続 implementation は `run.ts` / `update.ts` / tests を中心に、`winnerTitle` / `incomingTitle` / `winnerUrl` / `incomingUrl` / `winnerSourceName` / `incomingSourceName` のような human-readable evidence を bounded に追加してよい。ただし accept/reject persistence、`update-state.json` override、broader fuzzy heuristic、cross-source fuzzy、manual review UI route は同じ task に含めない


## D-154: `FS-DATA-13` は `--fuzzy-handoff-file` による opt-in JSON handoff export に閉じる

- 決定: `FS-DATA-13` の first implementation では、`dedupeArticlesWithSummary()` が既存 audit record に `winnerTitle` / `incomingTitle` / `winnerUrl` / `incomingUrl` / `winnerSourceName` / `incomingSourceName` を足した bounded handoff record を返し、`run.ts` / `update.ts` は `--fuzzy-handoff-file <path>` が明示されたときだけ JSON handoff file を書き出す
- 理由: 人手確認に必要な読みやすい evidence は欲しいが、default logger や public JSON 契約は広げたくない。既存の audit export と同じ opt-in file path で閉じれば、bounded evidence を確認しやすい一時 artifact に留められるため
- 影響: 実装対象は `src/shared/contracts.ts` / `scripts/pipeline/dedupeArticles.ts` / `run.ts` / `update.ts` / tests に閉じる。handoff record は既存 audit field を保ったまま title / URL / source name を追加するだけに限定し、accept/reject persistence、`update-state.json` override、manual review UI、broader fuzzy matching、cross-source fuzzy は含めない


## D-155: fuzzy dedupe の次差分は explicit false-positive reject list に限定する

- 決定: `FS-DATA-13` の次に人手確認結果を future run へ反映したい場合は、default logger / public JSON / manual review UI ではなく、operator-authored な explicit false-positive reject list を明示的 flag で読み込む internal-only task として切り出す
- 理由: handoff artifact があれば known false positive の pair を人が特定できるが、次に必要なのはその pair だけを保守的に止める最小 control であって、accept persistence・broader matching・UI まで同時に入れることではない。reject list を bounded key + opt-in path に閉じれば、既存 publish surface や managed state を広げずに誤マージ抑止だけ追加できるため
- 影響: 後続 implementation は `run.ts` / `update.ts` / tests を中心に、order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` を key にした reject entry を読んで current run の fuzzy merge を suppress してよい。ただし `update-state.json` への自動書き戻し、checked-in artifact、retroactive unmerge、accept persistence、broader fuzzy heuristic、cross-source fuzzy、manual review UI route は同じ task に含めない

## D-156: `FS-DATA-14` は `--fuzzy-reject-file` による explicit false-positive reject list 読み込みに閉じる

- 決定: `FS-DATA-14` の first implementation では、`run.ts` / `update.ts` が `--fuzzy-reject-file <path>` を受け付け、operator-authored な JSON reject list を明示的 flag 指定時だけ読み込む。`dedupeArticlesWithSummary()` は order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` に一致する candidate だけを fuzzy merge せず残す
- 理由: handoff artifact から known false positive の pair は特定できるので、次に必要なのは exact dedupe や public surface を崩さず、その pair だけ future run で抑止する最小 control であるため。bounded reject key に閉じれば manual review state machine や broader heuristic を導入せずに保守的な suppression を追加できる
- 影響: 実装対象は `src/shared/contracts.ts` / `scripts/pipeline/dedupeArticles.ts` / `run.ts` / `update.ts` / tests に閉じる。reject entry は `articleIdPair` / `matchedBy` を必須とし、`winnerTitle` / `incomingTitle` / `note` は human-readable echo field として許容する一方、`update-state.json` 自動書き戻し / checked-in artifact / retroactive unmerge / accept persistence / broader matching / manual review UI は含めない

## D-157: retroactive unmerge は既存 reject list を使った clean full rebuild procedure に限定する

- 決定: `FS-DATA-14` 後に既に publish 済みの known false positive を split し直したい場合は、新しい rebuild 専用 state machine / checked-in artifact / CLI flag を足さず、retained public data / `update-state.json` を持ち越さない clean full rebuild と既存 `--fuzzy-reject-file` を併用する docs-only workflow として扱う
- 理由: 現状でも reject list は future fuzzy merge を止められ、fresh rebuild を行えば same pair を再マージしない状態で全体出力を作り直せる。ここで別の persistence や partial rollback mechanism を入れると scope が急に広がるため
- 影響: 今回の差分は `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `docs/TRACEABILITY.md` / `tests/typescript-tooling.test.ts` の docs sync に閉じ、runtime code / public JSON / route / checked-in output contract は変えない。fresh output directory の使用または retained public data / `update-state.json` の明示削除を operator 手順として説明し、accept persistence / broader matching / manual review UI は引き続き別 task に分離する

## D-158: fuzzy dedupe の次差分は explicit accept list による review churn 抑制に限定する

- 決定: `FS-DOCS-33` 後に review 済み true positive pair の再確認 churn を減らしたい場合は、default logger / public JSON / manual review UI ではなく、operator-authored な explicit accept list を明示的 flag で読み込む internal-only task として切り出す
- 理由: reject list と rebuild-only recovery path で false positive 側の制御は揃ったが、同じ true positive pair を full rebuild や recurring run のたびに handoff で見直す運用はまだ重い。一方で broader matching や UI を同時に入れると scope が一気に広がるため、既存 heuristic の candidate を pre-reviewed 扱いに閉じる方が安全だから
- 影響: 後続 implementation は `run.ts` / `update.ts` / tests を中心に、order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` を key にした accept entry を opt-in で読んで repeat fuzzy audit / handoff の再掲を抑止してよい。ただし non-candidate の force merge、`update-state.json` への自動書き戻し、自動 accept 生成、checked-in artifact、retroactive unmerge、broader fuzzy matching、cross-source fuzzy、manual review UI route は同じ task に含めない。accept list と reject list が競合する場合は reject list が優先する

## D-159: `FS-DATA-15` は `--fuzzy-accept-file` による explicit accept list 読み込みと repeat artifact suppression に閉じる

- 決定: `FS-DATA-15` の first implementation では、`run.ts` / `update.ts` が `--fuzzy-accept-file <path>` を受け付け、operator-authored な JSON accept list を明示的 flag 指定時だけ読み込む。`dedupeArticlesWithSummary()` は order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` に一致する既存 heuristic candidate を従来どおり fuzzy merge してよいが、repeat fuzzy audit / handoff artifact への再掲だけを抑止する
- 理由: review 済み true positive pair について必要なのは merge semantics の変更ではなく、同じ evidence を毎回見直す churn を減らすことだから。merge 自体や summary / public export を変えない方が scope が小さく、既存 runtime と矛盾しにくい
- 影響: `src/shared/contracts.ts` に bounded accept entry shape と CLI option を追加し、`scripts/pipeline/dedupeArticles.ts` / `run.ts` / `update.ts` / tests を最小差分で拡張してよい。ただし non-candidate の force merge、exact dedupe precedence の上書き、`update-state.json` 自動書き戻し、自動 accept 生成、checked-in artifact、retroactive unmerge、broader fuzzy matching、cross-source fuzzy、manual review UI route は同じ task に含めない。accept list と reject list が競合する場合は reject list を優先する

## D-160: fuzzy dedupe の次差分は dedicated review-state JSON への canonical writeback に限定する

- 決定: `FS-DATA-15` 後に accept/reject state 管理の手作業 churn を減らしたい場合は、`update-state.json` や manual review UI ではなく、operator-managed な explicit accept/reject input を dedicated review-state JSON snapshot へ canonical writeback する internal-only task として切り出す
- 理由: 既に accept/reject list で runtime decision は制御できるので、次の最小価値は heuristic を広げることではなく、review state の整形・重複除去・競合整理を保守的に自動化することだから。`update-state.json` mutation や pending queue まで同時に入れると state machine が急に重くなるため
- 影響: 後続 implementation は `run.ts` / `update.ts` / tests を中心に、既存 accept/reject entry を canonical order で dedicated review-state JSON へ writeback してよい。ただし未レビュー handoff の自動 accept/reject 化、pending queue、自動 accept 生成、`update-state.json` manual override、checked-in artifact、broader fuzzy matching、cross-source fuzzy、manual review UI route は同じ task に含めない。競合時は reject 優先を維持する

## D-161: `FS-DATA-16` は `--fuzzy-review-state-file` による dedicated review-state JSON writeback に閉じる

- 決定: `FS-DATA-16` の first implementation では、`run.ts` / `update.ts` が `--fuzzy-review-state-file <path>` を受け付け、current run の explicit `--fuzzy-reject-file` / `--fuzzy-accept-file` input から `{ accepted, rejected }` の review-state JSON snapshot を operator-managed path へ書き出す
- 理由: 次の最小価値は runtime heuristic や UI を広げることではなく、operator-authored な review state を canonical pair order・dedupe・reject 優先の競合解決つきで再利用しやすい internal artifact に揃えることだから。これなら既存 accept/reject semantics を変えずに手作業 churn だけ減らせる
- 影響: 実装対象は `src/shared/contracts.ts` / `scripts/pipeline/run.ts` / `scripts/pipeline/update.ts` / tests に閉じる。review-state JSON は bounded `{ accepted, rejected }` shape とし、既存 entry shape を再利用してよいが、未レビュー handoff 候補の自動 accept/reject 生成、pending queue、`update-state.json` mutation、checked-in artifact、broader fuzzy matching、cross-source fuzzy、manual review UI route は同じ task に含めない

## D-162: fuzzy dedupe の次差分は opt-in internal manual-review HTML artifact に限定する

- 決定: `FS-DATA-16` 後に human review のしやすさを改善したい場合は、broader fuzzy matching や checked-in public route ではなく、明示的 flag でだけ生成される self-contained な manual-review HTML artifact として切り出す
- 理由: handoff JSON と dedicated review-state JSON は既に揃っているため、次の最小価値は matching semantics を広げることではなく、既存 evidence を人が読みやすい形で束ねることだから。read-only local HTML に閉じれば state machine や public deploy surface を増やさず review 体験だけを改善できるため
- 影響: 後続 implementation は `run.ts` / `update.ts` / tests を中心に、current run の fuzzy handoff evidence と explicit review state を単一 HTML artifact へ束ねてよい。ただし accept/reject の書き戻し、pending queue、自動 accept/reject 生成、localStorage や form submit を使う stateful UI、checked-in artifact、public JSON / route / article card UI、broader fuzzy matching、cross-source fuzzy は同じ task に含めない

## D-163: `FS-DATA-17` は `--fuzzy-review-html-file` による read-only internal HTML artifact に閉じる

- 決定: `FS-DATA-17` は `run.ts` / `update.ts` に `--fuzzy-review-html-file <path>` を追加し、明示されたときだけ current run の fuzzy handoff evidence と canonical review state を単一 HTML file へ束ねる internal-only 実装に閉じる
- 理由: `FS-DATA-16` までで accept / reject の canonical state は JSON として書き出せるため、次に必要なのは matching を広げることではなく、operator が JSON を手で辿らずに current run の evidence と既存 review state を同時に眺められる read-only artifact だから
- 影響: 実装対象は `src/shared/contracts.ts` / `scripts/pipeline/run.ts` / `scripts/pipeline/update.ts` / tests に閉じる。HTML artifact は self-contained / local-only / read-only とし、current-run candidate には accepted / rejected / unreviewed status badge を付けてよい。一方で accept/reject の書き戻し、pending queue、自動 accept/reject 生成、localStorage / form submit / API call、`update-state.json` mutation、checked-in artifact、public route、broader fuzzy matching、cross-source fuzzy は含めない

## D-164: fuzzy dedupe の次の broader matching は same-source punctuation-folded title key に限定する

- 決定: `FS-DATA-17` 後に broader matching へ進む場合でも、まずは cross-source fuzzy や新しい review state machine ではなく、same `sourceName` / `language` と既存 72 時間 window を維持した deterministic な punctuation-folded title compare key として切り出す
- 理由: handoff / reject / accept / review-state / read-only HTML まで揃ったため、次の最小価値は同一 source 内の punctuation-only near-miss を conservative に拾うことにある。一方で cross-source fuzzy や edit distance を先に入れると false positive 面と state surface が一気に広がるため
- 影響: 後続 implementation は `scripts/pipeline/dedupeArticles.ts` / `tests/load-feeds.test.ts` / `tests/update-workflow.test.ts` / `tests/typescript-tooling.test.ts` を中心に、既存 `createTitleCompareKey()` 相当の deterministic broadening に閉じてよい。ただし `matchedBy='fuzzyTitleDate'`、exact dedupe precedence、accept/reject / review-state / audit / handoff / manual-review HTML の bounded contract は維持し、cross-source fuzzy / edit distance / state mutation / public route は同じ task に含めない

## D-165: `FS-DATA-18` は exact title key 優先 + punctuation-folded fallback に閉じる

- 決定: `FS-DATA-18` では fuzzy candidate lookup を same `sourceName` / `language` + 72 時間 window のまま二段階化し、まず既存の trim・連続空白 collapse・lowercase compare key を試し、未一致のときだけ bounded な separator / wrapper punctuation を folding した title compare key を fallback として試す
- 理由: punctuation-only near-miss を拾いたい一方で、既存 exact title key による conservative matching の振る舞いは維持したいため。二段階 lookup なら broader key を足しても既存 match を優先でき、accept/reject / review-state / audit / handoff / review HTML の state surface を増やさずに widening できる
- 影響: 実装対象は `scripts/pipeline/dedupeArticles.ts` と existing run / update surface の再利用、`tests/load-feeds.test.ts` / `tests/update-workflow.test.ts` / `tests/typescript-tooling.test.ts` に閉じる。broader fallback で merge した場合も `matchedBy='fuzzyTitleDate'` は維持し、audit / handoff の `titleCompareKey` には実際に candidate 判定へ使われた compare key を記録してよい。一方で cross-source fuzzy / edit distance / token reorder / stemming / body fetch / HTML canonical parse / state mutation / public route は同じ task に含めない

## D-166: fuzzy dedupe の次の widening は allowlisted source-family fallback に限定する

- 決定: `FS-DATA-18` 後に same-source を越えた widening が必要でも、generic cross-source fuzzy や hostname heuristic ではなく、repo-managed な allowlisted source-family key に一致する sibling feed 間だけを対象にした fallback として docs-first で切り出す
- 理由: Qiita / Zenn / ITmedia のような同一 platform / publisher 配下の feed バリエーションで duplicate を拾いたい一方、generic hostname grouping や cross-source fuzzy を先に入れると false positive 面が急に広がり、既存 accept/reject / review-state / audit / handoff / review HTML の bounded state surface を不必要に複雑化するため
- 影響: 後続 implementation は same `language` と既存 72 時間 window を維持した allowlisted source-family fallback に閉じ、same `sourceName` fuzzy lookup を優先した後段として扱ってよい。一方で generic hostname grouping / site-wide blanket rule / cross-language merge / edit distance / token reorder / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は同じ task に含めない

## D-167: `FS-DATA-19` は same-source 優先の allowlisted source-family fallback に閉じる

- 決定: `FS-DATA-19` では fuzzy candidate lookup を same `sourceName` 優先のまま広げ、未一致時だけ repo-managed な allowlisted source-family key に一致する sibling feed 間で fallback lookup を行う。first implementation の family table は Qiita / Zenn / ITmedia に限定する
- 理由: Qiita / Zenn / ITmedia の sibling feed では同一記事が複数 feed に重複して出やすく、same-source だけでは取りこぼす一方、generic hostname grouping や blanket cross-source fuzzy を開けると false positive 面が急に広がるため
- 影響: 実装対象は `scripts/pipeline/dedupeArticles.ts` と existing run / update surface の再利用、`tests/load-feeds.test.ts` / `tests/update-workflow.test.ts` / `tests/typescript-tooling.test.ts` に閉じる。family fallback でも existing title compare key sequence と same `language` + 72h gating、`matchedBy='fuzzyTitleDate'`、accept/reject / review-state / audit / handoff / review HTML contract を維持してよい。一方で generic hostname grouping / site-wide blanket rule / cross-language merge / edit distance / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は同じ task に含めない

## D-168: fuzzy dedupe の次差分は source-family allowlist を explicit registry metadata へ移すことに限定する

- 決定: `FS-DATA-19` 後に source-family fallback を維持拡張したい場合でも、generic hostname grouping や broader cross-source fuzzy ではなく、family key の定義源を `scripts/pipeline/dedupeArticles.ts` の hardcoded sourceName table から `data/feeds.json` の explicit bounded field へ移す docs-first task として切り出す
- 理由: source-family fallback 自体は conservative に入ったが、source 名の rename や source 追加時に hardcoded table を毎回 code 側で更新すると drift しやすい。一方で family key を registry metadata に寄せれば repo-managed な allowlist を維持しつつ、matching semantics を広げずに運用しやすくできるため
- 影響: 後続 implementation は `src/shared/contracts.ts` / `scripts/pipeline/loadFeeds.ts` / `scripts/pipeline/dedupeArticles.ts` / tests を中心に、optional な explicit registry field を読んで existing Qiita / Zenn / ITmedia allowlist を metadata 化してよい。ただし same `sourceName` 優先、same `language` + 72h gating、existing title compare key sequence、`matchedBy='fuzzyTitleDate'` は維持し、generic hostname grouping / site-wide blanket rule / cross-language merge / edit distance / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は同じ task に含めない

## D-169: `FS-DATA-20` は allowlisted source-family key の定義源だけを `feeds.json` registry field に移す

- 決定: `FS-DATA-20` では `scripts/pipeline/dedupeArticles.ts` の hardcoded sourceName table を廃し、allowlisted sibling feed fallback の family key は `data/feeds.json` の optional `fuzzySourceFamilyKey` を `loadFeeds()` 経由で読み込んだ値だけから解決する
- 理由: `FS-DATA-19` の matching semantics はそのままでも、hardcoded sourceName table を持ち続けると source rename や feed 追加ごとに code と registry が drift しやすい。一方で explicit registry field に寄せれば repo-managed allowlist を保ったまま定義源を 1 か所へ寄せられるため
- 影響: 実装対象は `src/shared/contracts.ts` / `scripts/pipeline/loadFeeds.ts` / `data/feeds.json` / `scripts/pipeline/dedupeArticles.ts` / tests に閉じる。first implementation の `fuzzySourceFamilyKey` は `itmedia` / `qiita` / `zenn` に限定し、same `sourceName` 優先、same `language` + 72h gating、existing title compare key sequence、`matchedBy='fuzzyTitleDate'` を維持する。一方で generic hostname grouping / site-wide blanket rule / cross-language merge / edit distance / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は同じ task に含めない

## D-170: fuzzy dedupe の次差分は allowlisted registrable-domain fallback に限定する

- 決定: `FS-DATA-20` 後に source-family fallback の外側でも取りこぼしを減らしたい場合、generic hostname grouping や blanket cross-source fuzzy を開けるのではなく、same `sourceName` fuzzy lookup と explicit `fuzzySourceFamilyKey` fallback の両方が未一致のときだけ、`siteUrl` を優先し必要なら `feedUrl` を fallback に使って導出した registrable domain による allowlisted fallback を docs-first task として切り出す
- 理由: explicit source-family key で扱う sibling feed は既に conservative に束ねられる一方、publisher 配下の feed variation では source-family key を増やす前に host 由来の bounded fallback を検討したいケースがある。ただし `www.reddit.com` のような topic/community feed が多数ぶら下がる host を generic に束ねると false positive 面が急激に広がるため、registrable domain 由来でも repo-managed allowlist に閉じる必要がある
- 影響: 後続 implementation は `siteUrl` 優先・`feedUrl` fallback の registrable domain 抽出、same `language` + 72h gating、existing title compare key sequence、`matchedBy='fuzzyTitleDate'`、explicit `fuzzySourceFamilyKey` precedence の維持に閉じてよい。一方で generic site-wide hostname grouping / blanket `www.reddit.com` grouping / cross-language merge / edit distance / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は同じ task に含めない

## D-171: `FS-DATA-21` は allowlisted registrable-domain fallback を existing feed metadata から導出する

- 決定: `FS-DATA-21` では新しい registry field や generic hostname rule を追加せず、same `sourceName` fuzzy lookup と explicit `fuzzySourceFamilyKey` fallback の両方が未一致のときだけ、loaded `FeedDefinition` の `siteUrl` を優先し必要なら `feedUrl` を fallback に使って導出した registrable domain による deterministic fallback を後段で試す
- 理由: source-family fallback の bounded semantics は維持したまま、publisher 配下の feed variation で family key を追加する前の conservative な取りこぼしだけを減らしたいから。existing feed metadata から導出すれば public contract を増やさずに済み、`www.reddit.com` のような community host を blanket に束ねる generic rule も避けられる
- 影響: 実装対象は `scripts/pipeline/dedupeArticles.ts` と tests に閉じる。first implementation の allowlist は `itmedia.co.jp` / `qiita.com` / `zenn.dev` に限定し、same `sourceName` → explicit `fuzzySourceFamilyKey` → registrable-domain fallback の precedence、same `language` + 72h gating、existing title compare key sequence、`matchedBy='fuzzyTitleDate'`、accept/reject / review-state / audit / handoff / manual-review HTML artifact の existing bounded surface を維持する。一方で generic site-wide hostname grouping / blanket `www.reddit.com` grouping / cross-language merge / edit distance / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は含めない

## D-172: allowlisted registrable-domain fallback の定義源は explicit registry metadata へ寄せる

- 決定: `FS-DATA-21` 後に hostname fallback を維持拡張したい場合でも、`siteUrl` / `feedUrl` からの自動導出と code 内 hardcoded domain allowlist を増やし続けるのではなく、participation の定義源を `data/feeds.json` の explicit bounded registry field（例: `fuzzyRegistrableDomainKey`）へ移す docs-first task として切り出す
- 理由: existing feed metadata からの導出は first implementation としては十分だが、feed metadata の更新や `siteUrl` 変更だけで hostname fallback 参加面が暗黙に変わると drift と accidental widening を招きやすい。explicit registry field に寄せれば repo-managed な opt-in を維持しつつ、same `sourceName` / explicit `fuzzySourceFamilyKey` precedence や bounded review surface を崩さずに管理しやすくなる
- 影響: 後続 implementation は `src/shared/contracts.ts` / `scripts/pipeline/loadFeeds.ts` / `data/feeds.json` / `scripts/pipeline/dedupeArticles.ts` / tests に閉じ、existing allowlisted registrable domain（`itmedia.co.jp` / `qiita.com` / `zenn.dev`）だけを explicit registry value として許可してよい。一方で generic site-wide hostname grouping / blanket `www.reddit.com` grouping / cross-language merge / edit distance / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は同じ task に含めない

## D-173: `FS-DATA-22` は registrable-domain fallback の opt-in 定義源を explicit registry field に限定する

- 決定: `FS-DATA-22` では `siteUrl` / `feedUrl` からの自動導出と hardcoded domain allowlist を廃し、allowlisted registrable-domain fallback の opt-in key は `data/feeds.json` の optional `fuzzyRegistrableDomainKey` を `loadFeeds()` 経由で読み込んだ値だけから解決する
- 理由: `FS-DATA-21` の derived metadata fallback は first implementation としては十分だったが、feed metadata の変更だけで hostname fallback 参加面が暗黙に変わると drift と accidental widening を招きやすい。一方で explicit registry field に寄せれば repo-managed な opt-in を維持しつつ、same `sourceName` / explicit `fuzzySourceFamilyKey` precedence や bounded review surface を崩さずに管理しやすくなるため
- 影響: 実装対象は `src/shared/contracts.ts` / `data/feeds.json` / `scripts/pipeline/loadFeeds.ts` / `scripts/pipeline/dedupeArticles.ts` / `tests/load-feeds.test.ts` / `tests/update-workflow.test.ts` / `tests/typescript-tooling.test.ts` に閉じる。first implementation の `fuzzyRegistrableDomainKey` は `itmedia.co.jp` / `qiita.com` / `zenn.dev` に限定し、same `sourceName` → explicit `fuzzySourceFamilyKey` → registrable-domain fallback の precedence、same `language` + 72h gating、existing title compare key sequence、`matchedBy='fuzzyTitleDate'` を維持する。一方で derived metadata fallback / hardcoded domain allowlist / generic site-wide hostname grouping / blanket `www.reddit.com` grouping / cross-language merge / edit distance / body fetch / HTML canonical parse / `update-state.json` mutation / checked-in artifact / public route は同じ task に含めない


## D-174: fuzzy dedupe の次差分は internal match-scope surfacing に限定する

- 決定: `FS-DATA-22` 後に widening tier の observability を補いたい場合でも、broader matching や review-state mutation ではなく、current run の fuzzy audit / handoff / manual-review HTML artifact にだけ optional な `scopeKind`（`source` / `sourceFamily` / `registrableDomain`）を足す docs-first task として切り出す
- 理由: same `sourceName` / explicit `fuzzySourceFamilyKey` / explicit `fuzzyRegistrableDomainKey` の 3 tier が揃ったことで、human reviewer からは「fuzzy merge が起きた」だけでなく「どの widening tier で起きたか」を読み分けたい需要が増えた。一方で accept/reject key や public JSON まで広げると scope が急に広がるため、まずは internal artifact の bounded observability に閉じるのが最小差分で安全なため
- 影響: 後続 implementation は `src/shared/contracts.ts` / `scripts/pipeline/dedupeArticles.ts` / `scripts/pipeline/run.ts` / `scripts/pipeline/update.ts` / tests を中心に、`matchedBy='fuzzyTitleDate'` と existing `articleIdPair` key を維持したまま audit / handoff / `--fuzzy-review-html-file` に `scopeKind` を surfacing してよい。ただし broader matching、same `sourceName` → explicit `fuzzySourceFamilyKey` → explicit `fuzzyRegistrableDomainKey` の precedence rewrite、accept/reject list の key 変更、dedicated review-state JSON の shape 変更、`update-state.json` mutation、checked-in artifact、public JSON / route / article card UI は同じ task に含めない

## D-175: `FS-DATA-23` は current-run artifact にだけ widening tier を出す

- 決定: `FS-DATA-23` では fuzzy audit / handoff record に optional な `scopeKind`（`source` / `sourceFamily` / `registrableDomain`）を追加し、`--fuzzy-review-html-file` でも current-run candidate card にだけ同じ widening tier を表示する
- 理由: operator が `matchedBy='fuzzyTitleDate'` の current run candidate を読むとき、same `sourceName` / explicit `fuzzySourceFamilyKey` / explicit `fuzzyRegistrableDomainKey` のどの tier で candidate 判定に到達したかが分かると review がしやすい。一方で accept/reject key や dedicated review-state JSON まで変えると scope が広がりすぎるため
- 影響: 実装対象は `src/shared/contracts.ts` / `scripts/pipeline/dedupeArticles.ts` / `scripts/pipeline/run.ts` / tests に閉じる。`scopeKind` は current run で実際に使われた lookup tier を表し、accept/reject list の order-insensitive `articleIdPair` key、dedicated review-state JSON、`update-state.json` mutation、public JSON / route / article card UI は維持する

## D-128: public `summary` は cautious redistribution のため短い excerpt に丸める

- 決定: `summary` は表示用の正規化済み文字列として保持しつつ、公開 JSON では短い excerpt に丸め、raw HTML 全文や長文再配信を避ける
- 理由: 読みやすさを保ちつつ、再配信面を保守的に保つため
- 影響: normalize pipeline は長い `description` / `content` を短い excerpt へ切り詰め、UI は excerpt 前提で表示する

## D-129: default polling cadence は 12 時間ごととする

- 決定: GitHub Actions の update workflow は既定で 12 時間ごとに起動する
- 理由: v1 の curated source 数と静的サイト運用では 3 時間ごとの polling は過剰であり、source への負荷を抑えたいから
- 影響: `.github/workflows/update-public-data.yml` と workflow test は `17 */12 * * *` を前提にする

## D-136: post-v1 source audit は docs-only → registry-only → QA sync の 3 段階で進める

- 決定: `FS-FEED-20` では documented source の evidence source と監査境界だけを docs に固定し、`FS-FEED-21` で初めて `data/feeds.json` の `enabled` / `shelfIds[]` / manual `tags[]` を見直す
- 理由: source policy の議論と runtime / route / public JSON 契約変更を同じ差分に混ぜると、何を根拠に default を変えたかが追跡しにくくなるため
- 影響: default `enabled=true` の根拠は source 自身の feed link、first-party help / docs、公式 announcement / news page を優先し、third-party feed directory や個人の紹介記事だけで cautious default を解除しない
- 影響: evidence が不足する source は削除ではなく `enabled=false` に留め、`FS-QA-12` で shelf coverage / cadence / public excerpt の regression をまとめて確認する

## D-130: sandbox verify と揃えるため Biome pin / lock / config は v2.4.7 へ更新する

- 決定: `FS-DX-05` では `@biomejs/biome` の pin と lockfile を v2.4.7 へ揃え、`biome.json` も v2 schema へ移行する
- 理由: diffship の sandbox verify が Biome v2.4.7 を用いる環境では、v1.9.4 schema / `files.ignore` / top-level `organizeImports` を残すと `just ci` が config deserialize error で先に落ちるため
- 影響: `package.json` / `pnpm-lock.yaml` / `biome.json` / `tests/typescript-tooling.test.ts` / DX docs は同時更新し、package pin と verify 前提のズレを残さない

## D-131: Biome v2 では hand-authored scope を `formatter.includes` / `linter.includes` と `javascript.assist.enabled=false` で維持する

- 決定: `FS-DX-05` の baseline config では、旧 `files.ignore` に依存せず `formatter.includes` / `linter.includes` で `biome.json` / `package.json` / `tsconfig*.json` / `data/**` / `src/**` / `scripts/**` / `tests/**` を明示し、`!scripts/**/*.js` / `!public/**` / `!.diffship/**` を除外する。加えて `javascript.assist.enabled=false` を使って unrelated import organize を避ける
- 理由: Biome v2 では `files.ignore` が使えず、旧 top-level `organizeImports` も互換でないため、baseline gate の対象範囲と rewrite 抑制を v2-compatible な方法で表現し直す必要があるため
- 影響: runtime 実装の無関係な整理を混ぜずに verify baseline だけを立て直せるようになり、後続の docs / pipeline / UI task を再び loop しやすくなる

## D-132: post-v1 incremental update は `lastBuildAt` 単独ではなく managed checkpoint + safety window で扱う

- 決定: `FS-PIPE-05` では更新判定を単一の build timestamp へ押し込まず、source ごとの checkpoint を正本にしつつ safety window を再評価する
- 理由: RSS / Atom では遅配信や publish 時刻揺れがあり、`lastBuildAt` だけに依存すると取りこぼしや重複回収の責務が曖昧になるため
- 影響: incremental 判定と canonical article dedupe の責務を分離したまま、内部 state 保存と update workflow test を拡張する必要がある

## D-133: GitHub Pages の pagination は build-time page shard ベースで実装する

- 決定: post-v1 の pagination は server-side paging を導入せず、build-time に生成した page shard と deterministic な page state で扱う
- 理由: FeedShelf は GitHub Pages 単一サイト構成を維持するため、runtime server 依存を増やさずに一覧の分割だけを追加したいから
- 影響: `articles.json` を canonical source of truth に残したまま、route bootstrap 向けの lighter payload や page state を build 時に生成する必要がある

## D-134: root / shelf / tags の主要導線は build-time prerender を優先する

- 決定: 初回表示の重さが目立つ root `/`、主要 shelf route `/<shelfId>/`、tag 導線 `/tags/` は post-v1 で build-time prerender の優先対象にする
- 理由: 全件 JSON fetch 待ちを減らし、GitHub Pages 上でも最初の発見体験を速くしたいから
- 影響: fixed route shell、first-view payload、checked-in HTML / asset verify の責務を `FS-PIPE-05` / `FS-QA-11` で同期する必要がある

## D-135: dense article grid は 4 / 3 / 2 / 1 列 + stable typography を正本にする

- 決定: post-v1 の一覧 card grid は wide 4 列、laptop 3 列、tablet 2 列、phone 1 列へ縮退させ、font-size は breakpoint ごとに安定した scale を使う
- 理由: 画面幅に応じて card 数を増やしても、タイトル・tag・source 行の読み順と可読性を崩したくないため
- 影響: `FS-UX-21` では CSS grid だけでなく line-clamp / wrap / compact meta row をまとめて調整し、web tests でも narrow viewport 崩れを確認する

