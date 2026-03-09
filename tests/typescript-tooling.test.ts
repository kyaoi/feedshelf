const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8'));
}

test('package scripts expose the TypeScript execution baseline', () => {
  const packageJson = readJson('package.json');

  assert.equal(packageJson.scripts['pipeline:run'], 'tsx scripts/pipeline/run.js');
  assert.equal(packageJson.scripts.lint, 'tsx scripts/lint.ts');
  assert.equal(packageJson.scripts.test, 'tsx --test tests/*.test.ts');
  assert.equal(packageJson.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageJson.scripts['build:web-ui'], 'tsc -p tsconfig.web.json');
  assert.equal(packageJson.scripts.build, 'pnpm run build:web-ui');
  assert.equal(packageJson.scripts['verify:web-ui'], 'tsx scripts/verifyWebBuild.ts');
  assert.match(packageJson.scripts.ci, /pnpm run typecheck/);
  assert.match(packageJson.scripts.ci, /pnpm run verify:web-ui/);
});

test('tsconfig keeps JS/TS coexistence enabled during the first migration step', () => {
  const tsconfig = readJson('tsconfig.json');
  const compilerOptions = tsconfig.compilerOptions || {};

  assert.equal(compilerOptions.allowJs, true);
  assert.equal(compilerOptions.checkJs, false);
  assert.equal(compilerOptions.noEmit, true);
  assert.equal(compilerOptions.allowImportingTsExtensions, true);
  assert.equal(compilerOptions.moduleDetection, 'force');
  assert.equal(compilerOptions.module, 'CommonJS');
  assert.equal(compilerOptions.moduleResolution, 'Node');
  assert.deepEqual(compilerOptions.types, ['node']);
  assert.ok(Array.isArray(tsconfig.include));
  assert.ok(tsconfig.include.includes('src/**/*.ts'));
  assert.ok(tsconfig.include.includes('scripts/**/*.ts'));
  assert.ok(tsconfig.include.includes('scripts/**/*.js'));
  assert.ok(tsconfig.include.includes('tests/**/*.ts'));
  assert.ok(!tsconfig.include.includes('tests/**/*.js'));
  assert.ok(!tsconfig.include.includes('public/assets/**/*.js'));
});

test('web UI build and verify config are present', () => {
  const webTsconfig = readJson('tsconfig.web.json');
  const compilerOptions = webTsconfig.compilerOptions || {};

  assert.equal(compilerOptions.noEmit, false);
  assert.equal(compilerOptions.allowJs, false);
  assert.equal(compilerOptions.allowImportingTsExtensions, false);
  assert.equal(compilerOptions.module, 'none');
  assert.equal(compilerOptions.rootDir, 'src/web');
  assert.equal(compilerOptions.outDir, 'public/assets');
  assert.equal(compilerOptions.moduleDetection, 'auto');
  assert.ok(Array.isArray(webTsconfig.include));
  assert.deepEqual(webTsconfig.include, ['src/web/app.ts']);

  assert.equal(fs.existsSync(path.resolve(__dirname, '..', 'src/web/app.ts')), true);
  assert.equal(fs.existsSync(path.resolve(__dirname, '..', 'scripts/lint.ts')), true);
  assert.equal(fs.existsSync(path.resolve(__dirname, '..', 'scripts/verifyWebBuild.ts')), true);
});
