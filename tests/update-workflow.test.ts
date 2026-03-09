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
  shouldPublishFromFetchedDocuments,
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

const FAILING_FEED: FeedDefinition = {
  id: 'failing-feed',
  name: 'Failing Feed',
  category: 'Examples',
  feedUrl: 'https://example.com/failing.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
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

test('shouldPublishFromFetchedDocuments refuses deploy when no enabled feed succeeded', () => {
  const noEnabled = shouldPublishFromFetchedDocuments({
    enabledFeeds: [],
    feedDocuments: [],
  });
  assert.deepEqual(noEnabled, {
    ok: false,
    reason: 'No enabled feeds were configured; refusing to publish an empty update.',
  });

  const allFailed = shouldPublishFromFetchedDocuments({
    enabledFeeds: [ENABLED_FEED, FAILING_FEED],
    feedDocuments: [],
  });
  assert.deepEqual(allFailed, {
    ok: false,
    reason: 'All enabled feeds failed to fetch; deploy will be skipped to preserve the previous site.',
  });
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
  assert.equal(summary.attemptedFeeds, 1);
  assert.equal(summary.fetchedDocuments, 1);
  assert.equal(summary.failedFeeds, 0);
  assert.deepEqual(summary.failedFetches, []);

  const articles = JSON.parse(await fsPromises.readFile(path.join(outputDir, 'articles.json'), 'utf8'));
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Workflow article');
});

test('runUpdatePipeline keeps successful feeds when another feed fails', async () => {
  const fsPromises = require('node:fs/promises');
  const os = require('node:os');

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'feedshelf-update-partial-'));
  const feedsPath = path.join(tempDir, 'feeds.json');
  const outputDir = path.join(tempDir, 'public-data');
  const logMessages: string[] = [];

  await fsPromises.writeFile(feedsPath, JSON.stringify([ENABLED_FEED, FAILING_FEED], null, 2));

  const summary = await runUpdatePipeline({
    feedsPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-09T10:00:00Z',
    fetchImpl: async (url: string) => {
      if (url.includes('failing.xml')) {
        throw new Error('network timeout');
      }
      return {
        ok: true,
        text: async () => RSS_XML,
      };
    },
    logger: {
      log(message: string) {
        logMessages.push(message);
      },
    },
  });

  assert.equal(summary.attemptedFeeds, 2);
  assert.equal(summary.fetchedDocuments, 1);
  assert.equal(summary.failedFeeds, 1);
  assert.deepEqual(summary.failedFetches, [
    {
      feedId: 'failing-feed',
      feedUrl: 'https://example.com/failing.xml',
      message: 'network timeout',
    },
  ]);
  assert.equal(summary.publicArticles, 1);
  assert.ok(logMessages.some((message) => message.includes('fetch-failed failing-feed network timeout')));
  assert.ok(logMessages.some((message) => message.includes('partial-failure: continuing with fetched feeds only')));
});

test('runUpdatePipeline fails the build when every enabled feed fails', async () => {
  const fsPromises = require('node:fs/promises');
  const os = require('node:os');

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'feedshelf-update-fail-'));
  const feedsPath = path.join(tempDir, 'feeds.json');
  const outputDir = path.join(tempDir, 'public-data');
  const logMessages: string[] = [];

  await fsPromises.writeFile(feedsPath, JSON.stringify([FAILING_FEED], null, 2));

  await assert.rejects(
    runUpdatePipeline({
      feedsPath,
      outputDir,
      dryRun: false,
      generatedAt: '2026-03-09T10:00:00Z',
      fetchImpl: async () => {
        throw new Error('network timeout');
      },
      logger: {
        log(message: string) {
          logMessages.push(message);
        },
      },
    }),
    /All enabled feeds failed to fetch; deploy will be skipped to preserve the previous site\./,
  );

  assert.ok(logMessages.some((message) => message.includes('publish-skipped All enabled feeds failed to fetch')));
});

test('update workflow keeps build and deploy boundaries explicit', () => {
  const workflow = readWorkflow();

  assert.match(workflow, /^name: Update public data/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /build-public-data:/);
  assert.match(workflow, /deploy-github-pages:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /pnpm run ci/);
  assert.match(workflow, /pnpm run pipeline:update/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /needs: build-public-data/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /name: github-pages/);
  assert.match(workflow, /url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
