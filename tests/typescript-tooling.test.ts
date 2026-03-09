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
  files?: {
    ignoreUnknown?: boolean;
    ignore?: string[];
  };
  formatter?: {
    enabled?: boolean;
    indentStyle?: string;
  };
  linter?: {
    enabled?: boolean;
    rules?: {
      recommended?: boolean;
    };
  };
  organizeImports?: {
    enabled?: boolean;
  };
  javascript?: {
    formatter?: {
      quoteStyle?: string;
      semicolons?: string;
      trailingCommas?: string;
    };
  };
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')) as T;
}

test('package scripts expose the TypeScript execution baseline', () => {
  const packageJson = readJson<{
    scripts: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>('package.json');

  assert.equal(packageJson.scripts.format, 'biome format . --write');
  assert.equal(packageJson.scripts['format:check'], 'biome format . --check');
  assert.equal(packageJson.scripts['lint:biome'], 'biome lint .');
  assert.equal(packageJson.scripts['pipeline:run'], 'tsx scripts/pipeline/run.js');
  assert.equal(packageJson.scripts['pipeline:update'], 'tsx scripts/pipeline/update.js');
  assert.equal(packageJson.scripts.lint, 'tsx scripts/lint.ts');
  assert.equal(packageJson.scripts.test, 'tsx --test tests/*.test.ts');
  assert.equal(packageJson.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageJson.scripts['build:web-ui'], 'tsc -p tsconfig.web.json');
  assert.equal(packageJson.scripts.build, 'pnpm run build:web-ui');
  assert.equal(packageJson.scripts['verify:web-ui'], 'tsx scripts/verifyWebBuild.ts');
  assert.match(packageJson.scripts.ci, /pnpm run typecheck/);
  assert.match(packageJson.scripts.ci, /pnpm run verify:web-ui/);

  const devDependencies = packageJson['devDependencies'] || {};
  assert.equal(devDependencies['@biomejs/biome'], '1.9.4');
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

  assert.equal(fs.existsSync(path.resolve(__dirname, '..', 'src/web/app.ts')), true);
  assert.equal(fs.existsSync(path.resolve(__dirname, '..', 'scripts/lint.ts')), true);
  assert.equal(fs.existsSync(path.resolve(__dirname, '..', 'scripts/verifyWebBuild.ts')), true);
});

test('biome baseline config scopes generated files out of formatting and linting', () => {
  const biomeConfig = readJson<BiomeConfigLike>('biome.json');
  const ignore = biomeConfig.files?.ignore || [];

  assert.equal(biomeConfig.files?.ignoreUnknown, true);
  assert.ok(ignore.includes('.diffship/**'));
  assert.ok(ignore.includes('public/**'));
  assert.ok(ignore.includes('scripts/**/*.js'));

  assert.equal(biomeConfig.formatter?.enabled, true);
  assert.equal(biomeConfig.formatter?.indentStyle, 'space');
  assert.equal(biomeConfig.linter?.enabled, true);
  assert.equal(biomeConfig.linter?.rules?.recommended, true);
  assert.equal(biomeConfig.organizeImports?.enabled, false);
  assert.equal(biomeConfig.javascript?.formatter?.quoteStyle, 'single');
  assert.equal(biomeConfig.javascript?.formatter?.semicolons, 'always');
  assert.equal(biomeConfig.javascript?.formatter?.trailingCommas, 'all');
});
