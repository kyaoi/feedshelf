# FeedShelf

FeedShelf は、複数の公開 RSS / Atom フィードから記事情報を収集し、**棚 (`shelf`) を起点に記事へ出会う shelf-first な静的 Web アプリ**です。

v1 では **記事本文を保持せず、GitHub Actions で `public/data/*.json` を生成し、GitHub Pages で配信する** 構成を前提にしています。Phase 6 以降の primary public JSON は `articles / shelves / sources / tags / search-index / meta` とし、`categories.json` は compatibility export として扱います。

## MVP の前提

- 記事本文は保持しない
- 外部記事へ遷移して読む
- 入力は公開 RSS / Atom のみ
- 更新は GitHub Actions、公開は GitHub Pages を前提にする
- Web UI は `public/` 配下の static HTML / CSS / JS として保つ
- 主役の導線は `/`・`/<shelfId>/`・`/tags/`・`/search/`・`/sources/` とし、`/categories/` は compatibility route として残す

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
pnpm run ci              # check:fast / typecheck / test / verify:web-ui
pnpm run check:fast      # format:check / lint:biome / repo 固有 lint を高速に確認
pnpm run format          # Biome で hand-authored な TS / JSON / config を明示対象だけ整形
pnpm run format:check    # hand-authored な TS / JSON / config に対する Biome format 差分確認
pnpm run lint:biome      # hand-authored な TS / JSON / config に対する Biome lint 確認
pnpm run pipeline:update # RSS / Atom を取得して public/data を生成
pnpm run build:web-ui    # src/web/app.ts から public/assets/app.js を再生成
pnpm run verify:web-ui   # checked-in asset と再生成結果の一致確認
```

`just ci` は `pnpm run ci` の薄いラッパーです。`just check-fast` も用意しますが、hook は pre-push の full gate に寄せ、lefthook では `just ci` のみを実行します。diffship 修正ループでは `.diffship/config.toml` の `ops.post_apply` から依存解決・`pnpm run build:web-ui`・`pnpm run ci` を流し、通常開発と loop の verify 入口を揃えます。

Biome の初期 gate では、既存 runtime の無関係な書き換えを避けるため、`useOptionalChain` / `useArrowFunction` / `useLiteralKeys` / `noGlobalEval` は `off` に固定しています。

## ローカル確認の最短手順

### 1. フィード定義を用意する

`data/feeds.json` に少なくとも 1 件の `enabled: true` な feed を入れてください。

あわせて、`feeds.json.shelfIds[]` は `data/shelves.yaml` に存在する棚 ID だけを参照し、同じ source の `shelfIds[]` に同一棚を重複させず、各 source の `id` は `feeds.json` 内で一意に保ってください。`feedUrl` / `siteUrl` は absolute な `http/https` URL とし、manual `tags` は省略するか配列で与え、使う場合の `tags[]` 各要素は非空文字列でなければならず、compare key（NFKC・trim・空白縮約・ASCII-Latin case 差吸収）で見ても重複させない前提です。棚を rename / delete したのに `feeds.json` 側を更新し忘れたり、同一 source に duplicate な shelf id や duplicate な source id、相対 URL や非 `http/https` の `feedUrl` / `siteUrl`、非配列の `tags`、空や非文字列の manual tag、compare-key 上 duplicate な manual tag を入れたりすると、`pnpm run pipeline:update` は fail-fast で停止します。

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

同時に `/<shelfId>/index.html` の棚 route shell も同期され、`data/shelves.yaml` から削除・rename された棚に対応する generated route は次回 export 時に掃除されます。

### 4. `public/` を静的配信して確認する

```bash
python -m http.server 4173 --directory public
```

その後、ブラウザで以下を開いて確認します。

- `http://localhost:4173/`
- `http://localhost:4173/it/` （例: 棚 route）
- `http://localhost:4173/tags/`
- `http://localhost:4173/search/`
- `http://localhost:4173/sources/`
- `http://localhost:4173/categories/` （compatibility route）

## GitHub Actions / Pages

- 通常 CI workflow: `.github/workflows/ci.yml`
  - `push` / `pull_request` ごとに `pnpm run ci` を実行する
- 更新 / 公開 workflow: `.github/workflows/update-public-data.yml`
  - `workflow_dispatch` / `schedule` / `push(main)` で起動する
  - `build-public-data` job で依存解決、品質ゲート、`pnpm run pipeline:update`、Pages artifact upload を行う
  - `deploy-github-pages` job で Pages へ deploy する
- enabled feed が 0 件、または enabled feed がすべて fetch / source-level validation で失敗した場合は、deploy を進めず前回成功サイトを保護する
- fetch は成功しても RSS / Atom として解釈できない feed は source-level failure として skip し、残りに 1 件以上 publishable feed があれば更新を継続する
- source policy は cautious default を採り、既定では site 自身または first-party help / docs で feed 提供が確認しやすい source を優先する
- community source や undocumented topic feed は、法務判断や取得条件の追加確認が済むまで `enabled=false` のまま保持してよい
- update cadence は過剰取得を避けるため既定で 12 時間ごと (`17 */12 * * *`) とする
- 公開 JSON の `summary` は raw HTML 全文や長文再配信を避け、短い excerpt に正規化して扱う

## 品質ゲートが失敗したときの運用

- pre-push / CI / diffship post-apply が失敗しても、原則として失敗したタスクの変更は stash しない
- 修正対象の差分は working tree に残したまま、`git rev-parse HEAD` で exact HEAD を取得する
- hook や CI の failure log を保存し、その exact HEAD と一緒に diffship の修正ループへ渡す
- unrelated な変更だけを一時退避したい場合に限り、必要最小限で stash を使う

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
