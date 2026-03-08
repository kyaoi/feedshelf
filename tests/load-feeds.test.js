const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { loadFeeds } = require('../scripts/pipeline/loadFeeds');
const { parseArgs, runPipeline } = require('../scripts/pipeline/run');

test('loadFeeds parses and validates feed definitions', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-load-'));
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        id: 'example-feed',
        name: 'Example Feed',
        category: 'Examples',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com/',
        language: 'en',
        enabled: true,
      },
    ]),
  );

  const feeds = await loadFeeds(feedsPath);
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].id, 'example-feed');
});

test('loadFeeds rejects missing required fields', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-invalid-'));
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        id: 'missing-enabled',
        name: 'Broken Feed',
        category: 'Broken',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com/',
        language: 'en',
      },
    ]),
  );

  await assert.rejects(loadFeeds(feedsPath), /must have boolean field: enabled/);
});

test('parseArgs accepts --feeds and --dry-run', () => {
  const parsed = parseArgs(['--feeds', 'fixtures/feeds.json', '--dry-run']);
  assert.equal(parsed.dryRun, true);
  assert.match(parsed.feedsPath, /fixtures[\\/]feeds\.json$/);
});

test('runPipeline returns feed counts for the configured file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-run-'));
  const feedsPath = path.join(tempDir, 'feeds.json');
  const lines = [];

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        id: 'feed-a',
        name: 'Feed A',
        category: 'General',
        feedUrl: 'https://example.com/a.xml',
        siteUrl: 'https://example.com/a',
        language: 'en',
        enabled: true,
      },
      {
        id: 'feed-b',
        name: 'Feed B',
        category: 'General',
        feedUrl: 'https://example.com/b.xml',
        siteUrl: 'https://example.com/b',
        language: 'en',
        enabled: false,
      },
    ]),
  );

  const summary = await runPipeline({
    feedsPath,
    dryRun: true,
    logger: {
      log(message) {
        lines.push(message);
      },
    },
  });

  assert.deepEqual(summary, {
    feedsPath,
    totalFeeds: 2,
    enabledFeeds: 1,
  });
  assert.match(lines.join('\n'), /FS-PIPE-01 entrypoint ready/);
});
