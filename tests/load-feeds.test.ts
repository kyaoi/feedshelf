const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { loadFeeds } = require('../scripts/pipeline/loadFeeds');
const { loadShelves } = require('../scripts/pipeline/loadShelves');
const {
  normalizeFeedDocument,
  normalizeUrl,
} = require('../scripts/pipeline/normalizeFeed');
const { dedupeArticles } = require('../scripts/pipeline/dedupeArticles');
const {
  buildPublicExports,
  slugifyCategoryLabel,
} = require('../scripts/pipeline/buildPublicExports');
const { parseArgs, runPipeline } = require('../scripts/pipeline/run');

const SHELVES_YAML = `site:
  title: FeedShelf
  description: Discover articles by shelf
  intro: Curated shelves for reading
shelves:
  - id: examples
    title: Examples
    description: Example shelf
  - id: research
    title: Research
    description: Research shelf
`;

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
      <category>RSS</category>
      <category> Cloud </category>
      <media:content url="https://example.com/image.jpg" medium="image" />
    </item>
  </channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <entry>
    <title>Atom title</title>
    <link rel="alternate" href="https://example.com/atom?b=2&amp;utm_medium=email&amp;a=1" />
    <id>tag:example.com,2026:atom-1</id>
    <updated>2026-03-08T01:02:03Z</updated>
    <summary type="html">&lt;p&gt;Atom &lt;em&gt;summary&lt;/em&gt;.&lt;/p&gt;</summary>
    <author><name>Atom Author</name></author>
    <category term="Atom" />
    <category term="Cloud" />
  </entry>
</feed>`;

const RSS_FEED = {
  id: 'rss-feed',
  name: 'Example RSS',
  feedUrl: 'https://example.com/rss.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
  shelfIds: ['examples'],
  tags: ['RSS Source'],
};

const ATOM_FEED = {
  id: 'atom-feed',
  name: 'Example Atom',
  feedUrl: 'https://example.com/atom.xml',
  siteUrl: 'https://example.com/',
  language: 'en',
  enabled: true,
  shelfIds: ['examples', 'research'],
  tags: ['Atom Source'],
};

test('loadFeeds parses and validates feed definitions', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-load-'));
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED]));

  const feeds = await loadFeeds(feedsPath);
  assert.equal(feeds.length, 1);
  assert.deepEqual(feeds[0].shelfIds, ['examples']);
  assert.deepEqual(feeds[0].tags, ['RSS Source']);
});

test('loadFeeds rejects missing shelfIds', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-invalid-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        shelfIds: undefined,
      },
    ]),
  );

  await assert.rejects(loadFeeds(feedsPath), /non-empty array field: shelfIds/);
});

test('loadShelves parses shelves.yaml and validates reserved ids', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-shelves-'),
  );
  const shelvesPath = path.join(tempDir, 'shelves.yaml');

  await fs.writeFile(shelvesPath, SHELVES_YAML);
  const shelves = await loadShelves(shelvesPath);
  assert.equal(shelves.site.title, 'FeedShelf');
  assert.equal(shelves.shelves[0].id, 'examples');

  await fs.writeFile(shelvesPath, SHELVES_YAML.replace('examples', 'search'));
  await assert.rejects(loadShelves(shelvesPath), /reserved/);
});

test('parseArgs accepts --feeds, --shelves, --output-dir, and --dry-run', () => {
  const parsed = parseArgs([
    '--feeds',
    'fixtures/feeds.json',
    '--shelves',
    'fixtures/shelves.yaml',
    '--output-dir',
    'tmp/public-data',
    '--dry-run',
  ]);
  assert.equal(parsed.dryRun, true);
  assert.match(parsed.feedsPath, /fixtures[\\/]feeds\.json$/);
  assert.match(parsed.shelvesPath, /fixtures[\\/]shelves\.yaml$/);
  assert.match(parsed.outputDir, /tmp[\\/]public-data$/);
});

test('normalizeUrl keeps safe canonicalization only', () => {
  assert.equal(
    normalizeUrl('HTTPS://Example.COM:443/path/?utm_source=rss&b=2&a=1#top'),
    'https://example.com/path?a=1&b=2',
  );
});

test('normalizeFeedDocument keeps shelfIds, sourceTags, and entryTags', () => {
  const articles = normalizeFeedDocument({
    feed: RSS_FEED,
    xml: RSS_XML,
    fetchedAt: '2026-03-08T06:00:00Z',
  });

  assert.equal(articles.length, 1);
  assert.deepEqual(articles[0].shelfIds, ['examples']);
  assert.deepEqual(articles[0].sourceTags, ['RSS Source']);
  assert.deepEqual(articles[0].entryTags, ['RSS', 'Cloud']);
});

test('normalizeFeedDocument converts Atom entries into canonical article objects', () => {
  const articles = normalizeFeedDocument({
    feed: ATOM_FEED,
    xml: ATOM_XML,
    fetchedAt: '2026-03-08T06:00:00Z',
  });

  assert.equal(articles.length, 1);
  assert.deepEqual(articles[0].shelfIds, ['examples', 'research']);
  assert.deepEqual(articles[0].sourceTags, ['Atom Source']);
  assert.deepEqual(articles[0].entryTags, ['Atom', 'Cloud']);
});

test('dedupeArticles merges shelfIds, sourceTags, and entryTags across duplicate items', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-a',
      feedId: 'rss-feed',
      sourceName: 'Example RSS',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared article',
      url: 'https://example.com/shared?a=1&utm_source=rss',
      summary: 'Short summary.',
      publishedAt: null,
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared',
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-b',
      feedId: 'atom-feed',
      sourceName: 'Example Atom',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: 'Shared article (richer)',
      url: 'https://example.com/shared?a=1&utm_medium=email',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-08T01:02:03.000Z',
      fetchedAt: '2026-03-08T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared',
      seenInFeeds: ['atom-feed'],
    },
  ]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].shelfIds, ['examples', 'research']);
  assert.deepEqual(deduped[0].sourceTags, ['Atom Source', 'RSS Source']);
  assert.deepEqual(deduped[0].entryTags, ['atom', 'rss']);
});

test('buildPublicExports creates shelf-first public JSON contracts', () => {
  const publicExports = buildPublicExports({
    articles: [
      {
        id: 'article-1',
        feedId: 'rss-feed',
        sourceName: 'Example RSS',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Exported article',
        url: 'https://example.com/exported',
        summary: 'Exported summary',
        publishedAt: '2026-03-08T01:02:03.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['RSS Source'],
        entryTags: ['Cloud'],
        sourceItemId: 'article-1',
        seenInFeeds: ['rss-feed'],
      },
    ],
    feeds: [RSS_FEED],
    shelves: {
      site: {
        title: 'FeedShelf',
        description: 'Discover articles by shelf',
        intro: 'Curated shelves',
      },
      shelves: [
        {
          id: 'examples',
          title: 'Examples',
          description: 'Example shelf',
        },
      ],
    },
    generatedAt: '2026-03-08T06:00:00Z',
  });

  assert.equal(publicExports.articles[0].shelfIds[0], 'examples');
  assert.equal(publicExports.shelves[0].id, 'examples');
  assert.equal(publicExports.categories[0].id, 'examples');
  assert.equal(publicExports.sources[0].shelfIds[0], 'examples');
  assert.equal(publicExports.tags[0].label, 'Cloud');
  assert.equal(publicExports.searchIndex[0].shelfIds[0], 'examples');
  assert.equal(publicExports.meta.shelfCount, 1);
  assert.equal(publicExports.meta.categoryCount, 1);
});

test('slugifyCategoryLabel keeps compatibility export stable', () => {
  assert.equal(slugifyCategoryLabel('C++'), 'c');
  assert.equal(slugifyCategoryLabel('C#'), 'c');
});

test('runPipeline writes shelves.json and reports shelf/category counts', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-run-'));
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED]));
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  const summary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    feedDocuments: [
      {
        feedId: 'rss-feed',
        xml: RSS_XML,
        fetchedAt: '2026-03-08T06:00:00Z',
      },
    ],
    generatedAt: '2026-03-08T06:00:00Z',
    logger: { log() {} },
  });

  assert.equal(summary.publicShelves, 2);
  assert.equal(summary.publicCategories, 2);
  const shelvesJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'shelves.json'), 'utf8'),
  );
  const articlesJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'articles.json'), 'utf8'),
  );

  assert.equal(shelvesJson[0].id, 'examples');
  assert.equal(articlesJson[0].shelfIds[0], 'examples');
});
