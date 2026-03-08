# FeedShelf Traceability

| Spec ID | 要件 | 初期実装候補 | テスト/確認 |
|---|---|---|---|
| FS-001 | 新着一覧を表示できる | 一覧ページ / 記事カード | トップで新着順表示できる |
| FS-002 | カテゴリ別に絞り込める | カテゴリ一覧ページ | 指定カテゴリのみ表示される |
| FS-003 | 媒体別に絞り込める | 媒体一覧ページ | 指定媒体のみ表示される |
| FS-004 | 各記事から元記事へ遷移できる | 記事カードリンク | 外部URLへ遷移できる |
| FS-005 | RSS / Atom を共通形式へ正規化できる | 取得スクリプト | 必須項目が揃う |
| FS-006 | 重複記事を抑制できる | dedupe 処理 | 同一記事の多重表示を抑制 |
| FS-007 | GitHub Actions で定期更新できる | workflow | 定期実行でデータ更新 |
| FS-008 | GitHub Pages で公開できる | 静的ビルド / deploy | 公開URLで閲覧可能 |
| FS-009 | 単一フィード失敗で全体を止めない | 取得エラーハンドリング | 一部失敗でも生成継続 |
| FS-010 | 記事本文を保持しない | 設計方針 / UI | 本文表示を実装しない |
| FS-011 | 静的生成データの責務を分離できる | `feeds/articles/categories/sources` の生成 | UI が必要データを静的成果物から読める |
| FS-012 | ルーティングが一覧中心で定義されている | `/`, `/categories/[category]`, `/sources/[source]` | 導線が仕様と一致する |
| FS-013 | 更新失敗時も前回成功データを破壊しない | workflow / deploy 設計 | 一部失敗時の継続方針が保たれる |
| FS-014 | フィード定義を `data/feeds.json` に集約できる | hand-authored source / loader | 単一ファイルから全フィードを読める |
| FS-015 | フィード `id` を安定キーとして扱える | schema / validation | `id` が内部参照キーとして利用できる |
| FS-016 | フィード定義の必須項目が明示されている | docs / loader contract | 必須フィールド欠落時に検出できる |
| FS-017 | 記事正規化オブジェクトを共通中間表現として固定できる | canonical article object / docs | 取得処理と生成物 shape の責務が分離されている |
| FS-018 | 公開日時が無い記事でも `fetchedAt` を持って保持できる | normalization contract | `publishedAt=null` でも記事を表現できる |
| FS-019 | optional 項目の欠損表現が安定している | schema / JSON contract | 単数値は `null`、配列は `[]` で揃う |
| FS-020 | 記事側だけで表示に必要な媒体メタデータを読める | `sourceName/category/language` の保持 | 追加 join なしで最低限の表示ができる |
| FS-021 | `summary` を表示用の正規化済み文字列として扱える | normalization rule | raw HTML 前提にしないことが仕様で確認できる |
| FS-022 | URL 正規化を安全な変形のみに限定できる | `normalizedUrl` ルール / tracking 除去 | 破壊的 canonicalization を行わないことが仕様で確認できる |
| FS-023 | 記事 `id` を URL 優先の段階的 hash で安定生成できる | normalization / ID generator | URL → source item → fallback の優先順位が仕様で確認できる |
| FS-024 | dedupe を全 feed 横断で conservative に行える | dedupe key selector | `normalizedUrl` と `(feedId, sourceItemId)` だけで判定する |
| FS-025 | 重複記事を richest-wins で統合できる | duplicate merge rule | `summary` / `imageUrl` / `tags` / `fetchedAt` の統合規則が確認できる |
| FS-026 | 同一記事が観測された feed 集合を `seenInFeeds[]` に保持できる | provenance-lite contract | primary metadata と provenance-lite の役割分担が確認できる |
