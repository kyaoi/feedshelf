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

- [ ] `FS-DATA-05` provenance を `seenInFeeds[]` より豊かに表現する
- [ ] `FS-DATA-06` host 固有の canonical URL 解決と redirect 解決を追加する
- [ ] `FS-DATA-07` fuzzy dedupe を安全な閾値つきで導入する
- [ ] `FS-DATA-08` JSON sharding / pagination / search index を検討する

完了条件:
- v1 で見送った dedupe / canonicalization / provenance の拡張点が、後続タスクとして見失われない

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

完了条件:
- Phase 6 の docs task と implementation task が `PLAN` 上で明確に分離されている
- docs task 完了前は実装へ入らない運用が明記されている
- 実装中の方向転換時に、影響分析 → docs更新 → 実装再開の順で進めるルールが残っている

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

- [ ] `FS-FEED-00` 棚追加・source追加・tag付与の contribution rule を docs に固定する
- [ ] `FS-FEED-01` 初回に用意する shelf 群と curated source 選定方針を決める
- [ ] `FS-FEED-02` 新棚 / 新source 追加時の QA 観点（重複・UI 崩れ・検索対象・tag summary）を定義する

完了条件:
- 将来この議論を忘れても、新しい contributor が「どこを編集すれば棚が増えるか」を docs から辿れる
- source 追加と shelf 追加が別操作として理解できる
- feed 拡張時の QA 観点が UI / search / tags まで含めて残っている

#### 6-F. V1 extension acceptance

- [ ] `FS-QA-05` Shelf-first 拡張込みの V1 受け入れ条件を更新する
- [ ] `FS-QA-06` 既存 MVP との互換導線、データ移行、docs / traceability / tests の同期方針を整理する

完了条件:
- 「旧MVPは完了済みだが、V1 は shelf-first 拡張込みで完了判定する」という状態が docs で明確になっている
- Phase 6 の各タスクが acceptance にどう繋がるかを traceability で辿れる

#### 6-G. Implementation backlog（docs freeze 後に着手）

- [ ] `FS-UX-10` shelf-first route shell と root / shelf / source bridge の主要 UI を実装する
- [ ] `FS-TAG-10` `sourceTags` / `entryTags` / `tags.json` を使った tag list / tag detail / article card tag 表示を実装する
- [ ] `FS-SEARCH-10` build-time search index と `/search/` の client-side 検索 UI を実装する
- [ ] `FS-FEED-10` `data/shelves.yaml` / `data/feeds.json` / public JSON 生成を Phase 6 契約へ更新する
- [ ] `FS-QA-10` Phase 6 拡張の tests / docs / acceptance / migration verification を実装へ反映する

完了条件:
- docs task で固定した Phase 6 契約が runtime / pipeline / public JSON / tests に反映されている
- 実装タスクの順番が shelf-first UI の骨格 → tag / search → input / export 更新 → acceptance で追跡できる
- 仕様変更が必要になった場合に docs task を挟んでから実装へ戻る運用が守られている

## 直近の次タスク

- 6-E Feed expansion / contributor flow docs sweep として、`FS-FEED-00` / `FS-FEED-01` / `FS-FEED-02` をまとめて閉じる
- Phase 6 docs task がすべて閉じるまでは `FS-UX-10` 以降の実装タスクへ進まない

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
- `FS-PHASE6-00` では、Phase 6 を「docs task を先に全部完了させ、その後に `*-10` 系の implementation task へ進む」運用として固定する
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
- FS-OPS-01 では `.github/workflows/update-public-data.yml` を追加し、schedule / manual trigger / concurrency / quality gate / `pipeline:update` / Pages artifact upload を先に固定した
- FS-OPS-02 では同 workflow に `deploy-github-pages` job を追加し、`needs: build-public-data` / `environment: github-pages` / `actions/deploy-pages@v4` による公開境界を固定した
- FS-OPS-03 では `scripts/pipeline/update.ts` に partial failure policy を追加し、enabled feed のうち 1 件以上取得成功なら公開を継続し、全件失敗なら build を失敗させて deploy を skip する
- FS-QA-00 では Phase 5 を docs-first で開始し、spec 実装差分監査 / README・docs 導線整理 / MVP 受け入れ確認の 3 タスクへ責務分割する
- FS-QA-01 では MVP 中核機能の実装と主要 quality gate は揃っていると整理し、残課題を README / docs 導線整理と受け入れ証跡の明文化へ絞った
- FS-QA-02 では `README.md` を repo 直下の入口として追加し、セットアップ / ローカル確認 / Actions・Pages 前提 / docs の読み順を 1 箇所へ集約した
- FS-QA-03 では既存 quality gate と最小手動確認を受け入れ証跡として整理し、MVP 完了判定を docs 上で明文化した
- FS-DX-00 では Biome / CI を docs-first で開始し、formatter/linter の担当範囲、repo 固有 check の扱い、hook / CI の責務分離を先に固定する
- FS-DX-00 では `pnpm run ci` を full gate の単一入口候補として定義し、verify failure を避けるため `package.json` に最小の `ci` script を補完した。hook / workflow / repo 固有 check の統合は `FS-DX-02` で扱う
- FS-DX-00 では pre-commit / CI failure 時に原則 stash せず、working tree を保持したまま exact HEAD と failure log を diffship 修正ループへ渡す運用を採る
- FS-DX-01 では `@biomejs/biome` と `biome.json` を追加し、`format` / `format:check` / `lint:biome` の baseline コマンドを導入した。既存の `lint` は repo 固有 check のまま維持し、`pnpm run ci` / `just ci` / hook への本格統合は `FS-DX-02` で扱う
- FS-DX-02 では `check:fast` を `format:check` / `lint:biome` / repo 固有 `lint` の束として追加し、`pnpm run ci` を `check:fast + typecheck + test + verify:web-ui` の単一入口へ揃えた
- FS-DX-02 では `just ci` を `pnpm run ci` の薄いラッパーに変更し、lefthook は pre-commit=`just check-fast`、pre-push=`just ci` の責務分割へ更新した
- FS-DX-02 では Biome format 導入に伴う既存 TS / JSON / config の整形差分と `public/assets/app.js` の再生成を含め、initial lint gate では `useOptionalChain` / `useArrowFunction` / `useLiteralKeys` / `noGlobalEval` を `off` にして unrelated refactor を避けた
- FS-DX-03 では `.github/workflows/ci.yml` を追加し、`push` / `pull_request` ごとの routine quality gate を `pnpm run ci` で実行する通常 CI workflow を update / deploy workflow から分離した
- FS-DX-04 では README に failure handling の入口を追加し、`tests/dx-docs-sync.test.ts` で quality gate / workflow 分離 / diffship 修正ループ運用の docs 追跡を実行可能な形で固定した
