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

  assert.ok(lefthookConfig.includes('run: mise exec -- just check-fast'));
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
