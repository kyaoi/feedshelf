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
- [ ] `FS-QA-01` 仕様と実装の差分を確認する
- [ ] `FS-QA-02` README / docs の導線を整える
- [ ] `FS-QA-03` MVP 受け入れ条件を満たすか確認する

完了条件:
- Phase 5 着手前に、spec 実装差分監査 / README・docs 導線整理 / MVP 受け入れ確認の責務分割と実装順が docs で固定されている
- `docs/SPEC_V1.md` の MVP / 受け入れ条件を満たしている

## 直近の次タスク

1. `FS-QA-01`: 仕様と実装の差分を確認する

## メモ

- まずは docs と実装のズレを増やさないことを優先する
- 仕様変更が入ったら `SPEC_V1` / `DECISIONS` / `TRACEABILITY` / `PLAN` のどこを更新するかを明確にする
- 本文取得やオフライン対応は v1 完了後の別フェーズで検討する
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
