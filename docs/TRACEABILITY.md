# FeedShelf Traceability

| Spec ID | 要件 | 初期実装候補 | テスト/確認 |
|---|---|---|---|
| FS-001 | 新着一覧を表示できる | `public/index.html` / `src/web/app.ts` / `public/assets/app.js` | `tests/web-home.test.ts` でトップの view model / rendering が確認できる |
| FS-002 | カテゴリ別に絞り込める | `public/categories/index.html` / `src/web/app.ts` / `public/assets/app.js` | `tests/web-categories.test.ts` で `?id=<categoryId>` の絞り込みが確認できる |
| FS-003 | 媒体別に絞り込める | `public/sources/index.html` / `src/web/app.ts` / `public/assets/app.js` | `tests/web-sources.test.ts` で `?id=<sourceId>` の絞り込みが確認できる |
| FS-004 | 各記事から元記事へ遷移できる | `src/web/app.ts` / `public/assets/app.js` / 記事カードリンク | `tests/web-home.test.ts` で safe external URL handling が確認できる |
| FS-005 | RSS / Atom を共通形式へ正規化できる | `scripts/pipeline/normalizeFeed.ts` / `scripts/pipeline/normalizeFeed.js` | `tests/load-feeds.test.ts` で canonical article object への正規化が確認できる |
| FS-006 | 重複記事を抑制できる | `scripts/pipeline/dedupeArticles.ts` / `scripts/pipeline/dedupeArticles.js` | `tests/load-feeds.test.ts` で dedupe が確認できる |
| FS-007 | GitHub Actions で定期更新できる | `.github/workflows/update-public-data.yml` / `scripts/pipeline/update.ts` / `PLAN.md` | `tests/update-workflow.test.ts` で schedule / manual trigger / concurrency / quality gate / pipeline invocation / artifact upload の境界が確認できる |
| FS-008 | GitHub Pages で公開できる | `.github/workflows/update-public-data.yml` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `tests/update-workflow.test.ts` で `actions/deploy-pages@v4`、`needs: build-public-data`、`environment: github-pages`、`page_url` output が確認できる |
| FS-009 | 単一フィード失敗で全体を止めない | `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `scripts/pipeline/update.ts` | `tests/update-workflow.test.ts` で「一部失敗なら継続」「全件失敗なら build 失敗」が確認できる |
| FS-010 | 記事本文を保持しない | 設計方針 / UI | 本文表示を実装しない |
| FS-011 | 静的生成データの責務を分離できる | `scripts/pipeline/buildPublicExports.ts` / `public/data/*.json` | `tests/load-feeds.test.ts` で公開 JSON shape が確認できる |
| FS-012 | ルーティングが一覧中心で定義されている | `/` / `/categories/?id=<categoryId>` / `/sources/?id=<sourceId>` | `public/*.html` と `src/web/app.ts` の導線が仕様と一致する |
| FS-013 | 更新失敗時も前回成功データを破壊しない | `.github/workflows/update-public-data.yml` / `scripts/pipeline/update.ts` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `tests/update-workflow.test.ts` で全件失敗時に build が落ちて deploy が走らない publish 条件が確認できる |
| FS-014 | フィード定義を `data/feeds.json` に集約できる | `data/feeds.json` / `scripts/pipeline/loadFeeds.ts` / `scripts/pipeline/loadFeeds.js` | `tests/load-feeds.test.ts` で単一ファイルから全フィードを読める |
| FS-015 | フィード `id` を安定キーとして扱える | schema / validation | `id` が内部参照キーとして利用できる |
| FS-016 | フィード定義の必須項目が明示されている | docs / loader contract | 必須フィールド欠落時に検出できる |
| FS-017 | 記事正規化オブジェクトを共通中間表現として固定できる | `scripts/pipeline/normalizeFeed.ts` / `src/shared/contracts.ts` / docs | `tests/load-feeds.test.ts` で canonical article object の shape と責務が固定される |
| FS-018 | 公開日時が無い記事でも `fetchedAt` を持って保持できる | `scripts/pipeline/normalizeFeed.ts` | `tests/load-feeds.test.ts` で `publishedAt` 欠損時も `fetchedAt` を保持できる |
| FS-019 | optional 項目の欠損表現が安定している | schema / JSON contract | 単数値は `null`、配列は `[]` で揃う |
| FS-020 | 記事側だけで表示に必要な媒体メタデータを読める | `scripts/pipeline/normalizeFeed.ts` | `tests/load-feeds.test.ts` で feed 定義由来のメタデータ補完が確認できる |
| FS-021 | `summary` を表示用の正規化済み文字列として扱える | `scripts/pipeline/normalizeFeed.ts` | `tests/load-feeds.test.ts` で HTML 除去済み summary が確認できる |
| FS-022 | URL 正規化を安全な変形のみに限定できる | `scripts/pipeline/normalizeFeed.ts` | `tests/load-feeds.test.ts` で URL 正規化規則が確認できる |
| FS-023 | 記事 `id` を URL 優先の段階的 hash で安定生成できる | `scripts/pipeline/normalizeFeed.ts` | `tests/load-feeds.test.ts` で URL → source item → fallback の ID 生成が確認できる |
| FS-024 | dedupe を全 feed 横断で conservative に行える | `scripts/pipeline/dedupeArticles.ts` | `tests/load-feeds.test.ts` で `normalizedUrl` と `(feedId, sourceItemId)` による判定が確認できる |
| FS-025 | 重複記事を richest-wins で統合できる | `scripts/pipeline/dedupeArticles.ts` | `tests/load-feeds.test.ts` で richest-wins merge rule が確認できる |
| FS-026 | 同一記事が観測された feed 集合を `seenInFeeds[]` に保持できる | `scripts/pipeline/dedupeArticles.ts` | `tests/load-feeds.test.ts` で provenance-lite の保持が確認できる |
| FS-027 | `articles.json` の一覧用 shape と並び順を固定できる | `scripts/pipeline/buildPublicExports.ts` | `tests/load-feeds.test.ts` で一覧用 summary object 配列が確認できる |
| FS-028 | `categories.json` の shape を固定できる | `scripts/pipeline/buildPublicExports.ts` | `tests/load-feeds.test.ts` で `id/label/articleCount/latestSortAt` が確認できる |
| FS-029 | `sources.json` の shape を固定できる | `scripts/pipeline/buildPublicExports.ts` | `tests/load-feeds.test.ts` で source summary shape が確認できる |
| FS-030 | `meta.json` で生成時刻と件数を公開できる | `scripts/pipeline/buildPublicExports.ts` | `tests/load-feeds.test.ts` で `meta.json` の件数と生成時刻が確認できる |
| FS-031 | `categoryId` を安定 slug として扱える | `scripts/pipeline/buildPublicExports.ts` | `tests/load-feeds.test.ts` で slug 化と衝突時 build error が確認できる |
| FS-032 | Phase 2 の実行モデルを GitHub Actions-first で固定できる | workflow strategy / docs | 定期実行が標準であり公開向け CLI を必須にしないことが仕様で確認できる |
| FS-033 | 長期保持する取得 state を cache / artifact 非依存で保存できる | state storage strategy | 永続 state の正本が repository 管理下の保存先に置かれることが仕様で確認できる |
| FS-034 | 内部 pipeline entrypoint を Actions とローカル再現の両方から呼べる | `package.json` / `scripts/pipeline/run.ts` / `scripts/pipeline/run.js` / `justfile` | `runPipeline` から正規化・dedupe・public export まで同じ処理系を共有できる |
| FS-035 | 公開生成物と内部 state の責務を分離できる | public export / internal state design | `articles.json` 等を公開契約に限定し、内部履歴と混同しないことが確認できる |
| FS-036 | Phase 3 の UI 実装境界を static HTML / CSS / JS + `public/data` 読み取りに固定できる | `public/` 配下の静的 UI / docs | Phase 3 着手前に UI 境界が docs で確認できる |
| FS-037 | UI が 4 つの公開 JSON だけで一覧表示に必要な情報を取得できる | `public/data/articles/categories/sources/meta` consumer | 追加 dedupe や feed join が不要なことを仕様で確認できる |
| FS-038 | UI が loading / empty / error と nullable 項目欠損に耐えられる | `src/web/app.ts` / `public/assets/app.js` / `tests/web-home.test.ts` | `summary` / `publishedAt` / `imageUrl` 欠損時も表示が崩れない |
| FS-039 | AI handoff からローカル依存物・生成物・秘密情報を既定除外できる | `.diffshipignore` | `node_modules/` や `public/data/` が既定 handoff に入らない |
| FS-040 | カテゴリ一覧ルートで query parameter により対象カテゴリを選択できる | `public/categories/index.html` / `public/assets/app.js` / `tests/web-categories.test.ts` | `id` 未指定・未知カテゴリ・空カテゴリでも導線と案内が崩れない |
| FS-041 | 媒体一覧ルートで query parameter により対象媒体を選択できる | `public/sources/index.html` / `public/assets/app.js` / `tests/web-sources.test.ts` | `id` 未指定・未知媒体・空媒体でも導線と案内が崩れない |
| FS-042 | TypeScript 移行順序を docs で固定できる | `PLAN.md` / `docs/TYPESCRIPT_MIGRATION.md` | pipeline -> web UI -> tests/tooling の順が docs で確認できる |
| FS-043 | 公開 JSON 契約と pipeline 入出力を共有型の優先対象として定義できる | `docs/SPEC_V1.md` / `docs/TYPESCRIPT_MIGRATION.md` | `articles/categories/sources/meta` と canonical article object が型付けの先行対象として明示される |
| FS-044 | 初期導入の実行方式を `tsx` + `tsc --noEmit` で固定できる | `docs/DECISIONS.md` / `docs/TYPESCRIPT_MIGRATION.md` | build 出力必須ではない初期移行方針が docs で確認できる |
| FS-045 | TypeScript 由来の生成物を repo / handoff から既定除外できる | `.gitignore` / `.diffshipignore` | `dist/` と `*.tsbuildinfo` が ignore される |
| FS-046 | JS / TS 共存期でも pipeline と lint の実行入口を固定できる | `package.json` / `tsconfig.json` | `pipeline:run` と `lint` が `tsx` 起動になっている |
| FS-047 | 型検査を通常の品質ゲートに組み込める | `package.json` / `justfile` / `tests/typescript-tooling.test.ts` | `typecheck` script と `just ci` の導線が確認できる |
| FS-048 | pipeline 共有型を単一 TS module に集約できる | `src/shared/contracts.ts` / `scripts/pipeline/*.ts` | feed 定義・canonical article・公開 JSON shape が同じ型定義から参照できる |
| FS-049 | pipeline 本体を TS 化しても既存 entrypoint を維持できる | `scripts/pipeline/*.ts` / `scripts/pipeline/*.js` / `package.json` | JS wrapper 経由で既存 import / CLI surface を壊さずに TS 実装を呼べる |
| FS-050 | public Web UI ロジックを TS source へ移しても browser asset path を維持できる | `src/web/app.ts` / `public/assets/app.js` / `public/*.html` | HTML の `<script src>` を変えずに UI ロジックの source-of-truth を TS 化できる |
| FS-051 | Web UI 用の browser asset を dedicated TS emit config から再生成できる | `tsconfig.web.json` / `package.json` / `tests/typescript-tooling.test.ts` | `build:web-ui` と emit config が固定されている |
| FS-052 | tests / lint の品質ゲートを TS entrypoint ベースへ更新できる | `tests/*.test.ts` / `scripts/lint.ts` / `package.json` | `tsx` 前提の test / lint 導線が確認できる |
| FS-053 | checked-in browser asset が TS source と同期していることを verify できる | `scripts/verifyWebBuild.ts` / `tsconfig.web.json` / `public/assets/app.js` | 再生成結果と checked-in asset の一致が確認できる |
| FS-054 | TypeScript strict mode の初手を最小差分で有効化できる | `tsconfig.json` / `scripts/pipeline/normalizeFeed.ts` / `tests/*.ts` | `strict: true` が有効で、既存 TS 実装が暗黙 `any` や未ガード capture に依存しない |
| FS-055 | Phase 5 の audit / docs flow / acceptance verification の順序を docs で固定できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `FS-QA-01` / `FS-QA-02` / `FS-QA-03` の責務分割と完了条件が docs で確認できる |
| FS-056 | `FS-QA-01` の spec 実装差分監査結果を docs に記録できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `docs/TRACEABILITY.md` | 監査結果として「実装済み領域」「残る docs flow / acceptance gaps」「traceability 更新」が確認できる |
| FS-057 | repo 直下の README からセットアップ・ローカル確認・主要 docs へ到達できる | `README.md` / `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | README にセットアップ・確認手順・docs の読み順・Actions / Pages 前提が揃っていることを目視確認できる |
| FS-058 | v1 MVP の受け入れ判定を既存 quality gate と最小手動確認で行える | `PLAN.md` / `README.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `.github/workflows/update-public-data.yml` / `tests/*.test.ts` / `scripts/verifyWebBuild.ts` | `pnpm run ci`、`pnpm run pipeline:update`、`public/` の静的配信確認で受け入れ証跡を揃えられる |
| FS-059 | Biome を formatter / linter の baseline として段階導入できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `package.json` / `biome.json` / `pnpm-lock.yaml` / `tests/typescript-tooling.test.ts` | `FS-DX-01` では Biome dependency・config・baseline scripts・対象外パスが確認でき、full gate との統合は `FS-DX-02` へ受け渡せる |
| FS-060 | full quality gate を単一入口コマンドとして固定できる | `package.json` / `justfile` / `lefthook.yml` / `tests/typescript-tooling.test.ts` / `.github/workflows/*.yml` | `FS-DX-02` では `check:fast` と `pnpm run ci`、`just ci`、lefthook の契約が tests で確認でき、workflow からも `pnpm run ci` を呼べる |
| FS-061 | 定期更新 / deploy workflow と通常 CI workflow の責務を分離できる | `.github/workflows/update-public-data.yml` / `.github/workflows/ci.yml` / `docs/SPEC_V1.md` | `tests/ci-workflow.test.ts` と `tests/update-workflow.test.ts` で通常 CI と update / deploy の境界が確認できる |
| FS-062 | repo 固有 check を汎用 formatter / linter と分離して扱える | `scripts/lint.ts` / `package.json` / `docs/DECISIONS.md` / `tests/typescript-tooling.test.ts` | `FS-DX-02` では `check:fast` が `format:check` / `lint:biome` / repo 固有 `lint` を順に呼ぶことを tests で確認できる |
| FS-063 | pre-commit / CI failure 時に working tree を保持したまま diffship 修正ループへ渡せる | `README.md` / `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `tests/dx-docs-sync.test.ts` | `tests/dx-docs-sync.test.ts` で stash 前提にしない運用、`git rev-parse HEAD`、failure log、README からの導線が同期していることを確認できる |
| FS-064 | DX の docs / workflow / traceability 契約を継続的に同期できる | `README.md` / `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `docs/TRACEABILITY.md` / `.github/workflows/ci.yml` / `.github/workflows/update-public-data.yml` / `tests/dx-docs-sync.test.ts` | `tests/dx-docs-sync.test.ts` で routine CI と update / deploy の境界、`pnpm run ci` / `check:fast`、failure handling の docs 契約、Phase DX 完了状態が確認できる |
| FS-065 | `tsx` で直接起動する pipeline CLI が no-op にならず `main()` を実行できる | `scripts/pipeline/run.ts` / `scripts/pipeline/update.ts` / `tests/typescript-tooling.test.ts` / `docs/DECISIONS.md` | TS entrypoint 自身に direct-execution guard があり、script 契約と self-execution が tests で確認できる |
| FS-066 | FeedShelf を shelf-first な読み物棚として再定義できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | Phase 6 planning に「新着ダッシュボードではなく discovery-first な読み物棚」と明記されている |
| FS-067 | GitHub Pages 単一サイトの中で棚ページを root-level route として提供できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `PLAN.md` | `/<shelfId>/` と固定補助 route (`/tags/`, `/search/`, `/sources/`) の方針が docs で確認できる |
| FS-068 | 棚定義と source 定義を別 registry として管理できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `PLAN.md` | `data/shelves.yaml` と `data/feeds.json` の責務分離が docs で確認できる |
| FS-069 | source を複数棚へ所属させる契約を `shelfIds[]` として定義できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `category` ではなく配列の `shelfIds[]` を採る方針が docs で確認できる |
| FS-070 | source に手動タグを付与して discovery に活用できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `feeds.json.tags` が curator-managed tag として定義されている |
| FS-071 | RSS / Atom metadata 由来の記事タグを best-effort で扱える | `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `PLAN.md` | `entryTags` が optional / best-effort metadata として定義されている |
| FS-072 | ルート `/` を棚カタログとして再設計できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | ルートの主役が全体新着ではなく site intro + 棚カード一覧になることが docs で確認できる |
| FS-073 | `/<shelfId>/` を棚別の主要導線として設計できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | 棚ページの責務（概要・記事一覧・関連 tag / source 導線）が docs で確認できる |
| FS-074 | `/tags/` を tag discovery 導線として設計できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | tag list / tag detail の方針が docs で確認できる |
| FS-075 | `/search/` で title / sourceName / tags を対象に静的検索できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | build-time search index + client-side 検索の方針が docs で確認できる |
| FS-076 | tag / search / shelf を支える公開 JSON 契約を追加定義できる | `docs/SPEC_V1.md` / `PLAN.md` | `shelves.json` / `tags.json` / `search-index.json` の候補 shape と責務が docs で確認できる |
| FS-081 | `articles.json` を canonical public listing とし、tag / search は lightweight summary / index で補助できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | tag detail / search result が `articles.json` を正本にし、`tags.json` / `search-index.json` が補助契約として扱われることを docs で確認できる |
| FS-082 | root の棚カードを curator-managed な棚順で表示できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `shelves.yaml` 順を基本にした棚カード順、`articleCount` / `sourceCount` / `latestSortAt` / optional `sampleTags` が docs で確認できる |
| FS-083 | root で tag / search / source の導線優先度を整理できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | search / tags が補助 discovery 導線、sources / 全体新着がより下位の補助導線として定義されている |
| FS-077 | 有料APIや外部AIに依存せず Phase 6 を完了できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | 無料運用制約と非採用項目が docs で確認できる |
| FS-078 | 将来の contributor が source 追加・新棚追加・tag付与を docs から辿れる | `PLAN.md` / `docs/SPEC_V1.md` | Phase 6 に contribution rule と QA 観点を残すタスクが含まれている |
| FS-079 | contributor が棚追加・source追加・tag付与の編集先を迷わず判断できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `shelves.yaml` と `feeds.json` の owner boundary、禁止項目、`entryTags` の derived 扱いが docs で確認できる |
| FS-080 | GitHub Pages 単一サイト前提の route namespace と reserved ids を固定できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `/<shelfId>/`、固定補助 route、trailing slash、query parameter 方針、reserved ids が docs で確認できる |
| FS-084 | `/<shelfId>/` の first view で棚概要と注目記事を優先表示できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | 棚ページの情報階層が「概要 → 注目 → 新着 → source 導線」として docs で確認できる |
| FS-085 | 棚ページの注目記事を既存公開 JSON から導出できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `articles.json` / `shelves.json` を再利用し、注目専用 JSON や手動 curated list を初期必須にしないことが docs で確認できる |
| FS-086 | 棚ページの source 導線を補助セクションとして位置づけられる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | source 一覧が棚ページ下位の補助導線であり、棚概要・注目・新着を主役にする方針が docs で確認できる |
| FS-087 | 記事カードで title / visible tags / source の優先度を metadata より上に置ける | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | discovery-first な card hierarchy が docs で確認できる |
| FS-088 | visible tag chips を既存 `entryTags` / `sourceTags` から導出できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `cardTags` のような専用公開 field を追加せず、0〜3件程度の tag 表示を構成できることが docs で確認できる |
| FS-089 | 棚ページの記事カードで冗長な棚 / category 表示を減らし、summary 欠損時も読みやすさを保てる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | 棚ページでは current shelf / category の繰り返し表示を必須にせず、summary / image が optional でも card hierarchy が成立することを docs で確認できる |
| FS-098 | `/sources/` を source directory / profile として補助導線に位置づけられる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | source page が棚・tag・検索の補助 route であり、探索の開始地点ではないことを docs で確認できる |
| FS-099 | source detail から関連棚・tag・recent articles へ戻れる UI を設計できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `/sources/?id=...` が source identity 確認だけで終わらず、`shelfIds` / `tags` / recent articles を通じて再探索できることを docs で確認できる |
| FS-100 | source page を既存 `sources.json` / `articles.json` だけで構成できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | per-source detail JSON を増やさず、summary と article filter の再利用で `/sources/` を実装できることを docs で確認できる |
| FS-101 | Phase 6 の主要閲覧 surface を narrow viewport で 1 カラムへ安全に縮退できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | root / shelf / source / tag / search が横スクロール前提ではなく、mobile で縦積みへ崩せる方針が docs で確認できる |
| FS-102 | loading / empty / error を区別した status surface 契約を持てる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | empty と error の copy / 次アクションが分かれ、pipeline 未実行や fetch failure を誤認しない方針が docs で確認できる |
| FS-103 | long title / long tag を card hierarchy を壊さず吸収できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | wrap / clamp / visible tag 数制限などで card や chip list が横溢れしない方針が docs で確認できる |
| FS-104 | Phase 6 の docs task と implementation task を `PLAN` 上で分離できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | docs freeze 完了前は `*-10` 系実装へ進まないことが docs で確認できる |
| FS-105 | docs freeze 後の Phase 6 実装順を `UX -> TAG -> SEARCH -> FEED -> QA` として追跡できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `FS-UX-10` から `FS-QA-10` までの順序と責務が docs で確認できる |
| FS-106 | Phase 6 実装中の方向転換時に影響分析と docs 更新を先に行う運用を追跡できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` / `docs/TRACEABILITY.md` | affected task / docs / tests / public JSON 契約への影響確認が必要条件として docs で確認できる |
| FS-107 | tag label の見た目と安定 identity を分離して扱える | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | compare key と URL-safe `tagId` を使い、raw label や英字 slug 前提で一致判定しない方針が docs で確認できる |
| FS-108 | `/tags/?id=...` の detail を `tags.json` と `articles.json` の再利用だけで解決できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | per-tag detail export を増やさず、union filter と invalid / empty fallback を持つ tag page 契約が docs で確認できる |
| FS-109 | `entryTags` を feed metadata 限定の best-effort 抽出として扱える | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | AI 推測や手動 article override を使わず、category / tag metadata だけで `entryTags` を生成する前提が docs で確認できる |
| FS-110 | tag directory を件数・鮮度ベースで並べつつ shelf-first IA を保てる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `/tags/` が件数順と freshness を使う discovery 補助導線であり、棚より上位の primary IA ではないことが docs で確認できる |
| FS-111 | 検索 query と index matching を deterministic な正規化 + 空白区切り AND 条件で追跡できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | NFKC / trim / 空白縮約 / ASCII-Latin case 差吸収と multi-term AND 条件が search 契約として docs で確認できる |
| FS-112 | 検索順位を `title > sourceName > tags > freshness` として追跡できる | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | title relevance を主軸とし、source / tags を補助 signal、同点時は freshness で解決する search ranking が docs で確認できる |
| FS-113 | `/search/` の empty / no-result state を article dump にせず helper state として扱える | `PLAN.md` / `docs/SPEC_V1.md` / `docs/DECISIONS.md` | `q` 未指定時は検索ヒントと fallback CTA を出し、0件時も page を壊さない search UI 契約が docs で確認できる |
| FS-114 | `search-index.json` を field-separated な lightweight candidate index として再利用できる | `docs/SPEC_V1.md` / `docs/DECISIONS.md` | search index が field 別比較文字列と `articleId` / `sortAt` だけを持ち、card payload は `articles.json` で解決することが docs で確認できる |
