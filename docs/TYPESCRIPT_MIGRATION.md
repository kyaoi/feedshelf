# TypeScript Migration Plan

## 目的

FeedShelf を TypeScript ベースで型安全に保守できる状態へ移行する。
この文書は `FS-TS-00` の docs-first planning artifact であり、ここでは実装はまだ行わない。

## このタスクで固定すること

- TypeScript 化を一括置換ではなく段階移行として扱う
- 共有型を最初に整備する対象を公開 JSON 契約と pipeline 入出力に定める
- 初期導入の実行方式を `tsx` 実行 + `tsc --noEmit` とする
- JS と TS の共存期間を許容し、strictness は段階的に上げる
- 将来の生成物やキャッシュを `.gitignore` / `.diffshipignore` で既定除外する

## 非目的

- `FS-TS-00` の時点で `tsconfig.json` を追加すること
- `package.json` の script を TypeScript 前提へ変更すること
- `.js` ファイルを実際に `.ts` へ置き換えること
- UI を framework ベースへ作り直すこと

## 推奨する移行順序

### 1. `FS-TS-01`: TypeScript 実行基盤と型検査を導入する

対象:
- `tsconfig.json`
- `package.json`
- 必要なら `tsx` / `typescript` 依存
- quality gate の更新

実装方針:
- 初手は `tsx` で既存の Node script を直接実行できるようにする
- `tsc --noEmit` を型検査専用ゲートとして追加する
- `allowJs` を一時的に許容し、全面移行前でも動作を壊さない
- 生成物を出さない構成を優先するが、将来 `dist/` を採用するなら ignore を先に整える

`FS-TS-01` で実際に入れるもの:
- `tsconfig.json` を追加する
- `package.json` に `tsx` / `typescript` / `@types/node` と `typecheck` script を追加する
- `pipeline:run` / `lint` を `tsx` 起動へ寄せる
- `just ci` に `typecheck` を組み込む
- tooling 導線を壊さないことを確認する軽量 test を追加する

`FS-TS-01` でまだやらないこと:
- `scripts/pipeline/*.js` の `.ts` 置換
- `public/assets/app.js` の `.ts` 置換
- bundler / `dist/` 必須化
- tests 自体の TypeScript 化

### 2. `FS-TS-02`: pipeline のデータ契約と主要処理を TS 化する

優先対象:
- `scripts/pipeline/loadFeeds.js`
- `scripts/pipeline/normalizeFeed.js`
- `scripts/pipeline/dedupeArticles.js`
- `scripts/pipeline/buildPublicExports.js`
- `scripts/pipeline/run.js`

先に定義したい型:
- `FeedDefinition`
- `CanonicalArticle`
- `PublicArticleSummary`
- `PublicCategorySummary`
- `PublicSourceSummary`
- `PublicMeta`

実装方針:
- 共有型は 1 箇所に集約し、pipeline と UI が同じ定義を読む
- canonical article object と公開 JSON shape を別型として分離する
- 既存テストの fixture を再利用し、型付けと挙動変更を混ぜない

### 3. `FS-TS-03`: public web UI ロジックを TS 化する

対象:
- `public/assets/app.js`
- 必要なら UI 共有型 module

実装方針:
- HTML/CSS はそのままにし、ロジックだけを型安全化する
- `public/data/*.json` を読む view model 生成関数から型付けする
- null 許容フィールドや safe URL 判定を型で明示する
- build step を追加する場合は、公開物の配置先と ignore 方針を同時に固定する

### 4. `FS-TS-04`: tests / lint / verify フローを TS 前提に更新する

対象:
- `tests/*.js`
- `scripts/lint.js`
- `package.json` scripts
- CI / local gate 文書

実装方針:
- tests は pipeline / UI 移行後に追従させる
- lint / verify は `tsx` / `tsc --noEmit` を前提に整理する
- 実行入口の変更は docs と verification checklist を同時更新する

### 5. `FS-TS-05`: strictness を段階的に引き上げる

候補:
- `strict: true`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- JS ファイル縮退 (`allowJs` の段階的撤去)

実装方針:
- 先に型境界を整え、最後に strictness を上げる
- 移行途中では「型安全化」と「大規模整理」を混ぜない

## 実装時のファイル方針

### 変更対象候補
- `scripts/pipeline/`
- `public/assets/`
- `tests/`
- `package.json`
- `justfile`
- docs 一式

### まだ触らないもの
- `public/*.html`
- `public/assets/styles.css`
- `data/feeds.json`
- `.diffship/` 配下のローカルガイド本体

## 共有型として先に固定したい契約

### pipeline 側
- feed definition
- canonical article object
- dedupe result / merge rule 周辺

### public data 側
- `articles.json`
- `categories.json`
- `sources.json`
- `meta.json`

### UI 側
- nullable field の扱い
- safe external URL の扱い
- category / source route parameter の扱い

## 品質ゲート方針

将来の実装タスクでは、少なくとも次を候補にする。

- `node scripts/lint.js` または TypeScript 化後の同等 gate
- `node --test ...` または TypeScript 対応済み test command
- `tsc --noEmit`

## 生成物と ignore 方針

TypeScript 導入後に次のような生成物が増える場合は、repo と handoff の両方で既定除外する。

- `dist/`
- `*.tsbuildinfo`
- TypeScript / bundler 系キャッシュ

このルールは先回りして `.gitignore` と `.diffshipignore` に反映してよい。

## まとめ

TypeScript 化は「今の JavaScript 実装を壊さずに、共有データ契約から順に型で固定する」ことを優先する。
`FS-TS-00` の役割は、実装前にこの順番と責務分離を docs と traceability へ落とし込むことである。
