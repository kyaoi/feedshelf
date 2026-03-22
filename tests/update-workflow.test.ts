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

test('parseUpdateArgs accepts --feeds, --shelves, --output-dir, --dry-run, --disable-fuzzy-dedupe, --fuzzy-audit-file, --fuzzy-handoff-file, --fuzzy-reject-file, --fuzzy-accept-file, --fuzzy-review-state-file, and --fuzzy-review-html-file', () => {
  const parsed = parseUpdateArgs([
    '--feeds',
    'fixtures/feeds.json',
    '--shelves',
    'fixtures/shelves.yaml',
    '--output-dir',
    'tmp/public-data',
    '--dry-run',
    '--disable-fuzzy-dedupe',
    '--fuzzy-audit-file',
    'tmp/fuzzy-audit.json',
    '--fuzzy-handoff-file',
    'tmp/fuzzy-handoff.json',
    '--fuzzy-reject-file',
    'tmp/fuzzy-reject.json',
    '--fuzzy-accept-file',
    'tmp/fuzzy-accept.json',
    '--fuzzy-review-state-file',
    'tmp/fuzzy-review-state.json',
    '--fuzzy-review-html-file',
    'tmp/fuzzy-review.html',
  ]);

  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.disableFuzzyDedupe, true);
  assert.match(parsed.fuzzyAuditPath ?? '', /tmp[/]fuzzy-audit\.json$/);
  assert.match(parsed.fuzzyHandoffPath ?? '', /tmp[/]fuzzy-handoff\.json$/);
  assert.match(parsed.fuzzyRejectPath ?? '', /tmp[/]fuzzy-reject\.json$/);
  assert.match(parsed.fuzzyAcceptPath ?? '', /tmp[/]fuzzy-accept\.json$/);
  assert.match(
    parsed.fuzzyReviewStatePath ?? '',
    /tmp[/]fuzzy-review-state\.json$/,
  );
  assert.match(parsed.fuzzyReviewHtmlPath ?? '', /tmp[/]fuzzy-review\.html$/);
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

test('runUpdatePipeline reports fuzzyDuplicatesCollapsed and supports disableFuzzyDedupe', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-summary-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const enabledOutputDir = path.join(tempDir, 'enabled-public-data');
  const disabledOutputDir = path.join(tempDir, 'disabled-public-data');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'first-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/first.xml',
      },
      {
        ...ENABLED_FEED,
        id: 'second-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/second.xml',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title>Workflow article</title>
      <link>https://example.com/workflow-article-a</link>
      <description><![CDATA[<p>First copy.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title> workflow   article </title>
      <link>https://example.com/workflow-article-b</link>
      <description><![CDATA[<p>Second copy with more detail.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>workflow-b</guid>
    </item>
  </channel>
</rss>`;

  const enabledSummary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir: enabledOutputDir,
    dryRun: false,
    generatedAt: '2026-03-11T09:10:11Z',
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  assert.equal(enabledSummary.duplicatesCollapsed, 1);
  assert.equal(enabledSummary.fuzzyDuplicatesCollapsed, 1);
  assert.equal(enabledSummary.publicArticles, 1);

  const disabledSummary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir: disabledOutputDir,
    dryRun: false,
    generatedAt: '2026-03-11T09:10:11Z',
    disableFuzzyDedupe: true,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  assert.equal(disabledSummary.duplicatesCollapsed, 0);
  assert.equal(disabledSummary.fuzzyDuplicatesCollapsed, 0);
  assert.equal(disabledSummary.publicArticles, 2);
});

test('runUpdatePipeline applies allowlisted source-family fuzzy fallback for sibling feed title matches within 72 hours', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-family-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'qiita-popular',
        name: 'Qiita Popular',
        feedUrl: 'https://example.com/qiita-popular.xml',
        fuzzySourceFamilyKey: 'qiita',
      },
      {
        ...ENABLED_FEED,
        id: 'qiita-rust',
        name: 'Qiita Rust Tag',
        feedUrl: 'https://example.com/qiita-rust.xml',
        fuzzySourceFamilyKey: 'qiita',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Qiita Popular</title>
    <item>
      <title>Qiita shared article</title>
      <link>https://qiita.com/example/items/shared-a</link>
      <description><![CDATA[<p>First copy.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>qiita-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Qiita Rust Tag</title>
    <item>
      <title> qiita shared article </title>
      <link>https://qiita.com/example/items/shared-b</link>
      <description><![CDATA[<p>Second copy with more detail.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>qiita-b</guid>
    </item>
  </channel>
</rss>`;

  const summary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyAuditPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('qiita-rust') ? secondXml : firstXml;
      },
    }),
  });

  assert.equal(summary.duplicatesCollapsed, 1);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 1);
  assert.equal(summary.publicArticles, 1);

  const fuzzyAudit = JSON.parse(await fsp.readFile(fuzzyAuditPath, 'utf8'));
  assert.equal(fuzzyAudit.length, 1);
  assert.equal(fuzzyAudit[0].winnerFeedId, 'qiita-rust');
  assert.equal(fuzzyAudit[0].incomingFeedId, 'qiita-rust');
  assert.equal(fuzzyAudit[0].titleCompareKey, 'qiita shared article');
  assert.equal(fuzzyAudit[0].publishedAtDeltaHours, 48);
  assert.equal(fuzzyAudit[0].matchedBy, 'fuzzyTitleDate');
});

test('runUpdatePipeline applies broader punctuation-folded fuzzy fallback for same-source title matches within 72 hours', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-punct-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'first-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/first.xml',
      },
      {
        ...ENABLED_FEED,
        id: 'second-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/second.xml',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title>Workflow: article (update)</title>
      <link>https://example.com/workflow-article-a</link>
      <description><![CDATA[<p>First copy.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title> workflow article update </title>
      <link>https://example.com/workflow-article-b</link>
      <description><![CDATA[<p>Second copy with more detail.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>workflow-b</guid>
    </item>
  </channel>
</rss>`;

  const summary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyAuditPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  assert.equal(summary.duplicatesCollapsed, 1);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 1);
  assert.equal(summary.publicArticles, 1);

  const fuzzyAudit = JSON.parse(await fsp.readFile(fuzzyAuditPath, 'utf8'));
  assert.equal(fuzzyAudit.length, 1);
  assert.equal(fuzzyAudit[0].winnerFeedId, 'second-feed');
  assert.equal(fuzzyAudit[0].incomingFeedId, 'second-feed');
  assert.equal(fuzzyAudit[0].titleCompareKey, 'workflow article update');
  assert.equal(fuzzyAudit[0].publishedAtDeltaHours, 48);
  assert.equal(fuzzyAudit[0].matchedBy, 'fuzzyTitleDate');
});

test('runUpdatePipeline writes fuzzy audit JSON when --fuzzy-audit-file is provided', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-audit-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'first-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/first.xml',
      },
      {
        ...ENABLED_FEED,
        id: 'second-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/second.xml',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title>Workflow article</title>
      <link>https://example.com/workflow-article-a</link>
      <description><![CDATA[<p>First copy.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title> workflow   article </title>
      <link>https://example.com/workflow-article-b</link>
      <description><![CDATA[<p>Second copy with more detail.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>workflow-b</guid>
    </item>
  </channel>
</rss>`;

  await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyAuditPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  const fuzzyAudit = JSON.parse(await fsp.readFile(fuzzyAuditPath, 'utf8'));
  assert.equal(fuzzyAudit.length, 1);
  assert.equal(fuzzyAudit[0].winnerFeedId, 'second-feed');
  assert.equal(fuzzyAudit[0].incomingFeedId, 'second-feed');
  assert.equal(fuzzyAudit[0].titleCompareKey, 'workflow article');
  assert.equal(fuzzyAudit[0].publishedAtDeltaHours, 48);
  assert.equal(fuzzyAudit[0].matchedBy, 'fuzzyTitleDate');
  assert.equal(typeof fuzzyAudit[0].winnerArticleId, 'string');
  assert.equal(typeof fuzzyAudit[0].incomingArticleId, 'string');
});

test('runUpdatePipeline writes fuzzy handoff JSON when --fuzzy-handoff-file is provided', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-handoff-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyHandoffPath = path.join(tempDir, 'reports', 'fuzzy-handoff.json');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'first-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/first.xml',
      },
      {
        ...ENABLED_FEED,
        id: 'second-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/second.xml',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title>Workflow article</title>
      <link>https://example.com/workflow-article-a</link>
      <description><![CDATA[<p>First copy.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title> workflow   article </title>
      <link>https://example.com/workflow-article-b</link>
      <description><![CDATA[<p>Second copy with more detail.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>workflow-b</guid>
    </item>
  </channel>
</rss>`;

  await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: false,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyHandoffPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  const fuzzyHandoff = JSON.parse(await fsp.readFile(fuzzyHandoffPath, 'utf8'));
  assert.equal(fuzzyHandoff.length, 1);
  assert.equal(fuzzyHandoff[0].winnerFeedId, 'second-feed');
  assert.equal(fuzzyHandoff[0].incomingFeedId, 'second-feed');
  assert.equal(fuzzyHandoff[0].titleCompareKey, 'workflow article');
  assert.equal(fuzzyHandoff[0].publishedAtDeltaHours, 48);
  assert.equal(fuzzyHandoff[0].matchedBy, 'fuzzyTitleDate');
  assert.equal(fuzzyHandoff[0].winnerTitle, 'workflow article');
  assert.equal(fuzzyHandoff[0].incomingTitle, 'workflow article');
  assert.equal(
    fuzzyHandoff[0].winnerUrl,
    'https://example.com/workflow-article-b',
  );
  assert.equal(
    fuzzyHandoff[0].incomingUrl,
    'https://example.com/workflow-article-b',
  );
  assert.equal(fuzzyHandoff[0].winnerSourceName, 'Shared Source');
  assert.equal(fuzzyHandoff[0].incomingSourceName, 'Shared Source');
});

test('runUpdatePipeline suppresses fuzzy merges when --fuzzy-reject-file is provided', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-reject-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyHandoffPath = path.join(tempDir, 'reports', 'fuzzy-handoff.json');
  const fuzzyRejectPath = path.join(tempDir, 'reports', 'fuzzy-reject.json');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'first-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/first.xml',
      },
      {
        ...ENABLED_FEED,
        id: 'second-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/second.xml',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title>Workflow article</title>
      <link>https://example.com/workflow-article-a</link>
      <description><![CDATA[<p>First copy with richer detail that should stay primary.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title> workflow   article </title>
      <link>https://example.com/workflow-article-b</link>
      <description><![CDATA[<p>Second copy.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>workflow-b</guid>
    </item>
  </channel>
</rss>`;

  await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: true,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyHandoffPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  const fuzzyHandoff = JSON.parse(await fsp.readFile(fuzzyHandoffPath, 'utf8'));
  await fsp.mkdir(path.dirname(fuzzyRejectPath), { recursive: true });
  await fsp.writeFile(
    fuzzyRejectPath,
    JSON.stringify([
      {
        articleIdPair: [
          fuzzyHandoff[0].winnerArticleId,
          fuzzyHandoff[0].incomingArticleId,
        ],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: fuzzyHandoff[0].winnerTitle,
        incomingTitle: fuzzyHandoff[0].incomingTitle,
        note: 'known false positive',
      },
    ]),
  );

  const summary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'rejected-public-data'),
    dryRun: true,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyRejectPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  assert.equal(summary.dedupedArticles, 2);
  assert.equal(summary.duplicatesCollapsed, 0);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 0);
  assert.equal(summary.publicArticles, 2);
});

test('runUpdatePipeline writes canonical fuzzy review-state JSON when --fuzzy-review-state-file is provided', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-review-state-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyRejectPath = path.join(tempDir, 'reports', 'fuzzy-reject.json');
  const fuzzyAcceptPath = path.join(tempDir, 'reports', 'fuzzy-accept.json');
  const fuzzyReviewStatePath = path.join(
    tempDir,
    'reports',
    'fuzzy-review-state.json',
  );

  await fsp.writeFile(feedsPath, JSON.stringify([ENABLED_FEED]));
  await fsp.writeFile(shelvesPath, SHELVES_YAML);
  await fsp.mkdir(path.dirname(fuzzyRejectPath), { recursive: true });
  await fsp.writeFile(
    fuzzyRejectPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-b', 'article-fuzzy-a'],
        matchedBy: 'fuzzyTitleDate',
        note: 'known false positive',
      },
    ]),
  );
  await fsp.writeFile(
    fuzzyAcceptPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-d', 'article-fuzzy-c'],
        matchedBy: 'fuzzyTitleDate',
        note: 'reviewed true positive',
      },
      {
        articleIdPair: ['article-fuzzy-c', 'article-fuzzy-d'],
        matchedBy: 'fuzzyTitleDate',
        incomingTitle: 'Incoming Title',
      },
    ]),
  );

  await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: true,
    generatedAt: '2026-03-12T09:10:11Z',
    fuzzyRejectPath,
    fuzzyAcceptPath,
    fuzzyReviewStatePath,
    logger: { log() {} },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async text() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <item>
      <title>Workflow review state</title>
      <link>https://example.com/review-state</link>
      <description><![CDATA[<p>Example.</p>]]></description>
      <pubDate>Thu, 12 Mar 2026 09:00:00 +0000</pubDate>
      <guid>review-state</guid>
    </item>
  </channel>
</rss>`;
      },
    }),
  });

  assert.deepEqual(
    JSON.parse(await fsp.readFile(fuzzyReviewStatePath, 'utf8')),
    {
      accepted: [
        {
          articleIdPair: ['article-fuzzy-c', 'article-fuzzy-d'],
          matchedBy: 'fuzzyTitleDate',
          incomingTitle: 'Incoming Title',
          note: 'reviewed true positive',
        },
      ],
      rejected: [
        {
          articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
          matchedBy: 'fuzzyTitleDate',
          note: 'known false positive',
        },
      ],
    },
  );
});

test('runUpdatePipeline writes fuzzy review HTML when --fuzzy-review-html-file is provided', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-review-html-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyRejectPath = path.join(tempDir, 'reports', 'fuzzy-reject.json');
  const fuzzyAcceptPath = path.join(tempDir, 'reports', 'fuzzy-accept.json');
  const fuzzyReviewHtmlPath = path.join(
    tempDir,
    'reports',
    'fuzzy-review.html',
  );

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'first-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/first.xml',
      },
      {
        ...ENABLED_FEED,
        id: 'second-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/second.xml',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);
  await fsp.mkdir(path.dirname(fuzzyRejectPath), { recursive: true });
  await fsp.writeFile(
    fuzzyRejectPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-b', 'article-fuzzy-a'],
        matchedBy: 'fuzzyTitleDate',
        note: 'known false positive',
      },
    ]),
  );
  await fsp.writeFile(
    fuzzyAcceptPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-d', 'article-fuzzy-c'],
        matchedBy: 'fuzzyTitleDate',
        incomingTitle: 'Incoming Title',
        note: 'reviewed true positive',
      },
    ]),
  );

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title>Workflow article</title>
      <link>https://example.com/workflow-article-a</link>
      <description><![CDATA[<p>First copy with richer detail that should stay primary.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title> workflow   article </title>
      <link>https://example.com/workflow-article-b</link>
      <description><![CDATA[<p>Second copy.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>workflow-b</guid>
    </item>
  </channel>
</rss>`;

  await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: true,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyRejectPath,
    fuzzyAcceptPath,
    fuzzyReviewHtmlPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  const html = await fsp.readFile(fuzzyReviewHtmlPath, 'utf8');

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>FeedShelf fuzzy review<\/title>/);
  assert.match(html, /Workflow article/);
  assert.match(html, /workflow article/);
  assert.match(html, /https:\/\/example\.com\/workflow-article-a/);
  assert.match(html, /https:\/\/example\.com\/workflow-article-b/);
  assert.match(html, /Shared Source/);
  assert.match(html, /status-badge--unreviewed/);
  assert.match(html, /status-badge--accepted/);
  assert.match(html, /status-badge--rejected/);
  assert.match(html, /reviewed true positive/);
  assert.match(html, /known false positive/);
  assert.doesNotMatch(html, /localStorage/);
  assert.doesNotMatch(html, /<form/i);
});

test('runUpdatePipeline suppresses repeat fuzzy audit and handoff records when --fuzzy-accept-file is provided', async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-update-fuzzy-accept-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');
  const fuzzyHandoffPath = path.join(tempDir, 'reports', 'fuzzy-handoff.json');
  const fuzzyAcceptPath = path.join(tempDir, 'reports', 'fuzzy-accept.json');

  await fsp.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...ENABLED_FEED,
        id: 'first-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/first.xml',
      },
      {
        ...ENABLED_FEED,
        id: 'second-feed',
        name: 'Shared Source',
        feedUrl: 'https://example.com/second.xml',
      },
    ]),
  );
  await fsp.writeFile(shelvesPath, SHELVES_YAML);

  const firstXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title>Workflow article</title>
      <link>https://example.com/workflow-article-a</link>
      <description><![CDATA[<p>First copy with richer detail that should stay primary.</p>]]></description>
      <pubDate>Mon, 09 Mar 2026 09:00:00 +0000</pubDate>
      <guid>workflow-a</guid>
    </item>
  </channel>
</rss>`;
  const secondXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <item>
      <title> workflow   article </title>
      <link>https://example.com/workflow-article-b</link>
      <description><![CDATA[<p>Second copy.</p>]]></description>
      <pubDate>Wed, 11 Mar 2026 08:59:59 +0000</pubDate>
      <guid>workflow-b</guid>
    </item>
  </channel>
</rss>`;

  await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    dryRun: true,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyHandoffPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  const fuzzyHandoff = JSON.parse(await fsp.readFile(fuzzyHandoffPath, 'utf8'));
  await fsp.mkdir(path.dirname(fuzzyAcceptPath), { recursive: true });
  await fsp.writeFile(
    fuzzyAcceptPath,
    JSON.stringify([
      {
        articleIdPair: [
          fuzzyHandoff[0].winnerArticleId,
          fuzzyHandoff[0].incomingArticleId,
        ],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: fuzzyHandoff[0].winnerTitle,
        incomingTitle: fuzzyHandoff[0].incomingTitle,
        note: 'reviewed true positive',
      },
    ]),
  );

  const summary = await runUpdatePipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'accepted-public-data'),
    dryRun: true,
    generatedAt: '2026-03-11T09:10:11Z',
    fuzzyAuditPath,
    fuzzyHandoffPath: path.join(tempDir, 'reports', 'accepted-handoff.json'),
    fuzzyAcceptPath,
    logger: { log() {} },
    fetchImpl: async (url: string) => ({
      ok: true,
      status: 200,
      async text() {
        return String(url).includes('second') ? secondXml : firstXml;
      },
    }),
  });

  const fuzzyAudit = JSON.parse(await fsp.readFile(fuzzyAuditPath, 'utf8'));
  const acceptedHandoff = JSON.parse(
    await fsp.readFile(
      path.join(tempDir, 'reports', 'accepted-handoff.json'),
      'utf8',
    ),
  );

  assert.equal(summary.dedupedArticles, 1);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 1);
  assert.deepEqual(fuzzyAudit, []);
  assert.deepEqual(acceptedHandoff, []);
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
        alsoSeenInSourceIds: ['legacy-feed'],
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
  assert.equal(publishedArticles[0].alsoSeenInSourceIds, undefined);
  assert.equal(publishedArticles[1].id, 'retained-article');
  assert.deepEqual(publishedArticles[1].alsoSeenInSourceIds, ['legacy-feed']);
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
