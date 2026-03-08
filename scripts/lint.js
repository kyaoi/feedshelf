const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { loadFeeds } = require('./pipeline/loadFeeds');

const FILES_TO_CHECK = [
  'scripts/lint.js',
  'scripts/pipeline/loadFeeds.js',
  'scripts/pipeline/dedupeArticles.js',
  'scripts/pipeline/buildPublicExports.js',
  'scripts/pipeline/run.js',
  'scripts/pipeline/normalizeFeed.js',
  'tests/load-feeds.test.js',
];

async function main() {
  const rootDir = path.resolve(__dirname, '..');

  for (const relativePath of FILES_TO_CHECK) {
    execFileSync(process.execPath, ['--check', path.join(rootDir, relativePath)], {
      stdio: 'inherit',
    });
  }

  await loadFeeds(path.join(rootDir, 'data/feeds.json'));
  console.log('[lint] OK');
}

main().catch((error) => {
  console.error('[lint] failed', error);
  process.exit(1);
});
