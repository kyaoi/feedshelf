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
- [ ] `FS-DX-04` tests / docs / workflow 追跡を同期する

完了条件:
- Biome / repo 固有 check / hook / GitHub Actions の責務分割が docs で固定されている
- `pnpm run ci` を full gate の単一入口として実装できる計画になっている
- pre-commit failure 時の diffship 運用が stash 前提ではなく、working tree 保持 + exact HEAD / failure log 受け渡しで定義されている

## 直近の次タスク

- `FS-DX-04` で tests / docs / workflow 追跡を同期する

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
