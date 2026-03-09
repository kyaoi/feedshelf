# FeedShelf

FeedShelf は、複数の公開 RSS / Atom フィードから記事情報を収集し、**新着 / カテゴリ別 / 媒体別** に一覧表示する静的 Web アプリです。

v1 では **記事本文を保持せず、GitHub Actions で `public/data/*.json` を生成し、GitHub Pages で配信する** 構成を前提にしています。

## MVP の前提

- 記事本文は保持しない
- 外部記事へ遷移して読む
- 入力は公開 RSS / Atom のみ
- 更新は GitHub Actions、公開は GitHub Pages を前提にする
- Web UI は `public/` 配下の static HTML / CSS / JS として保つ

詳細な仕様は [`docs/SPEC_V1.md`](docs/SPEC_V1.md) を参照してください。

## リポジトリの入口

- `README.md`: 最初に読む入口。セットアップ、確認手順、主要 docs への導線
- `docs/SPEC_V1.md`: v1 の仕様と受け入れ条件
- `docs/DECISIONS.md`: 仕様判断の理由と影響範囲
- `docs/TRACEABILITY.md`: 仕様と実装 / テストの対応表
- `docs/TYPESCRIPT_MIGRATION.md`: TypeScript 移行の背景と段階整理
- `PLAN.md`: フェーズ別タスクの進行状況

## セットアップ

前提:

- Node.js 22 以上
- `pnpm`（corepack 経由を推奨）
- ローカル確認用の静的ファイルサーバー（例: `python -m http.server`）

```bash
corepack enable
pnpm install --frozen-lockfile
```

## 主なコマンド

```bash
pnpm run ci              # lint / typecheck / test / verify:web-ui
pnpm run pipeline:update # RSS / Atom を取得して public/data を生成
pnpm run build:web-ui    # src/web/app.ts から public/assets/app.js を再生成
pnpm run verify:web-ui   # checked-in asset と再生成結果の一致確認
```

`just ci` でも同じ品質ゲートを実行できます。

## ローカル確認の最短手順

### 1. フィード定義を用意する

`data/feeds.json` に少なくとも 1 件の `enabled: true` な feed を入れてください。

このリポジトリでは、**enabled feed が 0 件のまま `pnpm run pipeline:update` を実行すると意図的に失敗** します。これは、空の更新で既存公開データを上書きしないためです。

### 2. 品質ゲートを通す

```bash
pnpm run ci
```

### 3. 公開 JSON を生成する

```bash
pnpm run pipeline:update
```

生成物は `public/data/` に出力されます。`public/data/` は生成物として扱い、手編集しません。

### 4. `public/` を静的配信して確認する

```bash
python -m http.server 4173 --directory public
```

その後、ブラウザで以下を開いて確認します。

- `http://localhost:4173/`
- `http://localhost:4173/categories/`
- `http://localhost:4173/sources/`

## GitHub Actions / Pages

- workflow: `.github/workflows/update-public-data.yml`
- `build-public-data` job で依存解決、品質ゲート、`pnpm run pipeline:update`、Pages artifact upload を行う
- `deploy-github-pages` job で Pages へ deploy する
- enabled feed が全件取得失敗した場合は、deploy を進めず前回成功サイトを保護する

## docs を読む順番

1. `README.md`
2. `docs/SPEC_V1.md`
3. `docs/DECISIONS.md`
4. `docs/TRACEABILITY.md`
5. `docs/TYPESCRIPT_MIGRATION.md`
6. `PLAN.md`

## 補足

- `src/web/app.ts` が Web UI ロジックの source-of-truth です
- `public/assets/app.js` は checked-in browser asset です
- `scripts/pipeline/*.ts` が pipeline の TypeScript 実装です
- `.diffship/` はローカル運用ガイド領域であり、通常の patch 対象には含めません
