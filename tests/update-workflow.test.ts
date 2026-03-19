const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  parseUpdateArgs,
  selectEnabledFeeds,
  fetchFeedDocument,
  shouldPublishFromFetchedDocuments,
  validateFetchedFeedDocuments,
  resolveUpdateStatePath,
  loadUpdateState,
  buildNextUpdateState,
  runUpdatePipeline,
} = require('../scripts/pipeline/update.js');

function readWorkflow() {
  return fs.readFileSync(
    path.resolve(__dirname, '..', '.github/workflows/update-public-data.yml'),
    'utf8',
  );
}

const ENABLED_FEED = {
  id: 'enabled-feed',
  name: 'Enabled Feed',
  feedUrl: 'https://example.com/enabled.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
  shelfIds: ['examples'],
  tags: ['primary'],
};

const DISABLED_FEED = {
  id: 'disabled-feed',
  name: 'Disabled Feed',
  feedUrl: 'https://example.com/disabled.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: false,
  shelfIds: ['examples'],
};

const FAILING_FEED = {
  id: 'failing-feed',
  name: 'Failing Feed',
  feedUrl: 'https://example.com/failing.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
  shelfIds: ['examples'],
};

const SHELVES_YAML = `site:
  title: FeedShelf
  description: Discover articles by shelf
  intro: Curated shelves for reading
shelves:
  - id: examples
    title: Examples
    description: Example shelf
`;

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

test('resolveUpdateStatePath defaults to outputDir/update-state.json', () => {
  const statePath = resolveUpdateStatePath({
    outputDir: path.join('/tmp', 'feedshelf-public-data'),
  });

  assert.equal(
    statePath,
    path.join('/tmp', 'feedshelf-public-data', 'update-state.json'),
  );
});

test('parseUpdateArgs accepts --feeds, --shelves, --output-dir, and --dry-run', () => {
  const parsed = parseUpdateArgs([
    '--feeds',
    'fixtures/feeds.json',
    '--shelves',
    'fixtures/shelves.yaml',
    '--output-dir',
    'tmp/public-data',
    '--dry-run',
  ]);

  assert.equal(parsed.dryRun, true);
  assert.match(parsed.feedsPath, /fixtures[/]feeds\.json$/);
  assert.match(parsed.shelvesPath, /fixtures[/]shelves\.yaml$/);
  assert.match(parsed.outputDir, /tmp[/]public-data$/);
});

test('selectEnabledFeeds filters disabled feeds before network fetch', () => {
  const enabledFeeds = selectEnabledFeeds([
    ENABLED_FEED,
    DISABLED_FEED,
    FAILING_FEED,
  ]);

  assert.deepEqual(
    enabledFeeds.map((feed: { id: string }) => feed.id),
    ['enabled-feed', 'failing-feed'],
  );
});

test('fetchFeedDocument requests XML with static user agent', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const document = await fetchFeedDocument(ENABLED_FEED, {
    fetchImpl: async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async text() {
          return RSS_XML;
        },
      };
    },
    fetchedAt: '2026-03-09T09:10:11Z',
  });

  assert.equal(document.feedId, 'enabled-feed');
  assert.equal(document.fetchedAt, '2026-03-09T09:10:11.000Z');
  assert.equal(calls.length, 1);
  assert.match(
    new Headers(calls[0]?.init?.headers).get('user-agent') ?? '',
    /FeedShelf\/0\.1/,
  );
});

test('shouldPublishFromFetchedDocuments blocks empty publish attempts', () => {
  assert.deepEqual(
    shouldPublishFromFetchedDocuments({
      enabledFeeds: [],
      feedDocuments: [],
    }),
    {
      ok: false,
      reason: 'No enabled feeds are configured.',
    },
  );

  assert.deepEqual(
    shouldPublishFromFetchedDocuments({
      enabledFeeds: [ENABLED_FEED],
      feedDocuments: [],
    }),
    {
      ok: false,
      reason: 'No feed documents were publishable after fetch and validation.',
    },
  );
});

test('validateFetchedFeedDocuments skips source-level parse failures', () => {
  const result = validateFetchedFeedDocuments({
    feeds: [ENABLED_FEED],
    feedDocuments: [
      {
        feedId: 'enabled-feed',
        xml: RSS_XML,
        fetchedAt: '2026-03-09T09:10:11.000Z',
      },
      {
        feedId: 'enabled-feed',
        xml: '<html>not a feed</html>',
        fetchedAt: '2026-03-09T09:10:11.000Z',
      },
    ],
    logger: { log() {} },
  });

  assert.equal(result.publishableFeedDocuments.length, 1);
  assert.equal(result.failedFetches.length, 1);
  assert.equal(result.failedFetches[0].feedId, 'enabled-feed');
  assert.equal(result.failedFetches[0].stage, 'validate');
});

test('runUpdatePipeline keeps partial failures and passes shelvesPath through', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([ENABLED_FEED, FAILING_FEED, DISABLED_FEED]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const calls: string[] = [];
  const summary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-09T09:10:11Z',
    logger: { log() {} },
    fetchImpl: async (url: string) => {
      calls.push(url);
      if (String(url).includes('failing')) {
        throw new Error('boom');
      }

      return {
        ok: true,
        status: 200,
        async text() {
          return RSS_XML;
        },
      };
    },
  });

  assert.deepEqual(calls, [
    'https://example.com/enabled.xml',
    'https://example.com/failing.xml',
  ]);
  assert.equal(summary.attemptedFeeds, 2);
  assert.equal(summary.fetchedDocuments, 1);
  assert.equal(summary.failedFeeds, 1);
  assert.equal(summary.failedFetches[0].feedId, 'failing-feed');
  assert.equal(summary.failedFetches[0].stage, 'fetch');
  assert.equal(summary.publicShelves, 1);
  assert.equal(fs.existsSync(path.join(outputDir, 'shelves.json')), true);
});

test('runUpdatePipeline skips source-level validation failures but still publishes valid feeds', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');

  await fsp.writeFile(feedsPath, JSON.stringify([ENABLED_FEED, FAILING_FEED]));
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const summary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-09T09:10:11Z',
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        if (String(url).includes('failing')) {
          return '<html>not a feed</html>';
        }

        return RSS_XML;
      },
    }),
  });

  assert.equal(summary.attemptedFeeds, 2);
  assert.equal(summary.fetchedDocuments, 1);
  assert.equal(summary.failedFeeds, 1);
  assert.equal(summary.failedFetches[0].feedId, 'failing-feed');
  assert.equal(summary.failedFetches[0].stage, 'validate');
  assert.equal(fs.existsSync(path.join(outputDir, 'articles.json')), true);
});

test('runUpdatePipeline fails when every enabled feed fails before publish', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');

  await fsp.writeFile(feedsPath, JSON.stringify([ENABLED_FEED]));
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  await assert.rejects(
    runUpdatePipeline({
      feedsPath,
      shelvesPath,
      outputDir,
      dryRun: false,
      generatedAt: '2026-03-09T09:10:11Z',
      logger: { log() {} },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async text() {
          return '<html>not a feed</html>';
        },
      }),
    }),
    /No feed documents were publishable after fetch and validation\./,
  );
});

test('workflow file keeps public data update automation wired with cautious polling cadence and main push trigger', () => {
  const workflow = readWorkflow();
  assert.match(workflow, /push:/);
  assert.match(workflow, /branches:\n\s+- main/);
  assert.match(workflow, /cron:/);
  assert.match(workflow, /17 \*\/12 \* \* \*/);
  assert.match(workflow, /pnpm run pipeline:update/);
  assert.match(workflow, /path:\s*\.\/public/);
});

test('runUpdatePipeline applies canonicalization precision layer before publishing', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-canonicalization-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const hatenaXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hatena RSS</title>
    <item>
      <title>Workflow Hatena article</title>
      <link>https://b.hatena.ne.jp/entry/s/example.com/workflow-precision?b=2&amp;a=1&amp;utm_source=rss</link>
      <description><![CDATA[<p>Workflow precision layer.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-hatena-1</guid>
    </item>
  </channel>
</rss>`;

  await fsp.writeFile(feedsPath, JSON.stringify([ENABLED_FEED]));
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-09T09:10:11Z',
    logger: { log() {} },
    fetchImpl: async (url: string) => {
      if (String(url).includes('enabled.xml')) {
        return {
          ok: true,
          status: 200,
          url: String(url),
          headers: new Headers(),
          async text() {
            return hatenaXml;
          },
        };
      }

      if (String(url) === 'https://example.com/workflow-precision?a=1&b=2') {
        return {
          ok: false,
          status: 302,
          url: String(url),
          headers: new Headers({
            location: 'https://example.com/workflow-precision-final?b=2&a=1',
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        url: String(url),
        headers: new Headers(),
      };
    },
  });

  const publishedArticles = JSON.parse(
    await fsp.readFile(path.join(outputDir, 'articles.json'), 'utf8'),
  );
  assert.equal(
    publishedArticles[0].url,
    'https://example.com/workflow-precision-final?a=1&b=2',
  );
});

test('loadUpdateState keeps fuzzyTitleDate provenance entries', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-state-fuzzy-'),
  );
  const statePath = path.join(tempDir, 'update-state.json');

  await fsp.writeFile(
    statePath,
    JSON.stringify({
      version: 1,
      updatedAt: '2026-03-10T09:10:11.000Z',
      safetyWindowHours: 72,
      sources: {
        'rss-feed': {
          feedId: 'rss-feed',
          checkpointArticleId: 'shared-article',
          checkpointSortAt: '2026-03-10T09:00:00.000Z',
          lastSuccessfulFetchAt: '2026-03-10T09:10:11.000Z',
          provenance: [
            {
              feedId: 'rss-feed',
              firstSeenAt: '2026-03-10T09:05:00.000Z',
              lastSeenAt: '2026-03-10T09:05:00.000Z',
              sourceItemId: 'rss-shared',
              matchedBy: 'fuzzyTitleDate',
            },
          ],
        },
      },
    }),
  );

  const state = await loadUpdateState(statePath);
  assert.deepEqual(state?.sources['rss-feed']?.provenance, [
    {
      feedId: 'rss-feed',
      firstSeenAt: '2026-03-10T09:05:00.000Z',
      lastSeenAt: '2026-03-10T09:05:00.000Z',
      sourceItemId: 'rss-shared',
      matchedBy: 'fuzzyTitleDate',
    },
  ]);
});

test('runUpdatePipeline writes update-state.json and retains previously published articles', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-state-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');

  await fsp.writeFile(feedsPath, JSON.stringify([ENABLED_FEED]));
  await fsp.writeFile(shelvesPath, SHELVES_YAML);
  await fsp.mkdir(outputDir, { recursive: true });
  await fsp.writeFile(
    path.join(outputDir, 'articles.json'),
    JSON.stringify([
      {
        id: 'retained-article',
        title: 'Retained Article',
        url: 'https://example.com/retained-article',
        sourceId: 'enabled-feed',
        sourceName: 'Enabled Feed',
        shelfIds: ['examples'],
        sourceTags: ['primary'],
        entryTags: [],
        publishedAt: '2026-03-08T00:00:00.000Z',
        sortAt: '2026-03-08T00:00:00.000Z',
        summary: 'Retained summary',
        excerpt: 'Retained summary',
        language: 'en',
      },
    ]),
  );

  const summary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-09T09:10:11Z',
    logger: { log() {} },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async text() {
        return RSS_XML;
      },
    }),
  });

  assert.equal(summary.publicArticles, 2);
  const statePath = resolveUpdateStatePath({ outputDir });
  const state = await loadUpdateState(statePath);
  assert.ok(state);
  assert.equal(state?.version, 1);
  assert.equal(
    state?.sources['enabled-feed']?.lastSuccessfulFetchAt,
    '2026-03-09T09:10:11.000Z',
  );
  assert.equal(
    state?.sources['enabled-feed']?.checkpointSortAt,
    '2026-03-09T09:00:00.000Z',
  );
  assert.deepEqual(state?.sources['enabled-feed']?.provenance, [
    {
      feedId: 'enabled-feed',
      firstSeenAt: '2026-03-09T09:10:11.000Z',
      lastSeenAt: '2026-03-09T09:10:11.000Z',
      sourceItemId: 'workflow-1',
      matchedBy: 'primary',
    },
  ]);

  const publishedArticles = JSON.parse(
    await fsp.readFile(path.join(outputDir, 'articles.json'), 'utf8'),
  );
  assert.deepEqual(
    publishedArticles.map((article: { title: string }) => article.title),
    ['Workflow article', 'Retained Article'],
  );
  assert.equal(publishedArticles[1].id, 'retained-article');
});

test('buildNextUpdateState updates source checkpoints for every feed present in provenance', () => {
  const nextState = buildNextUpdateState({
    previousState: null,
    freshArticles: [
      {
        id: 'shared-article',
        feedId: 'atom-feed',
        sourceName: 'Atom Feed',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Shared article',
        url: 'https://example.com/shared',
        summary: 'Shared summary',
        publishedAt: '2026-03-10T09:00:00.000Z',
        fetchedAt: '2026-03-10T09:10:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['primary'],
        entryTags: ['shared'],
        sourceItemId: 'atom-shared',
        provenance: [
          {
            feedId: 'atom-feed',
            firstSeenAt: '2026-03-10T09:10:00.000Z',
            lastSeenAt: '2026-03-10T09:10:00.000Z',
            sourceItemId: 'atom-shared',
            matchedBy: 'primary',
          },
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-10T09:05:00.000Z',
            lastSeenAt: '2026-03-10T09:05:00.000Z',
            sourceItemId: 'rss-shared',
            matchedBy: 'normalizedUrl',
          },
        ],
        seenInFeeds: ['atom-feed', 'rss-feed'],
      },
    ],
    generatedAt: '2026-03-10T09:10:11.000Z',
    safetyWindowHours: 72,
  });

  assert.equal(
    nextState.sources['atom-feed']?.checkpointArticleId,
    'shared-article',
  );
  assert.equal(
    nextState.sources['rss-feed']?.checkpointArticleId,
    'shared-article',
  );
  assert.equal(
    nextState.sources['rss-feed']?.checkpointSortAt,
    '2026-03-10T09:00:00.000Z',
  );
  assert.deepEqual(nextState.sources['rss-feed']?.provenance, [
    {
      feedId: 'atom-feed',
      firstSeenAt: '2026-03-10T09:10:00.000Z',
      lastSeenAt: '2026-03-10T09:10:00.000Z',
      sourceItemId: 'atom-shared',
      matchedBy: 'primary',
    },
    {
      feedId: 'rss-feed',
      firstSeenAt: '2026-03-10T09:05:00.000Z',
      lastSeenAt: '2026-03-10T09:05:00.000Z',
      sourceItemId: 'rss-shared',
      matchedBy: 'normalizedUrl',
    },
  ]);
});
