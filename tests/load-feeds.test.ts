const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { loadFeeds } = require('../scripts/pipeline/loadFeeds');
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
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-invalid-'),
  );
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

  await assert.rejects(
    loadFeeds(feedsPath),
    /must have boolean field: enabled/,
  );
});

test('parseArgs accepts --feeds, --output-dir, and --dry-run', () => {
  const parsed = parseArgs([
    '--feeds',
    'fixtures/feeds.json',
    '--output-dir',
    'tmp/public-data',
    '--dry-run',
  ]);
  assert.equal(parsed.dryRun, true);
  assert.match(parsed.feedsPath, /fixtures[\\/]feeds\.json$/);
  assert.match(parsed.outputDir, /tmp[\\/]public-data$/);
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

test('dedupeArticles merges duplicates by normalizedUrl across feeds', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-a',
      feedId: 'rss-feed',
      sourceName: 'Example RSS',
      category: 'Examples',
      language: 'en',
      title: 'Shared article',
      url: 'https://example.com/shared?a=1&utm_source=rss',
      summary: 'Short summary.',
      publishedAt: null,
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      tags: ['rss'],
      sourceItemId: 'rss-shared',
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-b',
      feedId: 'atom-feed',
      sourceName: 'Example Atom',
      category: 'Examples',
      language: 'en',
      title: 'Shared article (richer)',
      url: 'https://example.com/shared?a=1&utm_medium=email',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-08T01:02:03.000Z',
      fetchedAt: '2026-03-08T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared.jpg',
      tags: ['atom'],
      sourceItemId: 'atom-shared',
      seenInFeeds: ['atom-feed'],
    },
  ]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0], {
    id: 'article-b',
    feedId: 'atom-feed',
    sourceName: 'Example Atom',
    category: 'Examples',
    language: 'en',
    title: 'Shared article (richer)',
    url: 'https://example.com/shared?a=1&utm_medium=email',
    summary: 'Longer summary with more useful detail.',
    publishedAt: '2026-03-08T01:02:03.000Z',
    fetchedAt: '2026-03-08T06:00:00.000Z',
    author: 'Atom Author',
    imageUrl: 'https://example.com/shared.jpg',
    tags: ['atom', 'rss'],
    sourceItemId: 'atom-shared',
    seenInFeeds: ['atom-feed', 'rss-feed'],
  });
});

test('dedupeArticles merges duplicates by feedId and sourceItemId when URL cannot be normalized', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-a',
      feedId: 'rss-feed',
      sourceName: 'Example RSS',
      category: 'Examples',
      language: 'en',
      title: 'Opaque URL article',
      url: '/articles/opaque',
      summary: null,
      publishedAt: null,
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      tags: [],
      sourceItemId: 'opaque-1',
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-b',
      feedId: 'rss-feed',
      sourceName: 'Example RSS',
      category: 'Examples',
      language: 'en',
      title: 'Opaque URL article',
      url: 'not-a-valid-url',
      summary: 'Recovered metadata.',
      publishedAt: '2026-03-08T01:02:03.000Z',
      fetchedAt: '2026-03-08T06:05:00.000Z',
      author: 'RSS Author',
      imageUrl: null,
      tags: ['deduped'],
      sourceItemId: 'opaque-1',
      seenInFeeds: ['rss-feed'],
    },
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].sourceItemId, 'opaque-1');
  assert.equal(deduped[0].publishedAt, '2026-03-08T01:02:03.000Z');
  assert.equal(deduped[0].summary, 'Recovered metadata.');
  assert.equal(deduped[0].author, 'RSS Author');
  assert.equal(deduped[0].fetchedAt, '2026-03-08T06:00:00.000Z');
  assert.deepEqual(deduped[0].tags, ['deduped']);
});

test('dedupeArticles does not collapse articles by title similarity alone', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-a',
      feedId: 'rss-feed',
      sourceName: 'Example RSS',
      category: 'Examples',
      language: 'en',
      title: 'Same title',
      url: 'https://example.com/articles/a',
      summary: null,
      publishedAt: null,
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      tags: [],
      sourceItemId: null,
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-b',
      feedId: 'atom-feed',
      sourceName: 'Example Atom',
      category: 'Examples',
      language: 'en',
      title: 'Same title',
      url: 'https://example.com/articles/b',
      summary: null,
      publishedAt: null,
      fetchedAt: '2026-03-08T06:05:00.000Z',
      author: null,
      imageUrl: null,
      tags: [],
      sourceItemId: null,
      seenInFeeds: ['atom-feed'],
    },
  ]);

  assert.equal(deduped.length, 2);
});

test('slugifyCategoryLabel preserves unicode letters and normalizes separators', () => {
  assert.equal(slugifyCategoryLabel('日本 IT / Science'), '日本-it-science');
});

test('buildPublicExports creates listing-ready JSON payloads', () => {
  const publicExports = buildPublicExports({
    articles: [
      {
        id: 'article-a',
        feedId: 'rss-feed',
        sourceName: 'Example RSS',
        category: 'Examples',
        language: 'en',
        title: 'Older article',
        url: 'https://example.com/articles/older',
        summary: 'Older summary.',
        publishedAt: '2026-03-07T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        tags: [],
        sourceItemId: null,
        seenInFeeds: ['rss-feed'],
      },
      {
        id: 'article-b',
        feedId: 'atom-feed',
        sourceName: 'Example Atom',
        category: 'Examples',
        language: 'en',
        title: 'Newer article',
        url: 'https://example.com/articles/newer',
        summary: 'Newer summary.',
        publishedAt: null,
        fetchedAt: '2026-03-08T06:05:00.000Z',
        author: null,
        imageUrl: 'https://example.com/newer.jpg',
        tags: [],
        sourceItemId: null,
        seenInFeeds: ['atom-feed'],
      },
    ],
    feeds: [RSS_FEED, ATOM_FEED],
    generatedAt: '2026-03-08T07:00:00Z',
  });

  assert.deepEqual(publicExports.articles, [
    {
      id: 'article-b',
      title: 'Newer article',
      url: 'https://example.com/articles/newer',
      summary: 'Newer summary.',
      publishedAt: null,
      sortAt: '2026-03-08T06:05:00.000Z',
      sourceId: 'atom-feed',
      sourceName: 'Example Atom',
      categoryId: 'examples',
      categoryLabel: 'Examples',
      imageUrl: 'https://example.com/newer.jpg',
    },
    {
      id: 'article-a',
      title: 'Older article',
      url: 'https://example.com/articles/older',
      summary: 'Older summary.',
      publishedAt: '2026-03-07T00:00:00.000Z',
      sortAt: '2026-03-07T00:00:00.000Z',
      sourceId: 'rss-feed',
      sourceName: 'Example RSS',
      categoryId: 'examples',
      categoryLabel: 'Examples',
      imageUrl: null,
    },
  ]);

  assert.deepEqual(publicExports.categories, [
    {
      id: 'examples',
      label: 'Examples',
      articleCount: 2,
      latestSortAt: '2026-03-08T06:05:00.000Z',
    },
  ]);

  assert.deepEqual(publicExports.sources, [
    {
      id: 'atom-feed',
      name: 'Example Atom',
      siteUrl: 'https://example.com/',
      language: 'en',
      categoryId: 'examples',
      categoryLabel: 'Examples',
      articleCount: 1,
      latestSortAt: '2026-03-08T06:05:00.000Z',
    },
    {
      id: 'rss-feed',
      name: 'Example RSS',
      siteUrl: 'https://example.com/',
      language: 'en',
      categoryId: 'examples',
      categoryLabel: 'Examples',
      articleCount: 1,
      latestSortAt: '2026-03-07T00:00:00.000Z',
    },
  ]);

  assert.deepEqual(publicExports.meta, {
    generatedAt: '2026-03-08T07:00:00.000Z',
    articleCount: 2,
    sourceCount: 2,
    categoryCount: 1,
  });
});

test('buildPublicExports rejects category slug collisions', () => {
  assert.throws(
    () =>
      buildPublicExports({
        articles: [
          {
            id: 'article-a',
            feedId: 'rss-feed',
            sourceName: 'Example RSS',
            category: 'C++',
            language: 'en',
            title: 'Article A',
            url: 'https://example.com/articles/a',
            summary: null,
            publishedAt: null,
            fetchedAt: '2026-03-08T06:00:00.000Z',
            author: null,
            imageUrl: null,
            tags: [],
            sourceItemId: null,
            seenInFeeds: ['rss-feed'],
          },
          {
            id: 'article-b',
            feedId: 'atom-feed',
            sourceName: 'Example Atom',
            category: 'C#',
            language: 'en',
            title: 'Article B',
            url: 'https://example.com/articles/b',
            summary: null,
            publishedAt: null,
            fetchedAt: '2026-03-08T06:05:00.000Z',
            author: null,
            imageUrl: null,
            tags: [],
            sourceItemId: null,
            seenInFeeds: ['atom-feed'],
          },
        ],
        feeds: [RSS_FEED, ATOM_FEED],
        generatedAt: '2026-03-08T07:00:00Z',
      }),
    /Category slug collision/,
  );
});

test('runPipeline reports public JSON counts in dry-run mode', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-run-'));
  const feedsPath = path.join(tempDir, 'feeds.json');
  const outputDir = path.join(tempDir, 'public-data');
  const lines: string[] = [];

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED, ATOM_FEED]));

  const summary = await runPipeline({
    feedsPath,
    outputDir,
    generatedAt: '2026-03-08T07:00:00Z',
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
      log(message: string) {
        lines.push(message);
      },
    },
  });

  assert.deepEqual(summary, {
    feedsPath,
    outputDir,
    generatedAt: '2026-03-08T07:00:00.000Z',
    totalFeeds: 2,
    enabledFeeds: 2,
    normalizedArticles: 2,
    dedupedArticles: 2,
    duplicatesCollapsed: 0,
    publicArticles: 2,
    publicCategories: 1,
    publicSources: 2,
  });
  assert.match(lines.join('\n'), /normalizedArticles=2/);
  assert.match(lines.join('\n'), /dedupedArticles=2 duplicatesCollapsed=0/);
  assert.match(
    lines.join('\n'),
    /publicArticles=2 publicCategories=1 publicSources=2/,
  );
  assert.match(lines.join('\n'), /FS-PIPE-04 public JSON ready/);
  await assert.rejects(fs.access(outputDir));
});

test('runPipeline writes public JSON files when dry-run is false', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-write-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const outputDir = path.join(tempDir, 'public-data');

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED, ATOM_FEED]));

  const summary = await runPipeline({
    feedsPath,
    outputDir,
    generatedAt: '2026-03-08T07:00:00Z',
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
      log() {},
    },
  });

  assert.equal(summary.publicArticles, 2);
  assert.equal(summary.publicCategories, 1);
  assert.equal(summary.publicSources, 2);

  const articles = JSON.parse(
    await fs.readFile(path.join(outputDir, 'articles.json'), 'utf8'),
  );
  const categories = JSON.parse(
    await fs.readFile(path.join(outputDir, 'categories.json'), 'utf8'),
  );
  const sources = JSON.parse(
    await fs.readFile(path.join(outputDir, 'sources.json'), 'utf8'),
  );
  const meta = JSON.parse(
    await fs.readFile(path.join(outputDir, 'meta.json'), 'utf8'),
  );

  assert.equal(articles.length, 2);
  assert.equal(articles[0].title, 'Atom title');
  assert.equal(articles[0].categoryId, 'examples');
  assert.deepEqual(categories, [
    {
      id: 'examples',
      label: 'Examples',
      articleCount: 2,
      latestSortAt: '2026-03-08T01:02:03.000Z',
    },
  ]);
  assert.deepEqual(
    sources.map((source: { id: string }) => source.id),
    ['atom-feed', 'rss-feed'],
  );
  assert.deepEqual(meta, {
    generatedAt: '2026-03-08T07:00:00.000Z',
    articleCount: 2,
    sourceCount: 2,
    categoryCount: 1,
  });
});
