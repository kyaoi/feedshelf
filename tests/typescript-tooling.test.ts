const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

type TsconfigLike = {
  compilerOptions?: {
    allowJs?: boolean;
    checkJs?: boolean;
    noEmit?: boolean;
    strict?: boolean;
    allowImportingTsExtensions?: boolean;
    moduleDetection?: string;
    module?: string;
    moduleResolution?: string;
    types?: string[];
    lib?: string[];
    rootDir?: string;
    outDir?: string;
  };
  include?: string[];
};

type BiomeConfigLike = {
  $schema?: string;
  files?: {
    ignoreUnknown?: boolean;
    includes?: string[];
  };
  formatter?: {
    enabled?: boolean;
    indentStyle?: string;
    includes?: string[];
  };
  linter?: {
    enabled?: boolean;
    includes?: string[];
    rules?: {
      recommended?: boolean;
      complexity?: {
        useArrowFunction?: string;
        useLiteralKeys?: string;
        useOptionalChain?: string;
      };
      security?: {
        noGlobalEval?: string;
      };
    };
  };
  javascript?: {
    assist?: {
      enabled?: boolean;
    };
    formatter?: {
      quoteStyle?: string;
      semicolons?: string;
      trailingCommas?: string;
    };
  };
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8'),
  ) as T;
}

test('package scripts expose the quality-gate contract', () => {
  const packageJson = readJson<{
    scripts: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>('package.json');

  assert.equal(
    packageJson.scripts.format,
    'biome format --write biome.json package.json tsconfig.json tsconfig.web.json data/feeds.json data/shelves.yaml src scripts tests',
  );
  assert.equal(
    packageJson.scripts['format:check'],
    'biome format biome.json package.json tsconfig.json tsconfig.web.json data/feeds.json data/shelves.yaml src scripts tests',
  );
  assert.equal(
    packageJson.scripts['lint:biome'],
    'biome lint biome.json package.json tsconfig.json tsconfig.web.json data/feeds.json data/shelves.yaml src scripts tests',
  );
  assert.equal(
    packageJson.scripts['check:fast'],
    'pnpm run format:check && pnpm run lint:biome && pnpm run lint',
  );
  assert.equal(
    packageJson.scripts['pipeline:run'],
    'tsx scripts/pipeline/run.ts',
  );
  assert.equal(
    packageJson.scripts['pipeline:update'],
    'tsx scripts/pipeline/update.ts',
  );
  assert.equal(packageJson.scripts.lint, 'tsx scripts/lint.ts');
  assert.equal(packageJson.scripts.test, 'tsx --test tests/*.test.ts');
  assert.equal(packageJson.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageJson.scripts['build:web-ui'], 'tsc -p tsconfig.web.json');
  assert.equal(packageJson.scripts.build, 'pnpm run build:web-ui');
  assert.equal(
    packageJson.scripts['verify:web-ui'],
    'tsx scripts/verifyWebBuild.ts',
  );
  assert.equal(
    packageJson.scripts.ci,
    'pnpm run check:fast && pnpm run typecheck && pnpm run test && pnpm run verify:web-ui',
  );

  const devDependencies = packageJson['devDependencies'] || {};
  assert.equal(devDependencies['@biomejs/biome'], '2.4.7');
});

test('pipeline TypeScript entrypoints execute main() when launched via tsx', () => {
  const runEntrypoint = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/run.ts'),
    'utf8',
  );
  const updateEntrypoint = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/update.ts'),
    'utf8',
  );

  assert.match(runEntrypoint, /function isDirectExecution\(\): boolean/);
  assert.match(
    runEntrypoint,
    /path\.resolve\(process\.argv\[1\]\)\s*===\s*path\.resolve\(process\.cwd\(\), 'scripts\/pipeline\/run\.ts'\)/,
  );
  assert.match(runEntrypoint, /console\.error\('\[pipeline\] failed'/);
  assert.match(updateEntrypoint, /function isDirectExecution\(\): boolean/);
  assert.match(
    updateEntrypoint,
    /path\.resolve\(process\.argv\[1\]\)\s*===\s*path\.resolve\(process\.cwd\(\), 'scripts\/pipeline\/update\.ts'\)/,
  );
  assert.match(updateEntrypoint, /console\.error\('\[update\] failed'/);
});

test('justfile and lefthook delegate to the intended gate entrypoints', () => {
  const justfile = fs.readFileSync(
    path.resolve(__dirname, '..', 'justfile'),
    'utf8',
  );
  const lefthookConfig = fs.readFileSync(
    path.resolve(__dirname, '..', 'lefthook.yml'),
    'utf8',
  );

  assert.match(justfile, /check-fast:\n\s+pnpm run check:fast/);
  assert.match(justfile, /ci:\n\s+pnpm run ci/);

  assert.doesNotMatch(lefthookConfig, /pre-commit:/);
  assert.ok(lefthookConfig.includes('run: mise exec -- just ci'));
});

test('tsconfig keeps JS/TS coexistence enabled while strict mode is enabled', () => {
  const tsconfig = readJson<TsconfigLike>('tsconfig.json');
  const compilerOptions = tsconfig.compilerOptions || {};
  const include = tsconfig.include || [];

  assert.equal(compilerOptions.allowJs, true);
  assert.equal(compilerOptions.checkJs, false);
  assert.equal(compilerOptions.noEmit, true);
  assert.equal(compilerOptions.strict, true);
  assert.equal(compilerOptions.allowImportingTsExtensions, true);
  assert.equal(compilerOptions.moduleDetection, 'force');
  assert.equal(compilerOptions.module, 'CommonJS');
  assert.equal(compilerOptions.moduleResolution, 'Node');
  assert.deepEqual(compilerOptions.types, ['node']);
  const lib = compilerOptions.lib || [];
  assert.ok(Array.isArray(lib));
  assert.ok(lib.includes('DOM.Iterable'));
  assert.ok(Array.isArray(include));
  assert.ok(include.includes('src/**/*.ts'));
  assert.ok(include.includes('scripts/**/*.ts'));
  assert.ok(include.includes('scripts/**/*.js'));
  assert.ok(include.includes('tests/**/*.ts'));
  assert.ok(!include.includes('tests/**/*.js'));
  assert.ok(!include.includes('public/assets/**/*.js'));
});

test('web UI build and verify config are present', () => {
  const webTsconfig = readJson<TsconfigLike>('tsconfig.web.json');
  const compilerOptions = webTsconfig.compilerOptions || {};
  const include = webTsconfig.include || [];

  assert.equal(compilerOptions.noEmit, false);
  assert.equal(compilerOptions.allowJs, false);
  assert.equal(compilerOptions.allowImportingTsExtensions, false);
  assert.equal(compilerOptions.module, 'none');
  assert.equal(compilerOptions.rootDir, 'src/web');
  assert.equal(compilerOptions.outDir, 'public/assets');
  assert.equal(compilerOptions.moduleDetection, 'auto');
  assert.ok(Array.isArray(include));
  assert.deepEqual(include, ['src/web/app.ts']);

  assert.equal(
    fs.existsSync(path.resolve(__dirname, '..', 'src/web/app.ts')),
    true,
  );
  assert.equal(
    fs.existsSync(path.resolve(__dirname, '..', 'scripts/lint.ts')),
    true,
  );
  assert.equal(
    fs.existsSync(path.resolve(__dirname, '..', 'scripts/verifyWebBuild.ts')),
    true,
  );
});

test('Phase 6 shelf-route evidence stays aligned across docs, tests, and PLAN', () => {
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );

  assert.match(spec, /tests\/web-shelf\.test\.ts/);
  assert.match(traceability, /tests\/web-shelf\.test\.ts/);
  assert.equal(
    fs.existsSync(path.resolve(__dirname, '..', 'tests/web-shelf.test.ts')),
    true,
  );
  assert.match(plan, /Phase 6 implementation backlog は完了済み/);
});

test('FS-DATA-06 docs split stays aligned across PLAN, SPEC, DECISIONS, TRACEABILITY, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const loadFeedsTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/load-feeds.test.ts'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-22/);
  assert.match(plan, /allowlisted host rule と bounded redirect resolution/);
  assert.match(spec, /build-time の best-effort precision layer/);
  assert.match(spec, /article HTML 本文の取得/);
  assert.match(spec, /<link rel="canonical">/);
  assert.match(
    spec,
    /public JSON の shape、route 構造、checked-in HTML shell はこの task では変えない/,
  );
  assert.match(decisions, /safe canonicalization を fallback/);
  assert.match(decisions, /public JSON の shape や route 構造を変えず/);
  assert.match(traceability, /FS-150/);
  assert.match(loadFeedsTest, /normalizeUrl keeps safe canonicalization only/);
});

test('FS-DATA-06 implementation stays aligned across PLAN, SPEC, DECISIONS, TRACEABILITY, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const loadFeedsTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/load-feeds.test.ts'),
    'utf8',
  );
  const updateWorkflowTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/update-workflow.test.ts'),
    'utf8',
  );

  assert.match(plan, /Post-v1 canonicalization implementation/);
  assert.match(
    plan,
    /FS-DATA-06` allowlisted host rule と bounded redirect resolution/,
  );
  assert.match(plan, /deferred backlog の次候補は `FS-DATA-05` へ移る/);
  assert.match(spec, /10\.2\.2 Post-v1 canonicalization implementation/);
  assert.match(spec, /b\.hatena\.ne\.jp\/entry/);
  assert.match(spec, /candidate にだけ適用/);
  assert.match(decisions, /D-140/);
  assert.match(decisions, /全 article URL への一律 fetch は行わない/);
  assert.match(traceability, /FS-151/);
  assert.match(
    loadFeedsTest,
    /normalizeUrlWithPrecision rewrites Hatena entry URLs/,
  );
  assert.match(
    updateWorkflowTest,
    /runUpdatePipeline applies canonicalization precision layer/,
  );
});

test('FS-DATA-07 docs split stays aligned across PLAN, SPEC, DECISIONS, TRACEABILITY, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-24/);
  assert.match(
    plan,
    /same-source fallback・title compare key・publishedAt 72h window・rollback 境界/,
  );
  assert.match(plan, /exact dedupe miss fallback/);
  assert.match(spec, /10\.5\.1 Post-v1 fuzzy dedupe docs split/);
  assert.match(spec, /`titleCompareKey`/);
  assert.match(spec, /72 時間以内/);
  assert.match(spec, /matchedBy=fuzzyTitleDate/);
  assert.match(decisions, /D-142/);
  assert.match(decisions, /same-source\/title\/date fallback/);
  assert.match(decisions, /full rebuild/);
  assert.match(traceability, /FS-154/);
  assert.match(traceability, /embedding \/ LLM/);
});

test('FS-DATA-07 implementation stays aligned across PLAN, SPEC, DECISIONS, TRACEABILITY, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const loadFeedsTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/load-feeds.test.ts'),
    'utf8',
  );
  const updateWorkflowTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/update-workflow.test.ts'),
    'utf8',
  );

  assert.match(plan, /Post-v1 fuzzy dedupe implementation/);
  assert.match(
    plan,
    /FS-DATA-07` exact dedupe miss 後の same-source\/title\/date fallback/,
  );
  assert.match(plan, /`matchedBy=fuzzyTitleDate` を update state まで通す/);
  assert.match(spec, /10\.5\.2 Post-v1 fuzzy dedupe implementation/);
  assert.match(spec, /trim・連続空白 collapse・lowercase 化/);
  assert.match(spec, /full rebuild すれば rollback できる/);
  assert.match(decisions, /D-143/);
  assert.match(decisions, /exact dedupe で未一致だった article にだけ/);
  assert.match(traceability, /FS-155/);
  assert.match(
    loadFeedsTest,
    /dedupeArticles applies conservative fuzzy fallback for same-source title matches within 72 hours/,
  );
  assert.match(
    updateWorkflowTest,
    /loadUpdateState keeps fuzzyTitleDate provenance entries/,
  );
});

test('FS-DOCS-25 deferred backlog close-out stays aligned across PLAN, SPEC, DECISIONS, and TRACEABILITY', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-25/);
  assert.match(plan, /Deferred 一覧と各詳細セクションの両方/);
  assert.match(
    plan,
    /public provenance surfacing・canonicalization の追加 precision rule・fuzzy dedupe の stricter observability \/ rollback/,
  );
  assert.match(spec, /15\.1\.0 Deferred data backlog close-out/);
  assert.match(spec, /deferred data backlog は「未着手の残タスク」ではなく/);
  assert.match(spec, /追加 precision rule/);
  assert.match(decisions, /D-144/);
  assert.match(
    decisions,
    /元の `FS-DATA-05` \/ `FS-DATA-06` \/ `FS-DATA-07` を直接 reopen せず/,
  );
  assert.match(traceability, /FS-156/);
  assert.match(traceability, /stricter observability \/ rollback/);
});

test('FS-DOCS-26 public provenance export docs split stays aligned across PLAN, SPEC, DECISIONS, and TRACEABILITY', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-26/);
  assert.match(plan, /optional `alsoSeenInSourceIds: string\[]`/);
  assert.match(plan, /primary `sourceId` を除いた stable order/);
  assert.match(spec, /10\.6\.2 Post-v1 public provenance export docs split/);
  assert.match(spec, /optional `alsoSeenInSourceIds: string\[]`/);
  assert.match(
    spec,
    /provenance audit UI・per-source label chip・manual review surface・`seenInFeeds\[]` 除去/,
  );
  assert.match(decisions, /D-145/);
  assert.match(decisions, /secondary source id の stable ordered list/);
  assert.match(traceability, /FS-157/);
  assert.match(traceability, /confidence \/ audit UI \/ `seenInFeeds\[]` 除去/);
});

test('FS-DATA-09 public provenance export implementation stays aligned across PLAN, TRACEABILITY, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DATA-09/);
  assert.match(plan, /optional `alsoSeenInSourceIds`/);
  assert.match(
    plan,
    /retained public article merge でも `alsoSeenInSourceIds` を失わず/,
  );
  assert.match(traceability, /FS-158/);
  assert.match(
    traceability,
    /retained public article merge 後も `alsoSeenInSourceIds` を保持/,
  );

  const loadFeedsTest = fs.readFileSync(
    path.resolve(__dirname, 'load-feeds.test.ts'),
    'utf8',
  );
  const updateWorkflowTest = fs.readFileSync(
    path.resolve(__dirname, 'update-workflow.test.ts'),
    'utf8',
  );
  const contracts = fs.readFileSync(
    path.resolve(__dirname, '..', 'src/shared/contracts.ts'),
    'utf8',
  );
  const buildPublicExports = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/buildPublicExports.ts'),
    'utf8',
  );

  assert.match(contracts, /alsoSeenInSourceIds\?: string\[];/);
  assert.match(buildPublicExports, /deriveAlsoSeenInSourceIds/);
  assert.match(
    loadFeedsTest,
    /buildPublicExports derives alsoSeenInSourceIds from secondary provenance/,
  );
  assert.match(updateWorkflowTest, /alsoSeenInSourceIds: \['legacy-feed'\]/);
});

test('FS-DOCS-27 public provenance chip docs split stays aligned across PLAN, SPEC, DECISIONS, and TRACEABILITY', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-27/);
  assert.match(plan, /shared article card 上の bounded secondary-source chip/);
  assert.match(
    plan,
    /最大 2 件までの secondary source label と `\+N` overflow/,
  );
  assert.match(spec, /10\.6\.3 Post-v1 public provenance chip docs split/);
  assert.match(spec, /既存 `sources\.json` \/ source registry/);
  assert.match(
    spec,
    /new route \/ filter \/ query param \/ sort change \/ search scoring change は行わない/,
  );
  assert.match(decisions, /D-146/);
  assert.match(decisions, /最大 2 件 \+ `\+N` overflow/);
  assert.match(traceability, /FS-159/);
  assert.match(traceability, /unknown source id は無視/);
});

test('FS-DOCS-28 fuzzy dedupe observability docs split stays aligned across PLAN, SPEC, DECISIONS, and TRACEABILITY', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-28/);
  assert.match(plan, /internal-only `fuzzyDuplicatesCollapsed`/);
  assert.match(plan, /`--disable-fuzzy-dedupe`/);
  assert.match(spec, /10\.5\.3 Post-v1 fuzzy dedupe observability docs split/);
  assert.match(spec, /per-article title \/ URL \/ confidence \/ audit trail/);
  assert.match(
    spec,
    /retained public data \/ `update-state\.json` を持ち越さない full rebuild/,
  );
  assert.match(decisions, /D-147/);
  assert.match(decisions, /internal summary と明示的 off switch に閉じる/);
  assert.match(traceability, /FS-161/);
  assert.match(traceability, /kill switch/);
});

test('FS-DOCS-29 canonicalization deterministic rule-table docs split stays aligned across PLAN, SPEC, DECISIONS, and TRACEABILITY', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-29/);
  assert.match(plan, /deterministic allowlisted rewrite\/query rule table/);
  assert.match(
    plan,
    /network I\/O 拡大・generic rule 化・public contract 変更/,
  );
  assert.match(
    spec,
    /10\.2\.3 Post-v1 canonicalization deterministic rule-table docs split/,
  );
  assert.match(spec, /repo 内で version 管理する明示的 allowlist host/);
  assert.match(
    spec,
    /`data\/feeds\.json` へ canonical override field を足したり/,
  );
  assert.match(decisions, /D-149/);
  assert.match(
    decisions,
    /追加 network I\/O や source registry への manual canonical override を含めない/,
  );
  assert.match(traceability, /FS-163/);
  assert.match(traceability, /generic query stripping/);
});

test('FS-DATA-10 fuzzy dedupe observability implementation stays aligned across PLAN, SPEC, DECISIONS, TRACEABILITY, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const contracts = fs.readFileSync(
    path.resolve(__dirname, '..', 'src/shared/contracts.ts'),
    'utf8',
  );
  const dedupeSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/dedupeArticles.ts'),
    'utf8',
  );
  const runSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/run.ts'),
    'utf8',
  );
  const updateSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/update.ts'),
    'utf8',
  );
  const loadFeedsTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/load-feeds.test.ts'),
    'utf8',
  );
  const updateWorkflowTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/update-workflow.test.ts'),
    'utf8',
  );

  assert.match(plan, /FS-DATA-10/);
  assert.match(plan, /`fuzzyDuplicatesCollapsed` summary/);
  assert.match(plan, /`--disable-fuzzy-dedupe` kill switch/);
  assert.match(
    spec,
    /10\.5\.4 Post-v1 fuzzy dedupe observability implementation/,
  );
  assert.match(spec, /aggregate な `fuzzyDuplicatesCollapsed` count/);
  assert.match(spec, /CLI は `--disable-fuzzy-dedupe`/);
  assert.match(decisions, /D-148/);
  assert.match(decisions, /aggregate `fuzzyDuplicatesCollapsed`/);
  assert.match(traceability, /FS-162/);
  assert.match(contracts, /fuzzyDuplicatesCollapsed: number;/);
  assert.match(dedupeSource, /dedupeArticlesWithSummary/);
  assert.match(dedupeSource, /disableFuzzyDedupe/);
  assert.match(runSource, /--disable-fuzzy-dedupe/);
  assert.match(runSource, /fuzzyDuplicatesCollapsed=/);
  assert.match(updateSource, /--disable-fuzzy-dedupe/);
  assert.match(
    loadFeedsTest,
    /dedupeArticlesWithSummary reports fuzzy collapse counts/,
  );
  assert.match(
    updateWorkflowTest,
    /runUpdatePipeline reports fuzzyDuplicatesCollapsed and supports disableFuzzyDedupe/,
  );
});

test('FS-UX-22 provenance chips stay aligned across PLAN, TRACEABILITY, app, and web tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const appSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'src/web/app.ts'),
    'utf8',
  );
  const webHomeTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/web-home.test.ts'),
    'utf8',
  );
  const webSearchTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/web-search.test.ts'),
    'utf8',
  );

  assert.match(plan, /FS-UX-22/);
  assert.match(plan, /shared article card 上の補助表示/);
  assert.match(traceability, /FS-160/);
  assert.match(appSource, /buildSecondarySourceChips/);
  assert.match(appSource, /article-card__secondary-sources/);
  assert.match(appSource, /visibleChips.length < 2/);
  assert.match(webHomeTest, /bounded secondary-source chips for home cards/);
  assert.match(webSearchTest, /nested source hrefs for secondary-source chips/);
});

test('FS-DATA-05 docs split stays aligned across PLAN, SPEC, DECISIONS, TRACEABILITY, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );

  assert.match(plan, /FS-DOCS-23/);
  assert.match(
    plan,
    /`seenInFeeds\[\]` は削除せず derived compatibility summary/,
  );
  assert.match(plan, /`matchedBy=primary\|normalizedUrl\|feedItem`/);
  assert.match(spec, /10\.6\.1 Post-v1 richer provenance docs split/);
  assert.match(
    spec,
    /`provenance\[\]` は `feedId` ごとに高々 1 件の bounded entry/,
  );
  assert.match(spec, /public JSON の shape と route 構造は変えない/);
  assert.match(decisions, /D-141/);
  assert.match(
    decisions,
    /internal `provenance\[\]` 追加 \+ `seenInFeeds\[\]` 併存/,
  );
  assert.match(traceability, /FS-152/);
  assert.match(traceability, /matchedBy=primary\|normalizedUrl\|feedItem/);
});

test('feed and shelf registry validation stays aligned across README, docs, and tests', () => {
  const readme = fs.readFileSync(
    path.resolve(__dirname, '..', 'README.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const runPipelineSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/run.ts'),
    'utf8',
  );
  const loadFeedsSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/loadFeeds.ts'),
    'utf8',
  );

  assert.match(readme, /feeds\.json\.shelfIds\[\]/);
  assert.match(readme, /各 source の `id`/);
  assert.match(readme, /同じ source の `shelfIds\[\]` に同一棚を重複させず/);
  assert.match(readme, /fail-fast/);
  assert.match(readme, /compare key/);
  assert.match(readme, /manual `tags` は省略するか配列/);
  assert.match(readme, /absolute な `http\/https` URL/);
  assert.match(readme, /非空文字列/);
  assert.match(
    spec,
    /`feeds\.json` 内の各 source `id` は一意でなければならない/,
  );
  assert.match(
    spec,
    /各 source の `shelfIds\[\]` 内で同じ shelf を重複させてはならない/,
  );
  assert.match(spec, /`tags` は省略可能だが、与える場合は配列でなければならず/);
  assert.match(
    spec,
    /`feedUrl` は取得対象の公開 RSS \/ Atom URL とし、absolute な `http\/https` URL でなければならない/,
  );
  assert.match(
    spec,
    /`siteUrl` は媒体トップまたはフィードに対応するサイトURLとし、absolute な `http\/https` URL でなければならない/,
  );
  assert.match(spec, /`tags\[\]` の各要素は非空文字列でなければならず/);
  assert.match(
    spec,
    /`tags\[\]` は tag compare key.*source 内一意でなければならない/,
  );
  assert.match(
    spec,
    /`feeds\.json\.shelfIds\[\]` の各値は `shelves\.yaml` に存在しなければならない/,
  );
  assert.match(decisions, /join を fail-fast で検証する/);
  assert.match(decisions, /source `id` の重複を拒否/);
  assert.match(decisions, /source 内で重複を fail-fast に拒否する/);
  assert.match(decisions, /manual `tags\[\]` は compare key 上で重複/);
  assert.match(decisions, /manual `tags` field は省略または配列/);
  assert.match(decisions, /manual `tags\[\]` の各要素は非空文字列/);
  assert.match(
    decisions,
    /`feedUrl` \/ `siteUrl` は absolute な `http\/https` URL/,
  );
  assert.match(traceability, /FS-127/);
  assert.match(traceability, /FS-128/);
  assert.match(traceability, /FS-129/);
  assert.match(traceability, /FS-130/);
  assert.match(traceability, /FS-131/);
  assert.match(traceability, /FS-132/);
  assert.match(traceability, /FS-133/);
  assert.match(traceability, /tests\/load-feeds\.test\.ts/);
  assert.match(plan, /冗長な棚属先/);
  assert.match(plan, /壊れた source URL/);
  assert.match(plan, /tag field shape mismatch/);
  assert.match(plan, /空 manual tag/);
  assert.match(plan, /冗長 tag summary/);
  assert.match(runPipelineSource, /Unknown shelfId referenced by feed/);
  assert.match(loadFeedsSource, /Duplicate feed id/);
  assert.match(loadFeedsSource, /duplicate shelfIds value/);
  assert.match(
    loadFeedsSource,
    /const HTTP_URL_FIELDS = \['feedUrl', 'siteUrl'\] as const/,
  );
  assert.match(
    loadFeedsSource,
    /must have absolute http\/https URL field: \$\{field\}/,
  );
  assert.match(loadFeedsSource, /must have array field: tags/);
  assert.match(loadFeedsSource, /has invalid tags\[/);
  assert.match(loadFeedsSource, /duplicate tags value/);
  assert.equal(
    fs.existsSync(path.resolve(__dirname, '..', 'tests/load-feeds.test.ts')),
    true,
  );
});

test('README and docs stay aligned with workflow boundaries and diffship failure handling', () => {
  const readme = fs.readFileSync(
    path.resolve(__dirname, '..', 'README.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const ciWorkflow = fs.readFileSync(
    path.resolve(__dirname, '..', '.github/workflows/ci.yml'),
    'utf8',
  );
  const updateWorkflow = fs.readFileSync(
    path.resolve(__dirname, '..', '.github/workflows/update-public-data.yml'),
    'utf8',
  );

  assert.match(readme, /stash しない/);
  assert.match(readme, /git rev-parse HEAD/);
  assert.match(readme, /failure log/);
  assert.match(readme, /diffship の修正ループ/);
  assert.match(readme, /generated route は次回 export 時に掃除/);

  for (const documentText of [spec, decisions, traceability, plan]) {
    assert.match(documentText, /tests\/typescript-tooling\.test\.ts/);
  }

  assert.match(spec, /working tree を保持/);
  assert.match(spec, /exact HEAD/);
  assert.match(spec, /\.github\/workflows\/ci\.yml/);
  assert.match(spec, /\.github\/workflows\/update-public-data\.yml/);
  assert.match(spec, /oldShelfId/);
  assert.match(spec, /route shell を掃除/);
  assert.match(spec, /HTML を壊さない/);
  assert.match(decisions, /stale な generated shelf route だけを掃除する/);
  assert.match(decisions, /HTML escape して埋め込む/);
  assert.match(traceability, /FS-125/);
  assert.match(traceability, /FS-126/);
  assert.match(plan, /stale route を残さない/);
  assert.match(plan, /HTML special chars を escape/);

  assert.match(ciWorkflow, /^name: CI/m);
  assert.match(ciWorkflow, /pnpm run ci/);
  assert.doesNotMatch(ciWorkflow, /actions\/configure-pages@v5/);
  assert.doesNotMatch(ciWorkflow, /pnpm run pipeline:update/);

  assert.match(updateWorkflow, /^name: Update public data/m);
  assert.match(updateWorkflow, /push:/);
  assert.match(updateWorkflow, /branches:\n\s+- main/);
  assert.match(updateWorkflow, /actions\/configure-pages@v5/);
  assert.match(updateWorkflow, /pnpm run ci/);
  assert.match(updateWorkflow, /pnpm run pipeline:update/);
  assert.match(updateWorkflow, /actions\/deploy-pages@v4/);
});

test('biome baseline config scopes generated files out of formatting and linting', () => {
  const biomeConfig = readJson<BiomeConfigLike>('biome.json');
  const formatterIncludes = biomeConfig.formatter?.includes || [];
  const linterIncludes = biomeConfig.linter?.includes || [];

  assert.equal(
    biomeConfig.$schema,
    'https://biomejs.dev/schemas/2.4.7/schema.json',
  );
  assert.equal(biomeConfig.files?.ignoreUnknown, true);
  assert.ok(formatterIncludes.includes('biome.json'));
  assert.ok(formatterIncludes.includes('package.json'));
  assert.ok(formatterIncludes.includes('data/**'));
  assert.ok(formatterIncludes.includes('src/**'));
  assert.ok(formatterIncludes.includes('scripts/**'));
  assert.ok(formatterIncludes.includes('tests/**'));
  assert.ok(formatterIncludes.includes('!scripts/**/*.js'));
  assert.ok(formatterIncludes.includes('!public/**'));
  assert.ok(formatterIncludes.includes('!.diffship/**'));
  assert.ok(linterIncludes.includes('!scripts/**/*.js'));
  assert.ok(linterIncludes.includes('!public/**'));
  assert.ok(linterIncludes.includes('!.diffship/**'));

  assert.equal(biomeConfig.formatter?.enabled, true);
  assert.equal(biomeConfig.formatter?.indentStyle, 'space');
  assert.equal(biomeConfig.linter?.enabled, true);
  assert.equal(biomeConfig.linter?.rules?.recommended, true);
  assert.equal(biomeConfig.linter?.rules?.complexity?.useArrowFunction, 'off');
  assert.equal(biomeConfig.linter?.rules?.complexity?.useLiteralKeys, 'off');
  assert.equal(biomeConfig.linter?.rules?.complexity?.useOptionalChain, 'off');
  assert.equal(biomeConfig.linter?.rules?.security?.noGlobalEval, 'off');
  assert.equal(biomeConfig.javascript?.assist?.enabled, false);
  assert.equal(biomeConfig.javascript?.formatter?.quoteStyle, 'single');
  assert.equal(biomeConfig.javascript?.formatter?.semicolons, 'always');
  assert.equal(biomeConfig.javascript?.formatter?.trailingCommas, 'all');
});

test('FS-DATA-11 canonicalization deterministic rule-table implementation stays aligned across PLAN, SPEC, DECISIONS, TRACEABILITY, normalizeFeed, and tests', () => {
  const plan = fs.readFileSync(
    path.resolve(__dirname, '..', 'PLAN.md'),
    'utf8',
  );
  const spec = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/SPEC_V1.md'),
    'utf8',
  );
  const decisions = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/DECISIONS.md'),
    'utf8',
  );
  const traceability = fs.readFileSync(
    path.resolve(__dirname, '..', 'docs/TRACEABILITY.md'),
    'utf8',
  );
  const normalizeFeedSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts/pipeline/normalizeFeed.ts'),
    'utf8',
  );
  const loadFeedsTest = fs.readFileSync(
    path.resolve(__dirname, '..', 'tests/load-feeds.test.ts'),
    'utf8',
  );

  assert.match(plan, /FS-DATA-11/);
  assert.match(
    plan,
    /Reddit presentation alias rewrite と comment-thread query cleanup/,
  );
  assert.match(
    spec,
    /10\.2\.4 Post-v1 canonicalization deterministic rule-table implementation/,
  );
  assert.match(spec, /old\.reddit\.com/);
  assert.match(spec, /context` \/ `depth` \/ `sort` \/ `share_id` \/ `rdt`/);
  assert.match(decisions, /D-150/);
  assert.match(
    decisions,
    /Reddit 用の host alias rewrite と comment-thread query cleanup/,
  );
  assert.match(traceability, /FS-164/);
  assert.match(normalizeFeedSource, /applyDeterministicCanonicalRuleTable/);
  assert.match(normalizeFeedSource, /applyRedditPresentationRule/);
  assert.match(normalizeFeedSource, /old\.reddit\.com/);
  assert.match(
    loadFeedsTest,
    /normalizeUrlWithPrecision applies deterministic Reddit presentation cleanup without extra redirect fetches/,
  );
  assert.match(
    loadFeedsTest,
    /runPipeline applies deterministic Reddit cleanup before writing public articles/,
  );
});
