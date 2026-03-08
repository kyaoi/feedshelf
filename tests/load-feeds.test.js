const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { loadFeeds } = require('../scripts/pipeline/loadFeeds');
const { normalizeFeedDocument, normalizeUrl } = require('../scripts/pipeline/normalizeFeed');
const { parseArgs, runPipeline } = require('../scripts/pipeline/run');

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Example RSS</title>
    <item>
      <title>  RSS title  </title>
      <link>https://example.com/articles/1?utm_source=rss&amp;b=2&amp;a=1#fragment</link>
      <description><![CDATA[<p>Hello <strong>RSS</strong> world.</p>]]></description>
      <pubDate>Fri, 07 Mar 2026 09:00:00 +0900</pubDate>
      <guid>rss-item-1</guid>
      <author>rss@example.com (RSS Author)</author>
      <media:content url="https://example.com/image.jpg" medium="image" />
    </item>
    <item>
      <title></title>
      <link>https://example.com/skip</link>
    </item>
  </channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Example Atom</title>
  <entry>
    <title>Atom title</title>
    <link rel="alternate" href="https://example.com/atom?b=2&amp;utm_medium=email&amp;a=1" />
    <id>tag:example.com,2026:atom-1</id>
    <updated>2026-03-08T01:02:03Z</updated>
    <summary type="html">&lt;p&gt;Atom &lt;em&gt;summary&lt;/em&gt;.&lt;/p&gt;</summary>
    <author>
      <name>Atom Author</name>
    </author>
  </entry>
</feed>`;

const RSS_FEED = {
  id: 'rss-feed',
  name: 'Example RSS',
  category: 'Examples',
  feedUrl: 'https://example.com/rss.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
};

const ATOM_FEED = {
  id: 'atom-feed',
  name: 'Example Atom',
  category: 'Examples',
  feedUrl: 'https://example.com/atom.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
};

test('loadFeeds parses and validates feed definitions', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-load-'));
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED]));

  const feeds = await loadFeeds(feedsPath);
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].id, 'rss-feed');
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

test('normalizeUrl keeps safe canonicalization only', () => {
  assert.equal(
    normalizeUrl('HTTPS://Example.COM:443/path/?utm_source=rss&b=2&a=1#top'),
    'https://example.com/path?a=1&b=2',
  );
});

test('normalizeFeedDocument converts RSS items into canonical article objects', () => {
  const articles = normalizeFeedDocument({
    feed: RSS_FEED,
    xml: RSS_XML,
    fetchedAt: '2026-03-08T06:00:00Z',
  });

  assert.equal(articles.length, 1);
  assert.deepEqual(articles[0], {
    id: articles[0].id,
    feedId: 'rss-feed',
    sourceName: 'Example RSS',
    category: 'Examples',
    language: 'en',
    title: 'RSS title',
    url: 'https://example.com/articles/1?utm_source=rss&b=2&a=1#fragment',
    summary: 'Hello RSS world.',
    publishedAt: '2026-03-07T00:00:00.000Z',
    fetchedAt: '2026-03-08T06:00:00.000Z',
    author: 'rss@example.com (RSS Author)',
    imageUrl: 'https://example.com/image.jpg',
    tags: [],
    sourceItemId: 'rss-item-1',
    seenInFeeds: ['rss-feed'],
  });
});

test('normalizeFeedDocument converts Atom entries into canonical article objects', () => {
  const articles = normalizeFeedDocument({
    feed: ATOM_FEED,
    xml: ATOM_XML,
    fetchedAt: '2026-03-08T06:00:00Z',
  });

  assert.equal(articles.length, 1);
  assert.deepEqual(articles[0], {
    id: articles[0].id,
    feedId: 'atom-feed',
    sourceName: 'Example Atom',
    category: 'Examples',
    language: 'en',
    title: 'Atom title',
    url: 'https://example.com/atom?b=2&utm_medium=email&a=1',
    summary: 'Atom summary.',
    publishedAt: '2026-03-08T01:02:03.000Z',
    fetchedAt: '2026-03-08T06:00:00.000Z',
    author: 'Atom Author',
    imageUrl: null,
    tags: [],
    sourceItemId: 'tag:example.com,2026:atom-1',
    seenInFeeds: ['atom-feed'],
  });
});

test('runPipeline reports normalized article counts when feed documents are provided', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-run-'));
  const feedsPath = path.join(tempDir, 'feeds.json');
  const lines = [];

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED, ATOM_FEED]));

  const summary = await runPipeline({
    feedsPath,
    dryRun: true,
    feedDocuments: [
      {
        feedId: 'rss-feed',
        xml: RSS_XML,
        fetchedAt: '2026-03-08T06:00:00Z',
      },
      {
        feedId: 'atom-feed',
        xml: ATOM_XML,
        fetchedAt: '2026-03-08T06:05:00Z',
      },
    ],
    logger: {
      log(message) {
        lines.push(message);
      },
    },
  });

  assert.deepEqual(summary, {
    feedsPath,
    totalFeeds: 2,
    enabledFeeds: 2,
    normalizedArticles: 2,
  });
  assert.match(lines.join('\n'), /normalizedArticles=2/);
  assert.match(lines.join('\n'), /FS-PIPE-02 normalization ready/);
});
