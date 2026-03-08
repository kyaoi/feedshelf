# FeedShelf Traceability

| Spec ID | 要件 | 初期実装候補 | テスト/確認 |
|---|---|---|---|
| FS-001 | 新着一覧を表示できる | 一覧ページ / 記事カード | トップで新着順表示できる |
| FS-002 | カテゴリ別に絞り込める | カテゴリ一覧ページ | 指定カテゴリのみ表示される |
| FS-003 | 媒体別に絞り込める | 媒体一覧ページ | 指定媒体のみ表示される |
| FS-004 | 各記事から元記事へ遷移できる | 記事カードリンク | 外部URLへ遷移できる |
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

| FS-027 | `articles.json` の一覧用 shape と並び順を固定できる | public articles generator | `sortAt` を含む summary object 配列として生成できる |
| FS-028 | `categories.json` の shape を固定できる | public categories generator | `id/label/articleCount/latestSortAt` を生成できる |
| FS-029 | `sources.json` の shape を固定できる | public sources generator | `id/name/siteUrl/language/categoryId/categoryLabel/articleCount/latestSortAt` を生成できる |
| FS-030 | `meta.json` で生成時刻と件数を公開できる | public meta generator | `generatedAt/articleCount/sourceCount/categoryCount` を生成できる |
| FS-031 | `categoryId` を安定 slug として扱える | category summary / routing key | 表示ラベルと内部キーが分離され、衝突が build error として扱える |
| FS-032 | Phase 2 の実行モデルを GitHub Actions-first で固定できる | workflow strategy / docs | 定期実行が標準であり公開向け CLI を必須にしないことが仕様で確認できる |
| FS-033 | 長期保持する取得 state を cache / artifact 非依存で保存できる | state storage strategy | 永続 state の正本が repository 管理下の保存先に置かれることが仕様で確認できる |
| FS-034 | 内部 pipeline entrypoint を Actions とローカル再現の両方から呼べる | `package.json` / `scripts/pipeline/run.js` / `justfile` | `runPipeline` から正規化層まで同じ処理系を共有できる |
| FS-035 | 公開生成物と内部 state の責務を分離できる | public export / internal state design | `articles.json` 等を公開契約に限定し、内部履歴と混同しないことが確認できる |
