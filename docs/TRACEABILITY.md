# FeedShelf Traceability

| Spec ID | 要件 | 初期実装候補 | テスト/確認 |
|---|---|---|---|
| FS-001 | 新着一覧を表示できる | `public/index.html` / `public/assets/app.js` / 記事カード | トップで新着順表示できる |
| FS-002 | カテゴリ別に絞り込める | `public/categories/index.html` / `public/assets/app.js` | `?id=<categoryId>` で指定カテゴリのみ表示される |
| FS-003 | 媒体別に絞り込める | 媒体一覧ページ | 指定媒体のみ表示される |
| FS-004 | 各記事から元記事へ遷移できる | 記事カードリンク / safe external URL handling | `http/https` のみ外部URLへ遷移し、unsafe URL は非活性表示へ落ちる |
| FS-005 | RSS / Atom を共通形式へ正規化できる | `scripts/pipeline/normalizeFeed.js` | RSS / Atom fixture が canonical article object へ変換される |
| FS-006 | 重複記事を抑制できる | `scripts/pipeline/dedupeArticles.js` | 同一記事の多重表示を抑制 |
| FS-007 | GitHub Actions で定期更新できる | workflow | 定期実行でデータ更新 |
| FS-008 | GitHub Pages で公開できる | 静的ビルド / deploy | 公開URLで閲覧可能 |
| FS-009 | 単一フィード失敗で全体を止めない | 取得エラーハンドリング | 一部失敗でも生成継続 |
| FS-010 | 記事本文を保持しない | 設計方針 / UI | 本文表示を実装しない |
| FS-011 | 静的生成データの責務を分離できる | `feeds/articles/categories/sources` の生成 | UI が必要データを静的成果物から読める |
| FS-012 | ルーティングが一覧中心で定義されている | `/`, `/categories/[category]`, `/sources/[source]` | 導線が仕様と一致する |
| FS-013 | 更新失敗時も前回成功データを破壊しない | workflow / deploy 設計 | 一部失敗時の継続方針が保たれる |
| FS-014 | フィード定義を `data/feeds.json` に集約できる | `data/feeds.json` / `scripts/pipeline/loadFeeds.js` | 単一ファイルから全フィードを読める |
| FS-015 | フィード `id` を安定キーとして扱える | schema / validation | `id` が内部参照キーとして利用できる |
| FS-016 | フィード定義の必須項目が明示されている | docs / loader contract | 必須フィールド欠落時に検出できる |
| FS-017 | 記事正規化オブジェクトを共通中間表現として固定できる | `scripts/pipeline/normalizeFeed.js` / docs | canonical article object の shape と責務が tests で固定される |
| FS-018 | 公開日時が無い記事でも `fetchedAt` を持って保持できる | `scripts/pipeline/normalizeFeed.js` | `publishedAt` 欠損時も `fetchedAt` を ISO 8601 で保持できる |
| FS-019 | optional 項目の欠損表現が安定している | schema / JSON contract | 単数値は `null`、配列は `[]` で揃う |
| FS-020 | 記事側だけで表示に必要な媒体メタデータを読める | `scripts/pipeline/normalizeFeed.js` | feed 定義由来の `sourceName/category/language` が記事に補完される |
| FS-021 | `summary` を表示用の正規化済み文字列として扱える | `scripts/pipeline/normalizeFeed.js` | HTML を除去した summary が canonical article object に入る |
| FS-022 | URL 正規化を安全な変形のみに限定できる | `scripts/pipeline/normalizeFeed.js` | scheme/host 小文字化・tracking 除去・query 安定化のみを行う |
| FS-023 | 記事 `id` を URL 優先の段階的 hash で安定生成できる | `scripts/pipeline/normalizeFeed.js` | URL → source item → fallback の順で ID を生成できる |
| FS-024 | dedupe を全 feed 横断で conservative に行える | `scripts/pipeline/dedupeArticles.js` key selector | `normalizedUrl` と `(feedId, sourceItemId)` だけで判定する |
| FS-025 | 重複記事を richest-wins で統合できる | `scripts/pipeline/dedupeArticles.js` merge rule | `summary` / `imageUrl` / `tags` / `fetchedAt` の統合規則が確認できる |
| FS-026 | 同一記事が観測された feed 集合を `seenInFeeds[]` に保持できる | `scripts/pipeline/dedupeArticles.js` provenance-lite contract | primary metadata と provenance-lite の役割分担が確認できる |
| FS-027 | `articles.json` の一覧用 shape と並び順を固定できる | `scripts/pipeline/buildPublicExports.js` articles generator | `sortAt` を含む summary object 配列として生成できる |
| FS-028 | `categories.json` の shape を固定できる | `scripts/pipeline/buildPublicExports.js` categories generator | `id/label/articleCount/latestSortAt` を生成できる |
| FS-029 | `sources.json` の shape を固定できる | `scripts/pipeline/buildPublicExports.js` sources generator | `id/name/siteUrl/language/categoryId/categoryLabel/articleCount/latestSortAt` を生成できる |
| FS-030 | `meta.json` で生成時刻と件数を公開できる | `scripts/pipeline/buildPublicExports.js` meta generator | `generatedAt/articleCount/sourceCount/categoryCount` を生成できる |
| FS-031 | `categoryId` を安定 slug として扱える | `scripts/pipeline/buildPublicExports.js` slug builder | 表示ラベルと内部キーが分離され、衝突が build error として扱える |
| FS-032 | Phase 2 の実行モデルを GitHub Actions-first で固定できる | workflow strategy / docs | 定期実行が標準であり公開向け CLI を必須にしないことが仕様で確認できる |
| FS-033 | 長期保持する取得 state を cache / artifact 非依存で保存できる | state storage strategy | 永続 state の正本が repository 管理下の保存先に置かれることが仕様で確認できる |
| FS-034 | 内部 pipeline entrypoint を Actions とローカル再現の両方から呼べる | `package.json` / `scripts/pipeline/run.js` / `justfile` | `runPipeline` から正規化・dedupe・public export まで同じ処理系を共有できる |
| FS-035 | 公開生成物と内部 state の責務を分離できる | public export / internal state design | `articles.json` 等を公開契約に限定し、内部履歴と混同しないことが確認できる |
| FS-036 | Phase 3 の UI 実装境界を static HTML / CSS / JS + `public/data` 読み取りに固定できる | `public/` 配下の静的 UI / docs | Phase 3 着手前に UI 境界が docs で確認できる |
| FS-037 | UI が 4 つの公開 JSON だけで一覧表示に必要な情報を取得できる | `public/data/articles/categories/sources/meta` consumer | 追加 dedupe や feed join が不要なことを仕様で確認できる |
| FS-038 | UI が loading / empty / error と nullable 項目欠損に耐えられる | `public/assets/app.js` / `tests/web-home.test.ts` | `summary` / `publishedAt` / `imageUrl` 欠損時も表示が崩れない |
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
