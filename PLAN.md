# PLAN

## 目的

FeedShelf の v1 を、仕様先行・最小差分・GitHub Pages 前提で安全に実装する。

## 前提

- 記事本文は保持しない
- 記事閲覧は外部遷移とする
- オフライン対応は v1 の対象外
- 入力は公開 RSS / Atom のみとする
- 配信は GitHub Pages、更新は GitHub Actions を前提とする

## 進め方

- まず仕様と計画を固める
- 次にデータ契約と取得フローを実装する
- その後に UI と更新基盤を最小構成で追加する
- 各ステップはできるだけ 1 タスク = 1 コミットで進める

## フェーズ

### Phase 0: 仕様基盤

- [x] `FS-SPEC-01` spec docs を作成する
- [x] `FS-SPEC-02` decisions / traceability を拡張する
- [x] `FS-SPEC-03` 実装計画 `PLAN.md` を追加する

### Phase 1: データ契約の具体化

- [x] `FS-DATA-01` フィード定義ファイルの置き場とスキーマを決める
- [x] `FS-DATA-02` 記事正規化オブジェクトの最終形を決める
- [x] `FS-DATA-03` URL 正規化と dedupe ルールを具体化する
- [x] `FS-DATA-04` 生成物 JSON の分割単位を決める

完了条件:
- 実装時に迷わないレベルで `data/` と JSON 生成物の契約が決まっている


### Deferred: v2 以降で再検討するデータ契約

- [x] `FS-DATA-05` provenance を `seenInFeeds[]` より豊かに表現する（first implementation 完了。public provenance export 境界は `FS-DOCS-26` で固定）
- [x] `FS-DATA-06` host 固有の canonical URL 解決と redirect 解決を追加する
- [x] `FS-DATA-07` fuzzy dedupe を安全な閾値つきで導入する（first implementation 完了。stricter observability / rollback は別 docs task）
- `FS-DATA-08` の JSON sharding / pagination は post-v1 の `FS-ARCH-10` / `FS-PIPE-05` / `FS-QA-11` で static pagination + build-time page shard として実施済みとみなし、deferred backlog から外す

完了条件:
- v1 で見送った provenance / canonicalization / dedupe の拡張点が、後続タスクとして見失われない
- 既に post-v1 で実装済みの pagination / page shard を deferred backlog に二重計上しない

### Phase 2: 取得・生成パイプライン

- [x] `FS-PIPE-00` Phase 2 の実行・保存・公開戦略を具体化する
- [x] `FS-PIPE-01` GitHub Actions から呼べるフィード取得入口を追加する
- [x] `FS-PIPE-02` RSS / Atom の正規化処理を追加する
- [x] `FS-PIPE-03` 重複排除処理を追加する
- [x] `FS-PIPE-04` 一覧表示用 JSON を生成できるようにする

完了条件:
- GitHub Actions 前提で、取得から JSON 生成までの実行入口と責務分離が確定している
- 同じ処理系をローカルでも再現できる

### Phase 3: Web UI 最小実装

- [x] `FS-WEB-00` Phase 3 の実装方針と handoff 除外方針を固定する
- [x] `FS-WEB-01` トップ / 新着一覧ページを作る
- [x] `FS-WEB-02` カテゴリ別一覧ページを作る
- [x] `FS-WEB-03` 媒体別一覧ページを作る
- [x] `FS-WEB-04` 記事カードから外部遷移できるようにする

完了条件:
- Phase 3 着手前に、UI が `public/data/*.json` を読む static HTML / CSS / JS として進むことが docs 上で固定されている
- 新着 / カテゴリ / 媒体の 3 導線で記事を閲覧できる
- loading / empty / error の最低限表示方針が定義されている

### Phase TS: Type-safe migration

- [x] `FS-TS-00` TypeScript 移行方針を docs に固定する
- [x] `FS-TS-01` TypeScript 実行基盤と型検査を導入する
- [x] `FS-TS-02` pipeline のデータ契約と主要処理を TS 化する
- [x] `FS-TS-03` public web UI ロジックを TS 化する
- [x] `FS-TS-04` tests / lint / verify フローを TS 前提に更新する
- [x] `FS-TS-05` strictness を段階的に引き上げる

完了条件:
- TypeScript 化の順番・責務・共存期間が docs で固定されている
- 実装タスクが pipeline / web UI / tests / tooling の単位で追跡できる
- 将来 `dist/` や `*.tsbuildinfo` が生じても repo / handoff 方針が定義されている

### Phase 4: 更新・公開基盤

- [x] `FS-OPS-00` Phase 4 の workflow / deploy / failure handling 境界を docs に固定する
- [x] `FS-OPS-01` GitHub Actions の定期更新 workflow を追加する
- [x] `FS-OPS-02` GitHub Pages 公開フローを追加する
- [x] `FS-OPS-03` 単一フィード失敗時の継続方針を実装へ反映する

完了条件:
- Phase 4 着手前に、update / deploy / failure handling の責務分割と実装順が docs で固定されている
- 定期更新と公開が GitHub 上で自動化されている

### Phase 5: MVP 仕上げ

- [x] `FS-QA-00` Phase 5 の監査・導線・受け入れ確認の境界を docs に固定する
- [x] `FS-QA-01` 仕様と実装の差分を確認する
- [x] `FS-QA-02` README / docs の導線を整える
- [x] `FS-QA-03` MVP 受け入れ条件を満たすか確認する

完了条件:
- Phase 5 着手前に、spec 実装差分監査 / README・docs 導線整理 / MVP 受け入れ確認の責務分割と実装順が docs で固定されている
- `docs/SPEC_V1.md` の MVP / 受け入れ条件を満たしている

### Phase DX: Tooling / CI hardening

- [x] `FS-DX-00` Biome / CI 導入方針と failure handling を docs に固定する
- [x] `FS-DX-01` Biome を baseline formatter / linter として導入する
- [x] `FS-DX-02` quality gate の単一入口と hook 役割を整合させる
- [x] `FS-DX-03` 通常 CI workflow を追加する
- [x] `FS-DX-04` tests / docs / workflow 追跡を同期する
- [x] `FS-DX-05` Biome を v2.4.7 互換へ更新し、sandbox verify baseline を整合させる

完了条件:
- Biome / repo 固有 check / hook / GitHub Actions の責務分割が docs で固定されている
- `pnpm run ci` を full gate の単一入口として実装できる計画になっている
- pre-commit failure 時の diffship 運用が stash 前提ではなく、working tree 保持 + exact HEAD / failure log 受け渡しで定義されている


### Phase 6: Shelf-first UI/UX / tags / search 拡張

このフェーズでは、ここまでで成立している「新着・カテゴリ・媒体の静的RSSリーダー」を、
「興味を惹かれる記事を見つけやすい読み物棚」へ拡張する。

Phase 6 の進め方:
- まず docs task を最後まで完了させ、仕様・意思決定・traceability を閉じる
- docs task が完了するまでは、Phase 6 の runtime / UI / pipeline 実装へ着手しない
- 実装は docs freeze 後に `*-10` 系タスクとして順番に行う
- 実装中に方向転換が必要になった場合は、先に affected task / docs / tests / public JSON 契約への影響を分析し、必要なら docs task を挟んでから実装へ戻る

前提:
- GitHub Pages 単一サイト構成は維持する
- GitHub Actions による静的生成を前提にする
- ログイン、サーバー常駐、外部DB、有料API、外部AI、外部検索基盤は導入しない
- 既存の `/sources/` は補助導線として活かしてよいが、体験の主軸は `/` と `/<shelfId>/` へ移す
- 既存の「カテゴリ」は shelf-first な情報設計へ置き換える。互換導線を残すかどうかは Phase 6 で改めて決める

#### 6-0. Phase 6 実行ルール

- [x] `FS-PHASE6-00` Phase 6 の docs freeze / implementation split / change-management rule を docs に固定する
- [x] `FS-PHASE6-01` Phase 6 docs の最終同期を行い、public JSON / acceptance / section structure の不整合を解消する

完了条件:
- Phase 6 の docs task と implementation task が `PLAN` 上で明確に分離されている
- docs task 完了前は実装へ入らない運用が明記されている
- 実装中の方向転換時に、影響分析 → docs更新 → 実装再開の順で進めるルールが残っている
- Phase 6 の primary public JSON と acceptance の説明が `SPEC` 全体で矛盾なく同期している

#### 6-A. 情報設計 / データ契約

- [x] `FS-IA-00` Phase 6 の docs-first planning を行い、読み物棚寄りの体験・無料運用制約・作業順序を docs に固定する
- [x] `FS-IA-01` `data/shelves.yaml` と `data/feeds.json` の責務分離を仕様化する
- [x] `FS-IA-02` shelf route policy、reserved ids、GitHub Pages 単一サイト前提の URL 設計を固定する
- [x] `FS-IA-03` Phase 6 の公開 JSON / search index / tag summary の契約を定義する

完了条件:
- 棚 (`shelf`)・source・tag・search の責務分割が docs 上で迷いなく説明できる
- `shelves.yaml` / `feeds.json` / canonical article object / public JSON / lightweight search-index の関係が追跡できる
- route policy と reserved ids が固定され、後続実装で path を場当たり的に増やさなくてよい

#### 6-B. Shelf-first UI / UX

- [x] `FS-UX-00` ルート `/` を「棚カタログページ」として再設計する
- [x] `FS-UX-01` `/<shelfId>/` 棚ページの構成（概要・注目・新着・source導線）を設計する
- [x] `FS-UX-02` 記事カードの見た目を discovery-first に見直し、タイトル・タグ・source・余白を再設計する
- [x] `FS-UX-03` `sources` 導線を主役から補助導線へ位置づけ直し、棚・タグ・検索と矛盾しない UI にする
- [x] `FS-UX-04` モバイル表示、loading / empty / error、long tag / long title の崩れを改善する

完了条件:
- `/` だけで「どの棚があるか」「どんな雰囲気か」が把握できる
- `/<shelfId>/` から記事探索が成立し、source 一覧は補助導線として機能する
- discovery-first な UI 改善がモバイルでも破綻しない

#### 6-C. Tag

- [x] `FS-TAG-00` `sourceTags` と `entryTags` の責務、由来、UI での扱いを docs に固定する
- [x] `FS-TAG-01` `/tags/` とタグ別一覧導線の route / data contract / UX を定義する
- [x] `FS-TAG-02` RSS / Atom metadata からの `entryTags` 抽出を best-effort 方針で実装計画化する

完了条件:
- feed に対する手動タグと、記事 metadata 由来タグの違いが docs で明確になっている
- tag list / tag detail の route、`tagId` / `label` / sorting / fallback の挙動が固定されている
- `entryTags` が欠ける feed でも UI / search / tag pages が成立する前提が定義されている
- per-tag export を増やさず `tags.json` + `articles.json` の再利用で実装へ進める状態になっている

#### 6-D. Search

- [x] `FS-SEARCH-00` 無料・静的運用前提の検索仕様を docs に固定する
- [x] `FS-SEARCH-01` title / sourceName / sourceTags / entryTags を対象にする build-time search index 契約を定義する
- [x] `FS-SEARCH-02` クライアント側検索 UI の route / query parameter / scoring の最小仕様を決める

完了条件:
- 検索機能が paid API / external service / AI なしで成立することが docs で追跡できる
- 検索対象フィールドと score の優先順位が明文化されている
- `/search/` 導線と tag / shelf / source からの流入が矛盾しない

#### 6-E. Feed expansion / contributor flow

- [x] `FS-FEED-00` 棚追加・source追加・tag付与の contribution rule を docs に固定する
- [x] `FS-FEED-01` 初回に用意する shelf 群と curated source 選定方針を決める
- [x] `FS-FEED-02` 新棚 / 新source 追加時の QA 観点（重複・UI 崩れ・検索対象・tag summary）を定義する

完了条件:
- 将来この議論を忘れても、新しい contributor が「どこを編集すれば棚が増えるか」を docs から辿れる
- source 追加と shelf 追加が別操作として理解できる
- feed 拡張時の QA 観点が UI / search / tags まで含めて残っている

#### 6-F. V1 extension acceptance

- [x] `FS-QA-05` Shelf-first 拡張込みの V1 受け入れ条件を更新する
- [x] `FS-QA-06` 既存 MVP との互換導線、データ移行、docs / traceability / tests の同期方針を整理する

完了条件:
- 「旧MVPは完了済みだが、最終的な FeedShelf v1 完了判定は shelf-first 拡張込みで行う」という状態が docs で明確になっている
- `/categories/` と旧 deep link を即時破壊せず、compatibility route / helper state / CTA の扱いが docs で追跡できる
- `articles/shelves/sources/tags/search-index/meta` を正本とする移行方針と、tests / docs / traceability の同期責務が docs で辿れる

#### 6-G. Implementation backlog（docs freeze 後に着手）

- [x] `FS-UX-10` shelf-first route shell と root / shelf / source bridge の主要 UI を実装する
- [x] `FS-TAG-10` `sourceTags` / `entryTags` / `tags.json` を使った tag list / tag detail / article card tag 表示を実装する
- [x] `FS-SEARCH-10` build-time search index と `/search/` の client-side 検索 UI を実装する
- [x] `FS-FEED-10` `data/shelves.yaml` / `data/feeds.json` / public JSON 生成を Phase 6 契約へ更新する
- [x] `FS-QA-10` Phase 6 拡張の tests / docs / acceptance / migration verification を実装へ反映する

完了条件:
- docs task で固定した Phase 6 契約が runtime / pipeline / public JSON / tests に反映されている
- 実装タスクの順番が shelf-first UI の骨格 → tag / search → input / export 更新 → acceptance で追跡できる
- 仕様変更が必要になった場合に docs task を挟んでから実装へ戻る運用が守られている

### Post-v1 visual refresh

- [x] `FS-UX-20` static shell / generated shelf route / article card の visual refresh を行う

完了条件:
- `articles / shelves / sources / tags / search-index / meta` などの public JSON 契約を変えずに、root / fixed route / generated shelf route を同一トーンで刷新できる
- CSS と軽量 markup 更新のみで、棚-first 導線・compatibility route・generated shelf route の責務を崩さない

### Post-v1 architecture / performance

- [x] `FS-ARCH-10` incremental update / static pagination / build-time prerender / responsive grid の仕様を docs に固定する
- [x] `FS-PIPE-05` managed incremental update state と build-time page shard / prerender export を実装する
- [x] `FS-UX-21` responsive grid と typography stabilization を実装する
- [x] `FS-QA-11` incremental build / pagination / prerender / responsive grid の acceptance / tests / checked-in asset sync の残り実装へ反映する

完了条件:
- 「毎回全件を再取得して同形 export を更新する」運用ではなく、managed checkpoint + safety window を前提にした post-v1 更新戦略が docs で固定されている
- GitHub Pages 前提で root / shelf / tags の主要導線を build-time prerender し、server-side paging を使わずにページ分割できる方針が docs で固定されている
- 記事一覧の dense layout が narrow viewport でも 4 / 3 / 2 / 1 列へ安全に縮退し、font-size / line-clamp / tag wrap の扱いが docs で固定されている

### Post-v1 curated source audit

- [x] `FS-FEED-20` documented source 優先の監査手順と evidence 境界を docs に固定する
- [x] `FS-FEED-21` `data/feeds.json` の cautious default 監査を registry-only 差分で反映する
- [x] `FS-QA-12` source 精査後の shelf coverage / cautious default / update cadence の回帰確認を docs・tests・README に同期する

完了条件:
- post-v1 の source 精査が `data/feeds.json` の enable / disable / `shelfIds[]` / manual `tags[]` 調整を主軸とする task であることが `PLAN` 上で追跡できる
- route / public JSON / search / tag の契約変更と source registry 精査が別タスクとして分離されている
- documented source 優先、12時間 cadence、短い public excerpt という cautious default を次の監査 task でも崩さないことが確認できる

### Post-v1 documented community topic audit

- [x] `FS-FEED-22` first-party docs がある Reddit topic feed を registry-only 差分で cautious default に取り込む
- [x] `FS-QA-13` Reddit topic audit 後の broad feed 境界・棚 coverage・README / tests / traceability を同期する

完了条件:
- Reddit の official RSS wiki のような first-party docs を根拠に、profile-aligned な subreddit feed を `enabled=true` に切り替えられる
- broad feed (`r/programming`) や science 棚を重くしすぎる source は引き続き `enabled=false` に保ち、source audit の温度感を崩さない
- source registry の変更が README / `PLAN` / `DECISIONS` / `TRACEABILITY` / registry test に反映され、evidence の追跡が 1 箇所だけ古い状態にならない

### Post-v1 backlog consistency cleanup

- [x] `FS-DOCS-20` deferred data backlog と post-v1 architecture / pagination 実績の整合を取り、`FS-DATA-08` の状態を docs で同期する

完了条件:
- `FS-DATA-08` が deferred backlog 上では未完了に見える一方、post-v1 architecture では page shard / static pagination が実装済み、という二重状態を `PLAN` / `SPEC_V1` / `DECISIONS` / `TRACEABILITY` で解消できる
- 今後の deferred backlog は richer provenance / canonicalization / fuzzy dedupe に絞られ、pagination を再実装する前提で誤って扱わない

### Post-v1 deferred data backlog prioritization

- [x] `FS-DOCS-21` deferred data backlog (`FS-DATA-05` 〜 `FS-DATA-07`) の再開順を docs で固定し、次の候補を canonicalization-first に揃える

完了条件:
- `FS-DATA-05` / `FS-DATA-06` / `FS-DATA-07` のうち、public JSON 契約を崩さずに再開しやすい次タスクが docs で一意に読める
- `FS-DATA-06` を先行候補、`FS-DATA-05` をその後の schema 拡張候補、`FS-DATA-07` を最後の高リスク候補として扱う順番が `PLAN` / `SPEC_V1` / `DECISIONS` / `TRACEABILITY` で同期している

### Post-v1 canonicalization docs split

- [x] `FS-DOCS-22` `FS-DATA-06` の docs / implementation split を切り、host 固有 canonicalization / redirect resolution の境界を固定する

完了条件:
- `FS-DATA-06` の implementation が、既存 `normalizeUrl()` の safe canonicalization の上に積む build-time best-effort precision layer であることを docs で追跡できる
- allowlisted host rule、bounded redirect resolution、timeout / redirect loop / fetch failure 時の fallback、非目標（generic query の一律除去拡大・本文 fetch / HTML canonical parse・route / public JSON shape 変更）を docs で固定してから実装へ進める
- docs split により implementation-only の後続差分へ安全に渡せる境界を固定し、その後 `FS-DATA-06` 実装でこの境界を消費できる

### Post-v1 canonicalization implementation

- [x] `FS-DATA-06` allowlisted host rule と bounded redirect resolution を pipeline に追加し、safe canonicalization を fallback として維持する

完了条件:
- allowlisted host rule により `b.hatena.ne.jp/entry/...` のような redirector 形式を deterministic に記事 URL へ寄せられる
- bounded redirect resolution は allowlisted host rewrite 後の candidate にだけ適用し、redirect loop / timeout / fetch failure 時は既存 `normalizeUrl()` ベースの safe canonicalization へ戻る
- `runPipeline` / `runUpdatePipeline` のどちらでも precision layer が public JSON shape を変えずに効き、影響が article `url` / `id` / dedupe winner に留まることを tests で追跡できる

### Post-v1 richer provenance docs split

- [x] `FS-DOCS-23` `FS-DATA-05` の docs / implementation split を切り、`seenInFeeds[]` との共存方針・feed ごとの観測 evidence・public JSON 境界を固定する

完了条件:
- `FS-DATA-05` の first implementation が public JSON shape / route 構造を変えず、internal canonical article object と managed update state に閉じた schema 拡張として着手できることを docs で追跡できる
- `seenInFeeds[]` は削除せず derived compatibility summary として残し、post-v1 の richer provenance は `feedId` ごとに 1 件の bounded entry を持つ `provenance[]` として先に固定する
- 各 provenance entry が少なくとも `feedId` / `firstSeenAt` / `lastSeenAt` / `sourceItemId` / `matchedBy` を持ち、timestamp の min/max merge・`sourceItemId` の non-null 優先・`matchedBy=primary|normalizedUrl|feedItem` の境界を docs で固定してから実装へ進める

### Post-v1 richer provenance implementation

- [x] `FS-DATA-05` internal `provenance[]` を canonical article object / managed update state に追加し、`seenInFeeds[]` を derived compatibility summary として併存させる

完了条件:
- `normalizeFeedDocument()` が feed ごとの primary provenance entry（`feedId` / `firstSeenAt` / `lastSeenAt` / `sourceItemId` / `matchedBy=primary`）を canonical article object に付与し、`seenInFeeds[]` をそこから導出できる
- `dedupeArticles()` が `normalizedUrl` / `feedItem` の merge 理由を provenance entry に反映し、feed ごとに 1 件の bounded entry を保ったまま `firstSeenAt` / `lastSeenAt` / `sourceItemId` を統合できる
- `buildNextUpdateState()` が dedupe winner の `feedId` だけでなく `provenance[]` に含まれる各 `feedId` を checkpoint 対象にし、cross-feed dedupe 後も source ごとの managed checkpoint を前進させられる

### Post-v1 fuzzy dedupe docs split

- [x] `FS-DOCS-24` `FS-DATA-07` の docs / implementation split を切り、same-source fallback・title compare key・publishedAt 72h window・rollback 境界を固定する

完了条件:
- `FS-DATA-07` の first implementation が public JSON shape / route 構造 / checked-in HTML shell を変えず、`dedupeArticles()` 内の exact dedupe miss fallback と tests に閉じた最小差分として着手できる
- fuzzy dedupe は `normalizedUrl` / `(feedId, sourceItemId)` の exact match が無かった article にだけ適用し、candidate は少なくとも `sourceName` / `language` / `titleCompareKey` が一致し、両方の `publishedAt` が存在して 72 時間以内である場合に限定する
- fuzzy merge の根拠は internal provenance / update state で `matchedBy=fuzzyTitleDate` として追跡できるようにしつつ、body fetch・HTML 類似度・embedding / LLM・cross-source clustering・manual review UI はこの task に含めない

### Post-v1 fuzzy dedupe implementation

- [x] `FS-DATA-07` exact dedupe miss 後の same-source/title/date fallback を `dedupeArticles()` に追加し、internal `matchedBy=fuzzyTitleDate` を update state まで通す

完了条件:
- `dedupeArticles()` が exact dedupe（`normalizedUrl` / `(feedId, sourceItemId)`）で一致しなかった article にだけ fuzzy fallback を適用し、same `sourceName` / `language` / `titleCompareKey` かつ `publishedAt` 差が 72 時間以内の candidate だけを merge 対象にできる
- fuzzy merge 後も public JSON shape / route 構造 / checked-in HTML shell は変えず、既存 winner 選択・field merge・`seenInFeeds[]` derived compatibility summary を維持したまま、incoming provenance を `matchedBy=fuzzyTitleDate` へ retag して internal state に残せる
- `loadUpdateState()` / `buildNextUpdateState()` が `matchedBy=fuzzyTitleDate` を落とさず扱え、問題時は fuzzy fallback を外して full rebuild すれば rollback できる

### Post-v1 deferred data backlog close-out

- [x] `FS-DOCS-25` deferred data backlog（`FS-DATA-05` 〜 `FS-DATA-07`）の first implementation 完了状態と、今後の docs-first extension 境界を同期する

完了条件:
- Deferred 一覧と各詳細セクションの両方で、`FS-DATA-05` / `FS-DATA-06` / `FS-DATA-07` の first implementation が完了済みであることを矛盾なく読める
- deferred data backlog を再度「未着手タスク」として扱わず、今後の拡張は public provenance surfacing・canonicalization の追加 precision rule・fuzzy dedupe の stricter observability / rollback を別 docs-first task として扱うことが `PLAN` / `SPEC_V1` / `DECISIONS` / `TRACEABILITY` で同期している
- close-out task 自体は docs / traceability / alignment test に閉じ、public JSON・route・pipeline 実装は変えない

### Post-v1 public provenance export docs split

- [x] `FS-DOCS-26` internal `provenance[]` から public provenance summary を切り出す docs split を行い、`articles.json` / page shard へ載せる最小 field・non-goals・audit UI 分離を固定する

完了条件:
- `FS-DATA-09` の first implementation が `PublicArticleSummary` 系に optional `alsoSeenInSourceIds: string[]` を追加する public JSON contract change であり、値は internal `provenance[]` から導出して primary `sourceId` を除いた stable order の source id 配列に限定することを docs で追跡できる
- public へは `firstSeenAt` / `lastSeenAt` / `sourceItemId` / `matchedBy` / confidence score を露出せず、`seenInFeeds[]` の除去や provenance audit UI も同じ task に含めないことが `PLAN` / `SPEC_V1` / `DECISIONS` / `TRACEABILITY` で同期している
- docs split 自体は docs / traceability / alignment test に閉じ、`PublicArticleSummary` / build pipeline / UI 実装は次の implementation task に送る

### Post-v1 public provenance export implementation

- [x] `FS-DATA-09` `PublicArticleSummary` 系へ optional `alsoSeenInSourceIds` を追加し、internal `provenance[]` から secondary source id を export する

完了条件:
- `buildPublicExports()` が `CanonicalArticle.provenance[]` から primary `sourceId` を除いた `alsoSeenInSourceIds` を stable order で導出し、`articles.json` / page shard / bootstrap payload の `PublicArticleSummary` 再利用経路へそのまま流せる
- `runUpdatePipeline` の retained public article merge でも `alsoSeenInSourceIds` を失わず、fresh article 側に新しい secondary source id があれば union したまま保持できる
- public へは引き続き `firstSeenAt` / `lastSeenAt` / `sourceItemId` / `matchedBy` / confidence score を露出せず、UI 表示・audit surface・`seenInFeeds[]` 除去は別 task に送る

### Post-v1 public provenance chip docs split

- [x] `FS-DOCS-27` public provenance の最初の UI surfacing を article card 上の bounded secondary-source chip に限定し、label 解決・表示上限・non-goals を docs に固定する
- [x] `FS-UX-22` `alsoSeenInSourceIds` を shared article card 上の bounded secondary-source chip として surfacing する

完了条件:
- `FS-UX-22` の first implementation が shared article card 上の補助表示に閉じ、`alsoSeenInSourceIds` を既存 `sources.json` / source registry で解決した secondary source label chip だけを表示対象にすることを docs と実装で追跡できる
- first implementation は最大 2 件までの secondary source label と `+N` overflow に限定し、unknown source id は黙って無視して new route / filter / query param / manual review surface を追加しない
- `src/web/app.ts` / checked-in `public/assets/app.js` / `public/assets/styles.css` / web tests が同期し、home と nested page の両方で source page href を崩さず secondary-source chip を表示できる

### Post-v1 fuzzy dedupe observability docs split

- [x] `FS-DOCS-28` fuzzy dedupe extension の次差分を internal summary count と明示的 disable switch に限定し、public export / UI / broader matching 拡張と分離する

完了条件:
- `PipelineSummary` / `UpdatePipelineSummary` に internal-only `fuzzyDuplicatesCollapsed` を追加できる境界と、`--disable-fuzzy-dedupe` による pre-publish diagnosis / rollback path を docs で追跡できる
- この task は public JSON / route / checked-in HTML shell / article card UI を変えず、aggregate log / summary までに限定する
- 既存 `matchedBy=fuzzyTitleDate` を読む update state 互換は維持しつつ、過去 publish 済み merge を完全に戻すには retained public data / update state を持ち越さない full rebuild が必要であることを docs で明示できる

### Post-v1 fuzzy dedupe observability implementation

- [x] `FS-DATA-10` `fuzzyDuplicatesCollapsed` summary と `--disable-fuzzy-dedupe` kill switch を pipeline / update 実装へ追加する

完了条件:
- `PipelineSummary` / `UpdatePipelineSummary` が internal-only `fuzzyDuplicatesCollapsed` を返し、aggregate logger も同じ count までに閉じた出力を行う
- `parseArgs()` / `parseUpdateArgs()` が `--disable-fuzzy-dedupe` を受け付け、`runPipeline()` / `runUpdatePipeline()` が exact dedupe を維持したまま fuzzy merge だけを無効化できる
- `dedupeArticlesWithSummary()` のような internal helper と tests により、fuzzy collapse count の集計と kill switch の効き方を run / update の両方で確認できる

### Post-v1 canonicalization deterministic rule-table docs split

- [x] `FS-DOCS-29` canonicalization の次差分を deterministic allowlisted rewrite/query rule table に限定し、network I/O 拡大・generic rule 化・public contract 変更と分離する

完了条件:
- 既存 `FS-DATA-06` の redirect-aware precision layer の上に、repo 内の allowlisted host / path pattern / query key に対する deterministic rewrite rule だけを追加できる境界が docs で追跡できる
- 新しい rule は `scripts/pipeline/normalizeFeed.ts` と tests に閉じ、追加 network fetch・bounded redirect follow の適用対象拡大・public JSON / route / checked-in HTML shell の変更を同じ task に含めない
- generic query parameter の一律除去拡大、HTML canonical parse、本文 fetch、`data/feeds.json` への manual canonical override、runtime-configurable rule download を非目標として明示できる

### Post-v1 canonicalization deterministic rule-table implementation

- [x] `FS-DATA-11` deterministic allowlisted rule table の first implementation として、Reddit presentation alias rewrite と comment-thread query cleanup を `normalizeFeed.ts` に追加する

完了条件:
- `normalizeUrlWithPrecision()` が既存の Hatena rewrite + bounded redirect follow を維持したまま、追加 fetch なしで `old.reddit.com` / `new.reddit.com` を `www.reddit.com` へ寄せ、comment thread URL の `context` / `depth` / `sort` / `share_id` / `rdt` を除去できる
- deterministic rule table は redirect follow の対象を増やさず、`scripts/pipeline/normalizeFeed.ts` と tests に閉じる
- `applyCanonicalUrlPrecisionLayer()` と `runPipeline()` 経由でも cleaned URL と再計算された article id を確認できる

### Post-v1 fuzzy dedupe audit docs split

- [x] `FS-DOCS-30` fuzzy dedupe の次差分を opt-in の internal audit export に限定し、default logger / public JSON / UI / broader matching から分離する

完了条件:
- `FS-DATA-12` の first implementation が、fuzzy merge ごとの bounded evidence を明示的 opt-in 出力へ書き出す internal-only task として着手できる
- audit record には `winnerArticleId` / `incomingArticleId` / `winnerFeedId` / `incomingFeedId` / `titleCompareKey` / `publishedAtDeltaHours` / `matchedBy` のような bounded field だけを含め、raw summary / body / public JSON export を混ぜない
- audit export は `run.ts` / `update.ts` の明示的 flag を通したときだけ有効になり、default logger・checked-in output・route・article card UI・broader fuzzy rule は同じ task に含めない

### Post-v1 fuzzy dedupe audit implementation

- [x] `FS-DATA-12` `--fuzzy-audit-file` による opt-in internal JSON audit export を `dedupeArticles()` / `run.ts` / `update.ts` / tests に閉じて実装する

完了条件:
- `dedupeArticlesWithSummary()` が fuzzy merge ごとの bounded audit record を internal result として返し、record は `winnerArticleId` / `incomingArticleId` / `winnerFeedId` / `incomingFeedId` / `titleCompareKey` / `publishedAtDeltaHours` / `matchedBy` に限定される
- `parseArgs()` / `parseUpdateArgs()` が `--fuzzy-audit-file <path>` を受け付け、flag 指定時のみ `runPipeline()` / `runUpdatePipeline()` が JSON audit file を書き出す
- flag 未指定時の default logger / checked-in public JSON / route / article card UI は無変更のままとし、tests で run / update の opt-in export を確認できる

### Post-v1 fuzzy dedupe manual-review handoff docs split

- [x] `FS-DOCS-31` fuzzy dedupe の次差分を internal manual-review handoff artifact に限定し、broader matching / override persistence / public UI から分離する

完了条件:
- `FS-DATA-13` の first implementation が、既存の opt-in fuzzy audit evidence を人手確認しやすい internal handoff artifact へ整形する task として着手できる
- handoff artifact に追加してよい field は `winnerTitle` / `incomingTitle` / `winnerUrl` / `incomingUrl` / `winnerSourceName` / `incomingSourceName` のような human-readable な bounded evidence に限定し、default logger・checked-in output・public JSON export は変更しない
- accept/reject の永続化、`update-state.json` への manual override 記録、broader fuzzy heuristic、cross-source fuzzy、public confidence score、manual review UI route は同じ task に含めない

### Post-v1 fuzzy dedupe manual-review handoff implementation

- [x] `FS-DATA-13` `--fuzzy-handoff-file` による opt-in internal manual-review handoff JSON export を `dedupeArticles()` / `run.ts` / `update.ts` / tests に閉じて実装する

完了条件:
- `dedupeArticlesWithSummary()` が既存の fuzzy audit evidence に `winnerTitle` / `incomingTitle` / `winnerUrl` / `incomingUrl` / `winnerSourceName` / `incomingSourceName` を足した bounded handoff record を internal result として返す
- `parseArgs()` / `parseUpdateArgs()` が `--fuzzy-handoff-file <path>` を受け付け、flag 指定時のみ `runPipeline()` / `runUpdatePipeline()` が human-readable な JSON handoff file を書き出す
- flag 未指定時の default logger / checked-in public JSON / route / article card UI は無変更のままとし、accept/reject persistence や manual review UI は同じ task に含めない

### Post-v1 fuzzy dedupe false-positive reject docs split

- [x] `FS-DOCS-32` fuzzy dedupe の次差分を explicit false-positive reject list に限定し、accept persistence / broader matching / manual review UI / retroactive unmerge と分離する

完了条件:
- `FS-DATA-14` の first implementation が、既存の `--fuzzy-handoff-file` artifact を人手確認したあとに、operator-authored な reject list を明示的 flag 経由で読み込み、future run の fuzzy merge を抑止する internal-only task として着手できる
- reject entry は order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` を中心にした bounded key に限定し、必要なら human-readable な `winnerTitle` / `incomingTitle` / `note` を添えてよいが、raw body・retained public article payload・broad pattern rule は含めない
- reject list は current run / update で新しく遭遇した candidate の merge を止めるためだけに使い、既に publish 済みの merge を後から自動で split しない。`update-state.json` への自動書き戻し、checked-in artifact、public JSON、manual review UI route は同じ task に含めない

### Post-v1 fuzzy dedupe false-positive reject implementation

- [x] `FS-DATA-14` `--fuzzy-reject-file` による explicit false-positive reject list 読み込みを `dedupeArticles()` / `run.ts` / `update.ts` / tests に閉じて実装する

完了条件:
- `parseArgs()` / `parseUpdateArgs()` が `--fuzzy-reject-file <path>` を受け付け、flag 指定時のみ `runPipeline()` / `runUpdatePipeline()` が operator-authored な JSON reject list を読み込んで future run の `matchedBy='fuzzyTitleDate'` fuzzy merge だけを suppress する
- reject entry は order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` を必須 key にした bounded shape に限定し、必要なら `winnerTitle` / `incomingTitle` / `note` のような human-readable echo field を無視せず通してよい
- reject list は current run / update で新しく遭遇した candidate の merge 抑止にだけ使い、`update-state.json` 自動書き戻し / checked-in artifact / public JSON / route / article card UI / retroactive unmerge / broader matching は同じ task に含めない

### Post-v1 fuzzy dedupe rebuild-only retroactive unmerge docs sync

- [x] `FS-DOCS-33` known false positive を既存 `--fuzzy-reject-file` と clean full rebuild の組み合わせで split し直す運用境界を docs に固定し、新しい state machine / CLI / UI と分離する

完了条件:
- 既に publish 済みの false positive merge を戻したい場合は、retained public data / `update-state.json` を持ち越さない clean full rebuild に既存 `--fuzzy-reject-file` を併用する operator-run workflow で扱うことが docs で読める
- retroactive unmerge は new checked-in artifact / 自動 state 書き戻し / accept persistence / broader matching / manual review UI route を増やさず、既存 runtime semantics と矛盾しない
- current run の reject suppression (`FS-DATA-14`) と rebuild-only recovery path の責務分離が `PLAN` / `SPEC_V1` / `DECISIONS` / `TRACEABILITY` / alignment test で同期している

### Post-v1 fuzzy dedupe accept persistence docs split

- [x] `FS-DOCS-34` fuzzy dedupe の次差分を explicit accept list に限定し、broader matching / reject 自動生成 / manual review UI / state writeback と分離する

完了条件:
- `FS-DATA-15` の first implementation が、既存 `--fuzzy-handoff-file` artifact を人手確認したあとに、operator-authored な accept list を明示的 flag 経由で読み込み、review 済み true positive pair の再確認 churn を減らす internal-only task として着手できる
- accept entry は order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` を中心にした bounded key に限定し、必要なら `winnerTitle` / `incomingTitle` / `note` のような human-readable echo field を添えてよい
- accept list は既存 heuristic に一致した candidate だけを pre-reviewed として扱い、non-candidate を force merge したり `update-state.json` へ自動書き戻ししたりしない。reject list と競合する場合は reject を優先し、checked-in artifact / public JSON / manual review UI route / broader matching は同じ task に含めない

### Post-v1 fuzzy dedupe accept persistence implementation

- [x] `FS-DATA-15` `--fuzzy-accept-file` による explicit accept list 読み込みを `dedupeArticles()` / `run.ts` / `update.ts` / tests に閉じて実装する

完了条件:
- `parseArgs()` / `parseUpdateArgs()` が `--fuzzy-accept-file <path>` を受け付け、flag 指定時のみ `runPipeline()` / `runUpdatePipeline()` が operator-authored な JSON accept list を読み込んで review 済み true positive pair の repeat fuzzy audit / handoff 再掲を抑止する
- accept entry は order-insensitive な `articleIdPair` と `matchedBy='fuzzyTitleDate'` を必須 key にした bounded shape に限定し、必要なら `winnerTitle` / `incomingTitle` / `note` のような human-readable echo field を無視せず通してよい
- accept list は既存 heuristic に一致した candidate の fuzzy merge 自体は維持したまま artifact 再掲抑止にだけ使い、non-candidate の force merge / exact dedupe precedence の上書き / `update-state.json` 自動書き戻し / checked-in artifact / 自動 accept 生成 / retroactive unmerge / broader fuzzy matching / manual review UI route は同じ task に含めない
- accept list と reject list が競合する場合は reject を優先する

## 直近の次タスク

- post-v1 curated source audit は、official evidence がある Zenn / Reddit の profile-aligned topic feed を cautious default の範囲で有効化し、broad community feed / hard-science source は引き続き `enabled=false` に保つところまで完了した
- `FS-FEED-20` で固定した evidence source（site 自身の feed link、first-party help / docs、公式 announcement / news page）以外を根拠に新しい community source や topic feed を default 有効化したい場合は、まず docs を更新して監査境界を広げてから registry を触る
- update cadence は過剰取得を避けるため 12 時間ごとを既定とし、再配信面では raw HTML 全文ではなく短い public excerpt だけを保持する
- lint / formatter の縮退判断は UI refresh や feed expansion と切り離した別タスクとして扱い、quality gate 変更の影響を独立に見る
- Phase 6 implementation backlog は完了済みとして維持し、棚 route / tag / search / compatibility verification の evidence を docs・tests・README で崩さない
- 新しい仕様変更が必要になった場合は、affected task / docs / tests / public JSON 契約への影響を先に分析し、必要なら docs task を挟んでから実装へ戻る
- `FS-DATA-06` は `b.hatena.ne.jp/entry/...` の allowlisted host rewrite と、その candidate にだけ適用する bounded redirect resolution として実装済みになったため、deferred backlog の次候補は `FS-DATA-05` へ移る
- `FS-DATA-05` の first implementation は完了し、canonical article object と `update-state.json` に internal `provenance[]` が入り、`seenInFeeds[]` は compatibility summary として残る構成になった
- `buildNextUpdateState()` は dedupe winner の `feedId` だけではなく `provenance[]` の各 `feedId` を checkpoint 対象にするため、cross-feed dedupe 後でも source ごとの managed checkpoint を前進させられる
- `FS-DOCS-26` で public provenance export の境界を先に固定し、`FS-DATA-09` では `PublicArticleSummary` 系へ optional `alsoSeenInSourceIds` を載せる export-only の最小差分を実装済みにできる
- `FS-DATA-09` の export は `CanonicalArticle.provenance[]` から secondary source id だけを public JSON へ流し、`runUpdatePipeline` の retained public article merge でも `alsoSeenInSourceIds` を失わない
- `FS-DOCS-27` で public provenance の最初の UI surfacing は shared article card 上の bounded secondary-source chip に限定し、label 解決・表示上限・unknown source fallback・non-goals を docs で先に固定した
- `FS-UX-22` で `alsoSeenInSourceIds` を shared article card の secondary-source chip へ変換し、最大 2 件 + `+N` overflow、unknown source id 無視、home / nested page ごとの source href 解決を実装済みにした
- `FS-DATA-07` の first implementation も完了し、exact dedupe miss 後の same-source/title/date fallback と `matchedBy=fuzzyTitleDate` の internal tracking が pipeline / update state まで入った
- `FS-DOCS-29` で canonicalization extension の次差分は deterministic allowlisted rule table に限定し、`FS-DATA-11` では `normalizeFeed.ts` と tests に閉じた non-network 差分として first implementation を完了した
- `FS-DATA-11` は既存の bounded redirect follow を広げず、Reddit の presentation alias（`old/new.reddit.com` → `www.reddit.com`）と comment-thread query cleanup（`context` / `depth` / `sort` / `share_id` / `rdt`）だけを deterministic rule table に追加した
- deferred data backlog（`FS-DATA-05` 〜 `FS-DATA-07`）は first implementation まで完了し、public provenance export は `FS-DOCS-26` で export-only 境界を固定したため、今後の拡張は bounded article-card chip・追加 canonicalization rule・stricter rollback / observability・explicit fuzzy audit export は `FS-DATA-12` で opt-in internal JSON audit として first implementation まで完了し、その先は manual-review handoff や broader matching を別 docs-first task で扱う
- `FS-DOCS-28` で固定した fuzzy dedupe observability 境界に沿って、`FS-DATA-10` では `PipelineSummary` / `UpdatePipelineSummary` の internal `fuzzyDuplicatesCollapsed`、aggregate logger、`--disable-fuzzy-dedupe` kill switch を `run` / `update` / tests に閉じて実装済みにした
- `FS-DATA-12` では `--fuzzy-audit-file` 経由の opt-in internal JSON audit export を `run` / `update` / tests に閉じて実装し、fuzzy merge ごとの bounded evidence を public JSON や default logger に広げず確認できるようにした
- `FS-DOCS-31` では次の fuzzy 拡張を internal manual-review handoff artifact に限定し、人が読むための title / URL / source name を opt-in artifact にだけ足す境界を先に固定した
- `FS-DATA-13` では `--fuzzy-handoff-file` 経由の opt-in internal JSON handoff export を `run` / `update` / tests に閉じて実装し、既存 audit record に human-readable な title / URL / source name を足した bounded evidence を人手確認向け artifact として出力できるようにした
- `FS-DOCS-32` では次の fuzzy 拡張を explicit false-positive reject list に限定し、既知の誤マージを future run で止める最小 control を handoff artifact の次段として docs で先に固定した
- `FS-DATA-14` では `--fuzzy-reject-file` 経由の explicit false-positive reject list を `run` / `update` / tests に閉じて実装し、operator-authored な order-insensitive `articleIdPair` key に一致する `matchedBy='fuzzyTitleDate'` candidate だけを future run で suppress できるようにした
- `FS-DOCS-33` では retroactive unmerge を新しい runtime feature ではなく、retained public data / `update-state.json` を持ち越さない clean full rebuild と既存 `--fuzzy-reject-file` を組み合わせる operator-run workflow として固定した
- `FS-DOCS-34` では review 済み true positive pair の再確認 churn を減らす次差分を explicit accept list に限定し、non-candidate force merge / reject 自動生成 / `update-state.json` 書き戻し / manual review UI / broader matching から分離した
- `FS-DATA-15` では `--fuzzy-accept-file` 経由の explicit accept list を `run` / `update` / tests に閉じて実装し、review 済み true positive pair の fuzzy merge は維持したまま repeat fuzzy audit / handoff の再掲だけを suppress できるようにした
- 次に runtime を広げるなら broader matching / manual review UI / state writeback のどれか 1 つだけを docs-first task として切り出す

## メモ

- まずは docs と実装のズレを増やさないことを優先する
- 仕様変更が入ったら `SPEC_V1` / `DECISIONS` / `TRACEABILITY` / `PLAN` のどこを更新するかを明確にする
- 本文取得やオフライン対応は v1 完了後の別フェーズで検討する
- Phase 6 では「新着を速く追う」より「興味を惹かれる記事へ出会いやすい」ことを優先し、shelf-first な IA へ段階移行する
- `FS-UX-00` では、root `/` の主役を全体新着ではなく「site intro + 棚カード一覧」に固定し、検索 / tags を補助 discovery 導線、sources をさらに下位の補助導線として扱う
- root の棚カード順は `data/shelves.yaml` の棚順を基本とし、count / freshness / optional `sampleTags` で棚の雰囲気を伝える
- `FS-UX-01` では、棚ページ `/<shelfId>/` の情報階層を「概要 → 注目 → 新着 → source 導線」とし、注目は既存 `articles.json` から軽量導出して、source 一覧は補助セクションへ下げる
- `FS-UX-02` では、記事カードを title → tags → source の discovery-first な優先度で再定義し、visible tag は `entryTags` 優先 + `sourceTags` 補完で軽量導出する。棚ページでは current shelf / category の繰り返し表示を必須にしない
- `FS-UX-03` では、`/sources/` を source directory / profile として補助導線へ寄せ、root では compact な source CTA に留め、source detail から関連棚・tag・recent articles へ戻れる構成を前提にする
- `FS-UX-04` では、narrow viewport の 1 カラム縮退、loading / empty / error の status surface、long title / long tag の wrap / clamp 方針を固定し、実装着手前に edge case を docs で閉じる
- 6-C Tag docs sweep では、`sourceTags` と `entryTags` の責務分離、`tagId` / `label` / compare key、`/tags/` の一覧・detail・fallback、`entryTags` best-effort 抽出の境界をまとめて固定し、Tag 実装が `tags.json` + `articles.json` の再利用だけで開始できる状態にした
- 6-D Search docs sweep では、`/search/` の helper state / no-result state、deterministic な query 正規化、field-separated `search-index.json`、`title > sourceName > tags > freshness` の ranking をまとめて固定し、Search 実装が `search-index.json` + `articles.json` の再利用だけで開始できる状態にした
- 6-E Feed docs sweep では、`shelves.yaml` と `feeds.json` の編集境界、初期棚セット (`it` / `ai` / `science`)、curated source 選定基準、feed 拡張時の QA 観点をまとめて固定し、将来の contributor が registry 変更だけで安全に棚・source を増やせる状態にした
- post-v1 の curated source 拡張では、NASA や hard-science 一次ソースは必要時まで `enabled=false` に留め、`science` は GIGAZINE と Python 系 documented source を中心に軽めの棚として維持してよい
- 6-F acceptance docs sweep では、旧MVP acceptance を baseline としつつ、最終的な v1 完了判定を shelf-first 拡張込みへ更新した。`/categories/` は compatibility route として扱い、`categories.json` は必要なら互換 export に留め、Phase 6 の primary public JSON は `articles/shelves/sources/tags/search-index/meta` を正本にする
- `FS-PHASE6-00` では、Phase 6 を「docs task を先に全部完了させ、その後に `*-10` 系の implementation task へ進む」運用として固定する
- `FS-PHASE6-01` では、実装前の最終点検として primary public JSON の列挙、旧MVP acceptance と最終 v1 acceptance の関係、章構造の整合を同期した
- Phase 6 の最初のコード実装は docs freeze 完了後の `FS-UX-10` とし、まず route shell / root・shelf・source bridge の UI 骨格を最小差分で置き換える方針とする
- 実装中に方向性変更が必要になった場合は、その場で実装を押し切らず、affected task / SPEC / DECISIONS / TRACEABILITY / tests / public JSON 契約への影響を確認してから docs task を挟む
- GitHub Pages は単一サイト構成を維持し、棚ページは `/<shelfId>/`、タグ導線は固定 route (`/tags/`, `/search/`) で提供する前提とする
- `data/shelves.yaml` は site / shelf の導入文と棚 taxonomy だけを持ち、`data/feeds.json` は source 定義・取得設定・`shelfIds[]`・手動 `tags[]` を持つ。custom path は v1 では持たない
- `shelves.yaml` に `feedUrl` / `siteUrl` / `enabled` / source tag を持たせず、`feeds.json` に棚説明・site intro・route override を持たせない
- canonical な内部 route は trailing slash 付きの directory route (`/`, `/<shelfId>/`, `/tags/`, `/search/`, `/sources/`, 互換用 `/categories/`) とし、detail state は固定ページ上の query parameter で表現する
- reserved ids は少なくとも `tags`, `search`, `sources`, `categories`, `assets`, `data`, `index` を固定し、shelf 追加時に衝突させない
- root-level の自由な custom path や per-tag / per-source / per-article の追加 route は v1 では導入せず、URL 空間の拡張は docs 更新を前提に行う
- `shelfIds` は常に配列とし、source が複数棚へ属してよいことを正式仕様候補とする
- source の `tags` は curator-managed な手動タグ、`entryTags` は RSS / Atom metadata から best-effort で抽出する記事タグとして分離し、input registry には手動 `entryTags` を持たない
- 検索は title / sourceName / sourceTags / entryTags を対象にした build-time index + client-side 実装を前提にし、有料APIや外部AIへ依存しない
- 将来の contributor が source 追加 / 新棚追加 / tag付与を docs だけで辿れるよう、Phase 6 では contribution rule と QA 観点も同時に残す
- Phase 2 は GitHub Actions / GitHub Pages 前提で進め、公開向け CLI 契約は持たない
- FS-WEB-01 ではトップ `/` を先に成立させ、カテゴリ/媒体の専用一覧は後続タスクで追加する
- FS-WEB-02 では `/categories/?id=<categoryId>` でカテゴリ別一覧を切り替える
- FS-WEB-03 では `/sources/?id=<sourceId>` で媒体別一覧を切り替える
- FS-WEB-04 では元記事リンクを `http/https` のみに制限し、無効 URL は非活性表示にフォールバックする
- 永続 state は Actions cache や artifact ではなく、管理された実データとして保持する
- FS-TS-00 では docs-first で移行順序と実装境界を固定し、実装は後続タスクで段階投入する
- FS-TS-01 では `tsconfig.json` / `tsx` / `tsc --noEmit` を導入し、既存 JS entrypoint を壊さず型検査ゲートを追加する
- FS-TS-02 では `src/shared/contracts.ts` に pipeline / public data の共有型を集約し、`scripts/pipeline/*.ts` を追加した
- FS-TS-02 では既存 import surface と entrypoint を壊さないため、`scripts/pipeline/*.js` は互換 wrapper として一時的に残す
- FS-TS-03 では Web UI の source-of-truth を `src/web/app.ts` に移し、browser が読む `public/assets/app.js` は互換 asset path のまま維持する
- FS-TS-03 では `tsconfig.web.json` と `build:web-ui` を追加し、HTML の `<script src>` を変えずに UI asset を再生成できるようにした
- FS-TS-04 では tests / lint を `.ts` entrypoint に寄せ、`verify:web-ui` で `src/web/app.ts` と `public/assets/app.js` の同期を検証する
- FS-TS-05 では `strict: true` を有効化し、`DOM.Iterable` と最小限の型注釈追加で既存 TS 実装を strict mode に適合させた
- FS-OPS-01 では `.github/workflows/update-public-data.yml` を追加し、schedule / manual trigger / push(main) trigger / concurrency / quality gate / `pipeline:update` / Pages artifact upload を先に固定した
- FS-OPS-02 では同 workflow に `deploy-github-pages` job を追加し、`needs: build-public-data` / `environment: github-pages` / `actions/deploy-pages@v4` による公開境界を固定した
- FS-OPS-03 では `scripts/pipeline/update.ts` に partial failure policy を追加し、enabled feed のうち 1 件以上の publishable source が残れば公開を継続し、fetch failure / source-level validation failure を個別に skip しつつ、全件 failure なら build を失敗させて deploy を skip する
- FS-QA-00 では Phase 5 を docs-first で開始し、spec 実装差分監査 / README・docs 導線整理 / MVP 受け入れ確認の 3 タスクへ責務分割する
- FS-QA-01 では MVP 中核機能の実装と主要 quality gate は揃っていると整理し、残課題を README / docs 導線整理と受け入れ証跡の明文化へ絞った
- FS-QA-02 では `README.md` を repo 直下の入口として追加し、セットアップ / ローカル確認 / Actions・Pages 前提 / docs の読み順を 1 箇所へ集約した
- FS-QA-03 では既存 quality gate と最小手動確認を受け入れ証跡として整理し、MVP 完了判定を docs 上で明文化した
- FS-DX-00 では Biome / CI を docs-first で開始し、formatter/linter の担当範囲、repo 固有 check の扱い、hook / CI の責務分離を先に固定する
- FS-DX-00 では `pnpm run ci` を full gate の単一入口候補として定義し、verify failure を避けるため `package.json` に最小の `ci` script を補完した。hook / workflow / repo 固有 check の統合は `FS-DX-02` で扱う
- FS-DX-00 では pre-commit / CI failure 時に原則 stash せず、working tree を保持したまま exact HEAD と failure log を diffship 修正ループへ渡す運用を採る
- FS-DX-01 では `@biomejs/biome` と `biome.json` を追加し、`format` / `format:check` / `lint:biome` の baseline コマンドを導入した。既存の `lint` は repo 固有 check のまま維持し、`pnpm run ci` / `just ci` / hook への本格統合は `FS-DX-02` で扱う
- FS-DX-02 では `check:fast` を `format:check` / `lint:biome` / repo 固有 `lint` の束として追加し、`pnpm run ci` を `check:fast + typecheck + test + verify:web-ui` の単一入口へ揃えた
- FS-DX-02 では `just ci` を `pnpm run ci` の薄いラッパーに変更した
- `FS-DX-03` では lefthook の pre-commit を廃止し、pre-push の full gate と diffship `ops.post_apply` を揃えて loop と通常開発の verify 入口を一致させる
- FS-DX-02 では Biome format 導入に伴う既存 TS / JSON / config の整形差分と `public/assets/app.js` の再生成を含め、initial lint gate では `useOptionalChain` / `useArrowFunction` / `useLiteralKeys` / `noGlobalEval` を `off` にして unrelated refactor を避けた
- FS-DX-03 では `.github/workflows/ci.yml` を追加し、`push` / `pull_request` ごとの routine quality gate を `pnpm run ci` で実行する通常 CI workflow を update / deploy workflow から分離した
- FS-DX-04 では README に failure handling の入口を追加し、`tests/typescript-tooling.test.ts` で quality gate / workflow 分離 / diffship 修正ループ運用の docs 追跡を実行可能な形で固定した
- FS-DX-05 では Biome を sandbox verify の CLI と揃う v2.4.7 へ引き上げ、`biome.json` を v2 schema / `formatter.includes` / `linter.includes` / `javascript.assist.enabled=false` ベースへ移行し、`just ci` 自体は従来どおり薄いラッパーに保ったまま、lockfile / docs / tests / checked-in asset を一括同期して Biome v2 が拾う lint 取りこぼしも同時に解消した
- FS-UX-10 では `/` の shelf catalog 化に加えて、`/<shelfId>/` の route shell と `/sources/` から棚 route へ戻る bridge までを checked-in asset / pipeline 生成へ反映した
- Phase 6 実装後の維持では、pipeline export が managed な `/<shelfId>/` route shell を再生成し、棚削除・rename 後に stale route を残さないことも evidence に含める
- Phase 6 実装後の維持では、generated な shelf route shell に埋め込む `title` / `description` を plain text として扱い、HTML special chars を escape して Pages 上の route shell を壊さないことも evidence に含める
- Phase 6 実装後の維持では、`feeds.json.shelfIds[]` が `shelves.yaml` に存在する棚だけを参照していること、各 source の `shelfIds[]` 内で同じ棚を重複させないこと、source `id` が registry 内で重複していないこと、`feedUrl` / `siteUrl` が absolute な `http/https` URL であること、manual `tags` が省略または配列であること、manual `tags[]` の各要素が非空文字列であること、manual `tags[]` が compare key 上で重複していないことを pipeline / loader が fail-fast で検証し、rename / delete 後の orphaned export、冗長な棚属先、source identity 衝突、壊れた source URL、tag field shape mismatch、空 manual tag、tag label 揺れによる冗長 tag summary を出さないことも evidence に含める
