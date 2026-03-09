const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

import type { FeedDefinition } from '../src/shared/contracts.ts';

type RecordedFetchCall = {
  url: string;
  init: RequestInit;
};

const {
  parseUpdateArgs,
  selectEnabledFeeds,
  fetchFeedDocument,
  runUpdatePipeline,
} = require('../scripts/pipeline/update.js');

function readWorkflow(): string {
  return fs.readFileSync(path.resolve(__dirname, '..', '.github/workflows/update-public-data.yml'), 'utf8');
}

const ENABLED_FEED: FeedDefinition = {
  id: 'enabled-feed',
  name: 'Enabled Feed',
  category: 'Examples',
  feedUrl: 'https://example.com/enabled.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
};

const DISABLED_FEED: FeedDefinition = {
  id: 'disabled-feed',
  name: 'Disabled Feed',
  category: 'Examples',
  feedUrl: 'https://example.com/disabled.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: false,
};

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example RSS</title>
    <item>
      <title>Workflow article</title>
      <link>https://example.com/workflow-article</link>
      <description><![CDATA[<p>Generated from workflow orchestration.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-1</guid>
    </item>
  </channel>
</rss>`;

test('parseUpdateArgs accepts --feeds, --output-dir, and --dry-run', () => {
  const parsed = parseUpdateArgs(['--feeds', 'fixtures/feeds.json', '--output-dir', 'tmp/public-data', '--dry-run']);

  assert.equal(parsed.dryRun, true);
  assert.match(parsed.feedsPath, /fixtures[\/]feeds\.json$/);
  assert.match(parsed.outputDir, /tmp[\/]public-data$/);
});

test('selectEnabledFeeds filters disabled feeds before network fetch', () => {
  const selected = selectEnabledFeeds([ENABLED_FEED, DISABLED_FEED]);
  assert.deepEqual(selected, [ENABLED_FEED]);
});

test('fetchFeedDocument requests feed XML with explicit headers', async () => {
  const calls: RecordedFetchCall[] = [];
  const response = {
    ok: true,
    text: async () => RSS_XML,
  };

  const document = await fetchFeedDocument(ENABLED_FEED, {
    fetchedAt: '2026-03-09T10:00:00Z',
    fetchImpl: async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return response;
    },
  });

  assert.equal(document.feedId, 'enabled-feed');
  assert.equal(document.fetchedAt, '2026-03-09T10:00:00.000Z');
  assert.equal(document.xml, RSS_XML);
  assert.equal(calls.length, 1);
  const [firstCall] = calls;
  assert.ok(firstCall);
  assert.equal(firstCall.url, 'https://example.com/enabled.xml');
  const requestHeaders = firstCall.init.headers as Record<string, string>;
  assert.equal(String(requestHeaders.accept).includes('application/rss+xml'), true);
  assert.match(String(requestHeaders['user-agent']), /FeedShelf\/0\.1/);
});

test('runUpdatePipeline fetches only enabled feeds and produces public summaries', async () => {
  const fsPromises = require('node:fs/promises');
  const os = require('node:os');

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'feedshelf-update-'));
  const feedsPath = path.join(tempDir, 'feeds.json');
  const outputDir = path.join(tempDir, 'public-data');
  const fetchCalls: string[] = [];

  await fsPromises.writeFile(feedsPath, JSON.stringify([ENABLED_FEED, DISABLED_FEED], null, 2));

  const summary = await runUpdatePipeline({
    feedsPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-09T10:00:00Z',
    fetchImpl: async (url: string) => {
      fetchCalls.push(url);
      return {
        ok: true,
        text: async () => RSS_XML,
      };
    },
    logger: {
      log() {},
    },
  });

  assert.deepEqual(fetchCalls, ['https://example.com/enabled.xml']);
  assert.equal(summary.enabledFeeds, 1);
  assert.equal(summary.totalFeeds, 2);
  assert.equal(summary.publicArticles, 1);

  const articles = JSON.parse(await fsPromises.readFile(path.join(outputDir, 'articles.json'), 'utf8'));
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Workflow article');
});

test('update workflow keeps update and deploy boundaries explicit', () => {
  const workflow = readWorkflow();

  assert.match(workflow, /^name: Update public data/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /pnpm run ci/);
  assert.match(workflow, /pnpm run pipeline:update/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.doesNotMatch(workflow, /actions\/deploy-pages@/);
});
