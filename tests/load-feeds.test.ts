const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

type FeedDefinition = import('../src/shared/contracts.ts').FeedDefinition;
type ShelvesDocument = import('../src/shared/contracts.ts').ShelvesDocument;

const { loadFeeds } = require('../scripts/pipeline/loadFeeds');
const { loadShelves } = require('../scripts/pipeline/loadShelves');
const {
  applyCanonicalUrlPrecisionLayer,
  normalizeFeedDocument,
  normalizeUrl,
  normalizeUrlWithPrecision,
} = require('../scripts/pipeline/normalizeFeed');
const {
  dedupeArticles,
  dedupeArticlesWithSummary,
} = require('../scripts/pipeline/dedupeArticles');
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

const LONG_SUMMARY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Long Summary RSS</title>
    <item>
      <title>Long summary article</title>
      <link>https://example.com/articles/long-summary</link>
      <description><![CDATA[<p>This article explores Linux setup, Python tooling, numerical experiments, editor workflows, and LLM-assisted development in enough detail to exceed the public summary limit while still remaining readable after truncation for cautious public re-distribution. It also compares terminal workflows, dataset cleanup, numerical plotting habits, and the tradeoffs of using community feeds inside a static site pipeline so that the resulting description is clearly longer than the excerpt threshold used for public summaries.</p>]]></description>
      <pubDate>Fri, 07 Mar 2026 09:00:00 +0900</pubDate>
      <guid>rss-item-long-summary</guid>
    </item>
  </channel>
</rss>`;

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

test('loadFeeds rejects duplicate feed ids', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-duplicate-feed-id-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      RSS_FEED,
      {
        ...ATOM_FEED,
        id: RSS_FEED.id,
      },
    ]),
  );

  await assert.rejects(loadFeeds(feedsPath), /Duplicate feed id: rss-feed/);
});

test('loadFeeds rejects duplicate shelfIds within one feed', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-duplicate-shelf-id-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        shelfIds: ['examples', 'examples'],
      },
    ]),
  );

  await assert.rejects(
    loadFeeds(feedsPath),
    /Feed at index 0 has duplicate shelfIds value: examples/,
  );
});

test('loadFeeds rejects duplicate manual tags within one feed by normalized compare key', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-duplicate-tags-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        tags: ['AI', ' ai '],
      },
    ]),
  );

  await assert.rejects(
    loadFeeds(feedsPath),
    /Feed at index 0 has duplicate tags value: {2}ai /,
  );
});

test('loadFeeds rejects non-array tags field', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-invalid-tags-field-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        tags: 'AI',
      },
    ]),
  );

  await assert.rejects(
    loadFeeds(feedsPath),
    /Feed at index 0 must have array field: tags/,
  );
});

test('loadFeeds rejects empty or non-string manual tag values', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-invalid-tag-value-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        tags: ['AI', '   ', 42],
      },
    ]),
  );

  await assert.rejects(
    loadFeeds(feedsPath),
    /Feed at index 0 has invalid tags\[1\] value\./,
  );
});

test('loadFeeds rejects unsupported fuzzySourceFamilyKey values', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-feeds-'));
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        id: 'rss-feed',
        name: 'Example RSS',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com/',
        language: 'en',
        enabled: true,
        shelfIds: ['it'],
        fuzzySourceFamilyKey: 'example',
      },
    ]),
  );

  await assert.rejects(
    loadFeeds(feedsPath),
    /unsupported fuzzySourceFamilyKey value: example/,
  );
});

test('loadFeeds rejects unsupported fuzzyRegistrableDomainKey values', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-loadfeeds-domainkey-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        id: 'bad-domain-key',
        name: 'Bad Domain Key',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com/',
        language: 'ja',
        enabled: true,
        shelfIds: ['it'],
        fuzzyRegistrableDomainKey: 'example.com',
      },
    ]),
  );

  await assert.rejects(
    () => loadFeeds(feedsPath),
    /unsupported fuzzyRegistrableDomainKey value: example\.com/,
  );
});

test('loadFeeds rejects non-http feedUrl values', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-invalid-feed-url-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        feedUrl: 'mailto:tips@example.com',
      },
    ]),
  );

  await assert.rejects(
    loadFeeds(feedsPath),
    /Feed at index 0 must have absolute http\/https URL field: feedUrl/,
  );
});

test('loadFeeds rejects non-http siteUrl values', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-invalid-site-url-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        siteUrl: '/relative-path',
      },
    ]),
  );

  await assert.rejects(
    loadFeeds(feedsPath),
    /Feed at index 0 must have absolute http\/https URL field: siteUrl/,
  );
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

test('runPipeline rejects feeds whose shelfIds are missing from shelves.yaml', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-cross-registry-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        shelfIds: ['unknown-shelf'],
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  await assert.rejects(
    runPipeline({
      feedsPath,
      shelvesPath,
      outputDir: path.join(tempDir, 'public/data'),
      dryRun: true,
      generatedAt: '2026-03-09T00:10:00Z',
      logger: {
        log() {},
      },
    }),
    /Unknown shelfId referenced by feed rss-feed: unknown-shelf/,
  );
});

test('parseArgs accepts --feeds, --shelves, --output-dir, --dry-run, --disable-fuzzy-dedupe, --fuzzy-audit-file, --fuzzy-handoff-file, --fuzzy-reject-file, --fuzzy-accept-file, --fuzzy-review-state-file, and --fuzzy-review-html-file', () => {
  const parsed = parseArgs([
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

test('normalizeUrlWithPrecision rewrites Hatena entry URLs and follows bounded redirects', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const url = await normalizeUrlWithPrecision(
    'https://b.hatena.ne.jp/entry/s/example.com/articles/1?b=2&a=1&utm_source=rss',
    {
      fetchImpl: async (requestUrl: string, init?: RequestInit) => {
        calls.push({ url: requestUrl, init });
        if (requestUrl === 'https://example.com/articles/1?a=1&b=2') {
          return {
            ok: false,
            status: 302,
            url: requestUrl,
            headers: new Headers({
              location: 'https://example.com/articles/final?b=2&a=1',
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          url: requestUrl,
          headers: new Headers(),
        };
      },
    },
  );

  assert.equal(url, 'https://example.com/articles/final?a=1&b=2');
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      'https://example.com/articles/1?a=1&b=2',
      'https://example.com/articles/final?a=1&b=2',
    ],
  );
  assert.equal(calls[0]?.init?.method, 'HEAD');
  assert.equal(calls[0]?.init?.redirect, 'manual');
});

test('normalizeUrlWithPrecision falls back to allowlisted host rewrite when redirect resolution loops', async () => {
  const url = await normalizeUrlWithPrecision(
    'https://b.hatena.ne.jp/entry/s/example.com/articles/loop?b=2&a=1&utm_source=rss',
    {
      fetchImpl: async (requestUrl: string) => ({
        ok: false,
        status: 302,
        url: requestUrl,
        headers: new Headers({
          location: 'https://example.com/articles/loop?b=2&a=1',
        }),
      }),
    },
  );

  assert.equal(url, 'https://example.com/articles/loop?a=1&b=2');
});

test('normalizeUrlWithPrecision applies deterministic Reddit presentation cleanup without extra redirect fetches', async () => {
  let fetchCalls = 0;
  const url = await normalizeUrlWithPrecision(
    'https://old.reddit.com/r/programming/comments/abc123/example_post/?context=3&sort=top&depth=5&share_id=demo&rdt=123&utm_source=rss',
    {
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('deterministic rule table should not fetch');
      },
    },
  );

  assert.equal(
    url,
    'https://www.reddit.com/r/programming/comments/abc123/example_post',
  );
  assert.equal(fetchCalls, 0);
});

test('applyCanonicalUrlPrecisionLayer updates article url and identity after allowlisted rewrite', async () => {
  const article = {
    id: 'before',
    feedId: 'rss-feed',
    sourceName: 'Example RSS',
    language: 'en',
    shelfIds: ['examples'],
    title: 'Hatena entry article',
    url: 'https://b.hatena.ne.jp/entry/s/example.com/articles/hatena?b=2&a=1&utm_source=rss',
    summary: null,
    publishedAt: null,
    fetchedAt: '2026-03-08T06:00:00.000Z',
    author: null,
    imageUrl: null,
    sourceTags: ['RSS Source'],
    entryTags: ['Hatena'],
    sourceItemId: 'hatena-item',
    provenance: [
      {
        feedId: 'rss-feed',
        firstSeenAt: '2026-03-08T06:00:00.000Z',
        lastSeenAt: '2026-03-08T06:00:00.000Z',
        sourceItemId: 'hatena-item',
        matchedBy: 'primary',
      },
    ],
    seenInFeeds: ['rss-feed'],
  };

  const [nextArticle] = await applyCanonicalUrlPrecisionLayer({
    articles: [article],
  });

  assert.equal(nextArticle.url, 'https://example.com/articles/hatena?a=1&b=2');
  assert.notEqual(nextArticle.id, article.id);
  assert.deepEqual(nextArticle.provenance, article.provenance);
  assert.deepEqual(nextArticle.seenInFeeds, ['rss-feed']);
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
  assert.deepEqual(articles[0].provenance, [
    {
      feedId: 'rss-feed',
      firstSeenAt: '2026-03-08T06:00:00.000Z',
      lastSeenAt: '2026-03-08T06:00:00.000Z',
      sourceItemId: 'rss-item-1',
      matchedBy: 'primary',
    },
  ]);
  assert.deepEqual(articles[0].seenInFeeds, ['rss-feed']);
});

test('applyCanonicalUrlPrecisionLayer updates article url and identity after deterministic Reddit cleanup', async () => {
  const article = {
    id: 'before-reddit',
    feedId: 'reddit-programming',
    sourceName: 'Reddit /r/programming',
    language: 'en',
    shelfIds: ['it'],
    title: 'Reddit thread article',
    url: 'https://old.reddit.com/r/programming/comments/abc123/example_post/?context=3&sort=top&share_id=demo',
    summary: null,
    publishedAt: null,
    fetchedAt: '2026-03-08T06:00:00.000Z',
    author: null,
    imageUrl: null,
    sourceTags: ['Reddit'],
    entryTags: ['Community'],
    sourceItemId: 'reddit-thread-1',
    provenance: [
      {
        feedId: 'reddit-programming',
        firstSeenAt: '2026-03-08T06:00:00.000Z',
        lastSeenAt: '2026-03-08T06:00:00.000Z',
        sourceItemId: 'reddit-thread-1',
        matchedBy: 'primary',
      },
    ],
    seenInFeeds: ['reddit-programming'],
  };

  const [updated] = await applyCanonicalUrlPrecisionLayer({
    articles: [article],
    fetchImpl: async () => {
      throw new Error('deterministic rule table should not fetch');
    },
  });

  assert.equal(
    updated.url,
    'https://www.reddit.com/r/programming/comments/abc123/example_post',
  );
  assert.notEqual(updated.id, article.id);
  assert.equal(updated.sourceItemId, article.sourceItemId);
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

test('normalizeFeedDocument truncates long summaries into short public excerpts', () => {
  const articles = normalizeFeedDocument({
    feed: RSS_FEED,
    xml: LONG_SUMMARY_XML,
    fetchedAt: '2026-03-08T06:00:00Z',
  });

  assert.equal(articles.length, 1);
  assert.ok(articles[0].summary !== null);
  assert.ok((articles[0].summary || '').length <= 281);
  assert.match(articles[0].summary || '', /…$/);
  assert.doesNotMatch(articles[0].summary || '', /<p>|<\/p>/);
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
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared',
          matchedBy: 'primary',
        },
      ],
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
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-08T06:05:00.000Z',
          lastSeenAt: '2026-03-08T06:05:00.000Z',
          sourceItemId: 'atom-shared',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].shelfIds, ['examples', 'research']);
  assert.deepEqual(deduped[0].sourceTags, ['Atom Source', 'RSS Source']);
  assert.deepEqual(deduped[0].entryTags, ['atom', 'rss']);
  assert.deepEqual(deduped[0].seenInFeeds, ['atom-feed', 'rss-feed']);
  assert.deepEqual(deduped[0].provenance, [
    {
      feedId: 'atom-feed',
      firstSeenAt: '2026-03-08T06:05:00.000Z',
      lastSeenAt: '2026-03-08T06:05:00.000Z',
      sourceItemId: 'atom-shared',
      matchedBy: 'primary',
    },
    {
      feedId: 'rss-feed',
      firstSeenAt: '2026-03-08T06:00:00.000Z',
      lastSeenAt: '2026-03-08T06:00:00.000Z',
      sourceItemId: 'rss-shared',
      matchedBy: 'normalizedUrl',
    },
  ]);
});

test('dedupeArticles applies conservative fuzzy fallback for same-source title matches within 72 hours', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-fuzzy-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared Title',
      url: 'https://example.com/posts/shared-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: '  shared   title  ',
      url: 'https://example.com/posts/shared-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].shelfIds, ['examples', 'research']);
  assert.deepEqual(deduped[0].sourceTags, ['Atom Source', 'RSS Source']);
  assert.deepEqual(deduped[0].entryTags, ['atom', 'rss']);
  assert.deepEqual(deduped[0].seenInFeeds, ['atom-feed', 'rss-feed']);
  assert.deepEqual(deduped[0].provenance, [
    {
      feedId: 'atom-feed',
      firstSeenAt: '2026-03-10T06:05:00.000Z',
      lastSeenAt: '2026-03-10T06:05:00.000Z',
      sourceItemId: 'atom-shared-b',
      matchedBy: 'primary',
    },
    {
      feedId: 'rss-feed',
      firstSeenAt: '2026-03-08T06:00:00.000Z',
      lastSeenAt: '2026-03-08T06:00:00.000Z',
      sourceItemId: 'rss-shared-a',
      matchedBy: 'fuzzyTitleDate',
    },
  ]);
});

test('dedupeArticles applies broader punctuation-folded fuzzy fallback for same-source title matches within 72 hours', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-fuzzy-punct-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared: Title (Update)',
      url: 'https://example.com/posts/shared-punct-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-punct-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-punct-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-punct-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: ' shared title update ',
      url: 'https://example.com/posts/shared-punct-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared-update.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-punct-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-punct-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].seenInFeeds, ['atom-feed', 'rss-feed']);
  assert.equal(deduped[0].provenance[1].matchedBy, 'fuzzyTitleDate');
});

test('dedupeArticlesWithSummary reports fuzzy collapse counts and respects disableFuzzyDedupe', () => {
  const articles = [
    {
      id: 'article-fuzzy-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared Title',
      url: 'https://example.com/posts/shared-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: '  shared   title  ',
      url: 'https://example.com/posts/shared-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ];

  const enabled = dedupeArticlesWithSummary(articles);
  assert.equal(enabled.articles.length, 1);
  assert.equal(enabled.fuzzyDuplicatesCollapsed, 1);
  assert.equal(enabled.fuzzyAuditRecords.length, 1);
  assert.deepEqual(enabled.fuzzyAuditRecords[0], {
    winnerArticleId: 'article-fuzzy-b',
    incomingArticleId: 'article-fuzzy-b',
    winnerFeedId: 'atom-feed',
    incomingFeedId: 'atom-feed',
    titleCompareKey: 'shared title',
    publishedAtDeltaHours: 72,
    matchedBy: 'fuzzyTitleDate',
    scopeKind: 'source',
  });
  assert.equal(enabled.fuzzyHandoffRecords.length, 1);
  assert.deepEqual(enabled.fuzzyHandoffRecords[0], {
    winnerArticleId: 'article-fuzzy-b',
    incomingArticleId: 'article-fuzzy-b',
    winnerFeedId: 'atom-feed',
    incomingFeedId: 'atom-feed',
    titleCompareKey: 'shared title',
    publishedAtDeltaHours: 72,
    matchedBy: 'fuzzyTitleDate',
    winnerTitle: '  shared   title  ',
    incomingTitle: '  shared   title  ',
    winnerUrl: 'https://example.com/posts/shared-b',
    incomingUrl: 'https://example.com/posts/shared-b',
    winnerSourceName: 'Example Source',
    incomingSourceName: 'Example Source',
    scopeKind: 'source',
  });

  const disabled = dedupeArticlesWithSummary(articles, {
    disableFuzzyDedupe: true,
  });
  assert.equal(disabled.articles.length, 2);
  assert.equal(disabled.fuzzyDuplicatesCollapsed, 0);
  assert.deepEqual(disabled.fuzzyAuditRecords, []);
  assert.deepEqual(disabled.fuzzyHandoffRecords, []);
});

test('dedupeArticles applies allowlisted source-family fuzzy fallback for sibling feed title matches within 72 hours', () => {
  const feeds: FeedDefinition[] = [
    {
      id: 'qiita-popular',
      name: 'Qiita Popular',
      feedUrl: 'https://qiita.example.com/popular.xml',
      siteUrl: 'https://qiita.example.com/',
      language: 'ja',
      enabled: true,
      shelfIds: ['it'],
      fuzzySourceFamilyKey: 'qiita',
    },
    {
      id: 'qiita-rust',
      name: 'Qiita Rust Tag',
      feedUrl: 'https://qiita.example.com/rust.xml',
      siteUrl: 'https://qiita.example.com/rust',
      language: 'ja',
      enabled: true,
      shelfIds: ['it', 'science'],
      fuzzySourceFamilyKey: 'qiita',
    },
  ];

  const deduped = dedupeArticlesWithSummary(
    [
      {
        id: 'article-fuzzy-family-a',
        feedId: 'qiita-popular',
        sourceName: 'Qiita Popular',
        language: 'ja',
        shelfIds: ['it'],
        title: 'Qiita shared article',
        url: 'https://qiita.com/example/items/shared-a',
        summary: 'Short summary.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['Qiita'],
        entryTags: ['popular'],
        sourceItemId: 'qiita-shared-a',
        provenance: [
          {
            feedId: 'qiita-popular',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'qiita-shared-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['qiita-popular'],
      },
      {
        id: 'article-fuzzy-family-b',
        feedId: 'qiita-rust',
        sourceName: 'Qiita Rust Tag',
        language: 'ja',
        shelfIds: ['it', 'science'],
        title: '  qiita   shared article  ',
        url: 'https://qiita.com/example/items/shared-b',
        summary: 'Longer summary with more useful detail.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Qiita Author',
        imageUrl: 'https://qiita.com/shared.jpg',
        sourceTags: ['Qiita'],
        entryTags: ['rust'],
        sourceItemId: 'qiita-shared-b',
        provenance: [
          {
            feedId: 'qiita-rust',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'qiita-shared-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['qiita-rust'],
      },
    ],
    { feeds },
  );

  assert.equal(deduped.articles.length, 1);
  assert.equal(deduped.fuzzyAuditRecords[0]?.scopeKind, 'sourceFamily');
  assert.equal(deduped.fuzzyHandoffRecords[0]?.scopeKind, 'sourceFamily');
  assert.deepEqual(deduped.articles[0].seenInFeeds, [
    'qiita-rust',
    'qiita-popular',
  ]);
  assert.equal(deduped.articles[0].provenance[1].matchedBy, 'fuzzyTitleDate');
});

test('dedupeArticles applies allowlisted registrable-domain fuzzy fallback when source and family fallback do not apply', () => {
  const feeds: FeedDefinition[] = [
    {
      id: 'zenn-alpha',
      name: 'Zenn Alpha',
      feedUrl: 'https://feeds.example.net/zenn-alpha.xml',
      siteUrl: 'https://alpha.zenn.dev/',
      language: 'ja',
      enabled: true,
      shelfIds: ['it'],
      fuzzyRegistrableDomainKey: 'zenn.dev',
    },
    {
      id: 'zenn-beta',
      name: 'Zenn Beta',
      feedUrl: 'https://feeds.example.net/zenn-beta.xml',
      siteUrl: 'https://beta.zenn.dev/topics/rust',
      language: 'ja',
      enabled: true,
      shelfIds: ['it', 'science'],
      fuzzyRegistrableDomainKey: 'zenn.dev',
    },
  ];

  const deduped = dedupeArticlesWithSummary(
    [
      {
        id: 'article-fuzzy-domain-a',
        feedId: 'zenn-alpha',
        sourceName: 'Zenn Alpha',
        language: 'ja',
        shelfIds: ['it'],
        title: 'Zenn shared article',
        url: 'https://zenn.dev/example/articles/shared-a',
        summary: 'Short summary.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['Zenn'],
        entryTags: ['alpha'],
        sourceItemId: 'zenn-shared-a',
        provenance: [
          {
            feedId: 'zenn-alpha',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'zenn-shared-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['zenn-alpha'],
      },
      {
        id: 'article-fuzzy-domain-b',
        feedId: 'zenn-beta',
        sourceName: 'Zenn Beta',
        language: 'ja',
        shelfIds: ['it', 'science'],
        title: '  zenn   shared article  ',
        url: 'https://zenn.dev/example/articles/shared-b',
        summary: 'Longer summary with more useful detail.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Zenn Author',
        imageUrl: 'https://zenn.dev/shared.jpg',
        sourceTags: ['Zenn'],
        entryTags: ['beta'],
        sourceItemId: 'zenn-shared-b',
        provenance: [
          {
            feedId: 'zenn-beta',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'zenn-shared-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['zenn-beta'],
      },
    ],
    { feeds },
  );

  assert.equal(deduped.articles.length, 1);
  assert.equal(deduped.fuzzyDuplicatesCollapsed, 1);
  assert.equal(
    deduped.fuzzyAuditRecords[0]?.titleCompareKey,
    'zenn shared article',
  );
  assert.equal(deduped.fuzzyAuditRecords[0]?.scopeKind, 'registrableDomain');
  assert.equal(deduped.fuzzyHandoffRecords[0]?.scopeKind, 'registrableDomain');
  assert.deepEqual(deduped.articles[0].seenInFeeds, [
    'zenn-beta',
    'zenn-alpha',
  ]);
  assert.equal(deduped.articles[0].provenance[1].matchedBy, 'fuzzyTitleDate');
});

test('dedupeArticles does not fuzzy-merge allowlisted hostname matches without explicit fuzzyRegistrableDomainKey', () => {
  const feeds: FeedDefinition[] = [
    {
      id: 'zenn-implicit-alpha',
      name: 'Zenn Implicit Alpha',
      feedUrl: 'https://feeds.example.net/implicit-alpha.xml',
      siteUrl: 'https://alpha.zenn.dev/',
      language: 'ja',
      enabled: true,
      shelfIds: ['it'],
    },
    {
      id: 'zenn-implicit-beta',
      name: 'Zenn Implicit Beta',
      feedUrl: 'https://feeds.example.net/implicit-beta.xml',
      siteUrl: 'https://beta.zenn.dev/topics/rust',
      language: 'ja',
      enabled: true,
      shelfIds: ['it'],
    },
  ];

  const deduped = dedupeArticles(
    [
      {
        id: 'article-fuzzy-domain-implicit-a',
        feedId: 'zenn-implicit-alpha',
        sourceName: 'Zenn Implicit Alpha',
        language: 'ja',
        shelfIds: ['it'],
        title: 'Implicit hostname fallback article',
        url: 'https://zenn.dev/example/articles/implicit-a',
        summary: 'First copy.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['Zenn'],
        entryTags: ['alpha'],
        sourceItemId: 'implicit-a',
        provenance: [
          {
            feedId: 'zenn-implicit-alpha',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'implicit-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['zenn-implicit-alpha'],
      },
      {
        id: 'article-fuzzy-domain-implicit-b',
        feedId: 'zenn-implicit-beta',
        sourceName: 'Zenn Implicit Beta',
        language: 'ja',
        shelfIds: ['it'],
        title: ' implicit   hostname fallback article ',
        url: 'https://zenn.dev/example/articles/implicit-b',
        summary: 'Second copy.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Zenn Author',
        imageUrl: null,
        sourceTags: ['Zenn'],
        entryTags: ['beta'],
        sourceItemId: 'implicit-b',
        provenance: [
          {
            feedId: 'zenn-implicit-beta',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'implicit-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['zenn-implicit-beta'],
      },
    ],
    { feeds },
  );

  assert.equal(deduped.length, 2);
});

test('dedupeArticles does not fuzzy-merge blanket reddit hostname matches within 72 hours', () => {
  const feeds: FeedDefinition[] = [
    {
      id: 'reddit-programming',
      name: 'Reddit Programming',
      feedUrl: 'https://www.reddit.com/r/programming/.rss',
      siteUrl: 'https://www.reddit.com/r/programming/',
      language: 'en',
      enabled: true,
      shelfIds: ['it'],
    },
    {
      id: 'reddit-python',
      name: 'Reddit Python',
      feedUrl: 'https://www.reddit.com/r/python/.rss',
      siteUrl: 'https://www.reddit.com/r/python/',
      language: 'en',
      enabled: true,
      shelfIds: ['it'],
    },
  ];

  const deduped = dedupeArticles(
    [
      {
        id: 'article-fuzzy-reddit-a',
        feedId: 'reddit-programming',
        sourceName: 'Reddit Programming',
        language: 'en',
        shelfIds: ['it'],
        title: 'Shared reddit title',
        url: 'https://www.reddit.com/r/programming/comments/example_a',
        summary: 'First copy.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['Reddit'],
        entryTags: ['programming'],
        sourceItemId: 'reddit-a',
        provenance: [
          {
            feedId: 'reddit-programming',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'reddit-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['reddit-programming'],
      },
      {
        id: 'article-fuzzy-reddit-b',
        feedId: 'reddit-python',
        sourceName: 'Reddit Python',
        language: 'en',
        shelfIds: ['it'],
        title: ' shared reddit title ',
        url: 'https://www.reddit.com/r/python/comments/example_b',
        summary: 'Second copy.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['Reddit'],
        entryTags: ['python'],
        sourceItemId: 'reddit-b',
        provenance: [
          {
            feedId: 'reddit-python',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'reddit-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['reddit-python'],
      },
    ],
    { feeds },
  );

  assert.equal(deduped.length, 2);
});

test('dedupeArticles does not fuzzy-merge non-allowlisted cross-source title matches within 72 hours', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-fuzzy-nonfamily-a',
      feedId: 'publickey-feed',
      sourceName: 'Publickey',
      language: 'ja',
      shelfIds: ['it'],
      title: 'Shared cross-source title',
      url: 'https://www.publickey1.jp/posts/shared-a.html',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['Publickey'],
      entryTags: ['news'],
      sourceItemId: 'publickey-shared-a',
      provenance: [
        {
          feedId: 'publickey-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'publickey-shared-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['publickey-feed'],
    },
    {
      id: 'article-fuzzy-nonfamily-b',
      feedId: 'gigazine-feed',
      sourceName: 'GIGAZINE',
      language: 'ja',
      shelfIds: ['it'],
      title: ' shared cross-source title ',
      url: 'https://gigazine.net/news/shared-b/',
      summary: 'Another summary.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'GIGAZINE',
      imageUrl: null,
      sourceTags: ['GIGAZINE'],
      entryTags: ['news'],
      sourceItemId: 'gigazine-shared-b',
      provenance: [
        {
          feedId: 'gigazine-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'gigazine-shared-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['gigazine-feed'],
    },
  ]);

  assert.equal(deduped.length, 2);
});

test('dedupeArticlesWithSummary reports punctuation-folded titleCompareKey for broader fuzzy matches', () => {
  const articles = [
    {
      id: 'article-fuzzy-punct-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared: Title (Update)',
      url: 'https://example.com/posts/shared-punct-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-punct-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-punct-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-punct-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: ' shared title update ',
      url: 'https://example.com/posts/shared-punct-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared-update.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-punct-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-punct-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ];

  const enabled = dedupeArticlesWithSummary(articles);
  assert.equal(enabled.articles.length, 1);
  assert.equal(enabled.fuzzyDuplicatesCollapsed, 1);
  assert.equal(
    enabled.fuzzyAuditRecords[0]?.titleCompareKey,
    'shared title update',
  );
  assert.equal(
    enabled.fuzzyHandoffRecords[0]?.titleCompareKey,
    'shared title update',
  );
});

test('dedupeArticlesWithSummary suppresses repeat fuzzy audit and handoff records for accepted pairs', () => {
  const articles = [
    {
      id: 'article-fuzzy-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared Title',
      url: 'https://example.com/posts/shared-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: '  shared   title  ',
      url: 'https://example.com/posts/shared-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ];

  const accepted = dedupeArticlesWithSummary(articles, {
    fuzzyAcceptEntries: [
      {
        articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: 'shared title',
        incomingTitle: 'Shared Title',
        note: 'reviewed true positive',
      },
    ],
  });

  assert.equal(accepted.articles.length, 1);
  assert.equal(accepted.fuzzyDuplicatesCollapsed, 1);
  assert.deepEqual(accepted.fuzzyAuditRecords, []);
  assert.deepEqual(accepted.fuzzyHandoffRecords, []);
});

test('dedupeArticlesWithSummary prefers reject entries over accept entries when both match', () => {
  const articles = [
    {
      id: 'article-fuzzy-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared Title',
      url: 'https://example.com/posts/shared-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: '  shared   title  ',
      url: 'https://example.com/posts/shared-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ];

  const conflict = dedupeArticlesWithSummary(articles, {
    fuzzyRejectEntries: [
      {
        articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
        matchedBy: 'fuzzyTitleDate',
        note: 'known false positive',
      },
    ],
    fuzzyAcceptEntries: [
      {
        articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
        matchedBy: 'fuzzyTitleDate',
        note: 'reviewed true positive',
      },
    ],
  });

  assert.equal(conflict.articles.length, 2);
  assert.equal(conflict.fuzzyDuplicatesCollapsed, 0);
  assert.deepEqual(conflict.fuzzyAuditRecords, []);
  assert.deepEqual(conflict.fuzzyHandoffRecords, []);
});

test('dedupeArticles does not fuzzy-merge same-source title matches outside the 72 hour window', () => {
  const deduped = dedupeArticles([
    {
      id: 'article-window-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared Title',
      url: 'https://example.com/posts/window-a',
      summary: 'Older article.',
      publishedAt: '2026-03-01T00:00:00.000Z',
      fetchedAt: '2026-03-01T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-window-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-01T06:00:00.000Z',
          lastSeenAt: '2026-03-01T06:00:00.000Z',
          sourceItemId: 'rss-window-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-window-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'shared title',
      url: 'https://example.com/posts/window-b',
      summary: 'Newer article.',
      publishedAt: '2026-03-05T00:00:01.000Z',
      fetchedAt: '2026-03-05T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-window-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-05T06:00:00.000Z',
          lastSeenAt: '2026-03-05T06:00:00.000Z',
          sourceItemId: 'atom-window-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ]);

  assert.equal(deduped.length, 2);
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
        provenance: [
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'article-1',
            matchedBy: 'primary',
          },
        ],
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
  assert.equal(publicExports.articles[0].alsoSeenInSourceIds, undefined);
  assert.equal(publicExports.shelves[0].id, 'examples');
  assert.equal(publicExports.categories[0].id, 'examples');
  assert.equal(publicExports.sources[0].shelfIds[0], 'examples');
  assert.equal(publicExports.tags[0].label, 'Cloud');
  assert.equal(publicExports.searchIndex[0].shelfIds[0], 'examples');
  assert.equal(publicExports.meta.shelfCount, 1);
  assert.equal(publicExports.meta.categoryCount, 1);
});

test('buildPublicExports derives alsoSeenInSourceIds from secondary provenance', () => {
  const publicExports = buildPublicExports({
    articles: [
      {
        id: 'shared-article',
        feedId: 'rss-feed',
        sourceName: 'Example RSS',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Shared exported article',
        url: 'https://example.com/shared-exported',
        summary: 'Shared exported summary',
        publishedAt: '2026-03-08T01:02:03.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['RSS Source'],
        entryTags: ['Cloud'],
        sourceItemId: 'shared-article',
        provenance: [
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'shared-article',
            matchedBy: 'primary',
          },
          {
            feedId: 'atom-feed',
            firstSeenAt: '2026-03-08T06:05:00.000Z',
            lastSeenAt: '2026-03-08T06:05:00.000Z',
            sourceItemId: 'shared-article-atom',
            matchedBy: 'normalizedUrl',
          },
        ],
        seenInFeeds: ['rss-feed', 'atom-feed'],
      },
    ],
    feeds: [RSS_FEED, ATOM_FEED],
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

  assert.deepEqual(publicExports.articles[0].alsoSeenInSourceIds, [
    'atom-feed',
  ]);
});

test('slugifyCategoryLabel keeps compatibility export stable', () => {
  assert.equal(slugifyCategoryLabel('C++'), 'c');
  assert.equal(slugifyCategoryLabel('C#'), 'c');
});

test('runPipeline reports fuzzyDuplicatesCollapsed and supports disableFuzzyDedupe', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-summary-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'rss-feed',
        name: 'Example Source',
      },
      {
        ...RSS_FEED,
        id: 'atom-feed',
        name: 'Example Source',
        feedUrl: 'https://example.com/atom.xml',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  const normalizedArticles = [
    {
      id: 'article-fuzzy-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared Title',
      url: 'https://example.com/posts/shared-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: 'shared title',
      url: 'https://example.com/posts/shared-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ];

  const loggerMessages: unknown[] = [];
  const enabledSummary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'enabled-public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    normalizedArticles,
    logger: {
      log(message: unknown) {
        loggerMessages.push(message);
      },
    },
  });

  assert.equal(enabledSummary.normalizedArticles, 2);
  assert.equal(enabledSummary.dedupedArticles, 1);
  assert.equal(enabledSummary.duplicatesCollapsed, 1);
  assert.equal(enabledSummary.fuzzyDuplicatesCollapsed, 1);
  assert.ok(
    loggerMessages.some((message) =>
      String(message).includes('fuzzyDuplicatesCollapsed=1'),
    ),
  );

  const disabledSummary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'disabled-public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    normalizedArticles,
    disableFuzzyDedupe: true,
    logger: { log() {} },
  });

  assert.equal(disabledSummary.dedupedArticles, 2);
  assert.equal(disabledSummary.duplicatesCollapsed, 0);
  assert.equal(disabledSummary.fuzzyDuplicatesCollapsed, 0);
});

test('runPipeline applies allowlisted source-family fuzzy fallback for sibling feed title matches within 72 hours', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-family-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'qiita-popular',
        name: 'Qiita Popular',
        fuzzySourceFamilyKey: 'qiita',
      },
      {
        ...RSS_FEED,
        id: 'qiita-rust',
        name: 'Qiita Rust Tag',
        feedUrl: 'https://example.com/qiita-rust.xml',
        fuzzySourceFamilyKey: 'qiita',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  const normalizedArticles = [
    {
      id: 'article-fuzzy-family-a',
      feedId: 'qiita-popular',
      sourceName: 'Qiita Popular',
      language: 'ja',
      shelfIds: ['it'],
      title: 'Qiita shared article',
      url: 'https://qiita.com/example/items/shared-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['Qiita'],
      entryTags: ['popular'],
      sourceItemId: 'qiita-shared-a',
      provenance: [
        {
          feedId: 'qiita-popular',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'qiita-shared-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['qiita-popular'],
    },
    {
      id: 'article-fuzzy-family-b',
      feedId: 'qiita-rust',
      sourceName: 'Qiita Rust Tag',
      language: 'ja',
      shelfIds: ['it', 'science'],
      title: '  qiita   shared article  ',
      url: 'https://qiita.com/example/items/shared-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Qiita Author',
      imageUrl: 'https://qiita.com/shared.jpg',
      sourceTags: ['Qiita'],
      entryTags: ['rust'],
      sourceItemId: 'qiita-shared-b',
      provenance: [
        {
          feedId: 'qiita-rust',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'qiita-shared-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['qiita-rust'],
    },
  ];

  const summary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    fuzzyAuditPath,
    normalizedArticles,
    logger: { log() {} },
  });

  assert.equal(summary.dedupedArticles, 1);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 1);
  assert.deepEqual(JSON.parse(await fs.readFile(fuzzyAuditPath, 'utf8')), [
    {
      winnerArticleId: 'article-fuzzy-family-b',
      incomingArticleId: 'article-fuzzy-family-b',
      winnerFeedId: 'qiita-rust',
      incomingFeedId: 'qiita-rust',
      titleCompareKey: 'qiita shared article',
      publishedAtDeltaHours: 72,
      matchedBy: 'fuzzyTitleDate',
      scopeKind: 'sourceFamily',
    },
  ]);
});

test('runPipeline applies allowlisted registrable-domain fuzzy fallback when source and family fallback do not apply', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-domain-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'zenn-alpha',
        name: 'Zenn Alpha',
        feedUrl: 'https://feeds.example.net/zenn-alpha.xml',
        siteUrl: 'https://alpha.zenn.dev/',
        fuzzyRegistrableDomainKey: 'zenn.dev',
      },
      {
        ...RSS_FEED,
        id: 'zenn-beta',
        name: 'Zenn Beta',
        feedUrl: 'https://feeds.example.net/zenn-beta.xml',
        siteUrl: 'https://beta.zenn.dev/topics/rust',
        fuzzyRegistrableDomainKey: 'zenn.dev',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  const normalizedArticles = [
    {
      id: 'article-fuzzy-domain-run-a',
      feedId: 'zenn-alpha',
      sourceName: 'Zenn Alpha',
      language: 'ja',
      shelfIds: ['it'],
      title: 'Zenn runtime shared article',
      url: 'https://zenn.dev/example/articles/run-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['Zenn'],
      entryTags: ['alpha'],
      sourceItemId: 'run-a',
      provenance: [
        {
          feedId: 'zenn-alpha',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'run-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['zenn-alpha'],
    },
    {
      id: 'article-fuzzy-domain-run-b',
      feedId: 'zenn-beta',
      sourceName: 'Zenn Beta',
      language: 'ja',
      shelfIds: ['it'],
      title: ' zenn runtime shared article ',
      url: 'https://zenn.dev/example/articles/run-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Zenn Author',
      imageUrl: null,
      sourceTags: ['Zenn'],
      entryTags: ['beta'],
      sourceItemId: 'run-b',
      provenance: [
        {
          feedId: 'zenn-beta',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'run-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['zenn-beta'],
    },
  ];

  const summary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    fuzzyAuditPath,
    normalizedArticles,
    logger: { log() {} },
  });

  assert.equal(summary.dedupedArticles, 1);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 1);
  assert.deepEqual(JSON.parse(await fs.readFile(fuzzyAuditPath, 'utf8')), [
    {
      winnerArticleId: 'article-fuzzy-domain-run-b',
      incomingArticleId: 'article-fuzzy-domain-run-b',
      winnerFeedId: 'zenn-beta',
      incomingFeedId: 'zenn-beta',
      titleCompareKey: 'zenn runtime shared article',
      publishedAtDeltaHours: 72,
      matchedBy: 'fuzzyTitleDate',
      scopeKind: 'registrableDomain',
    },
  ]);
});

test('runPipeline applies broader punctuation-folded fuzzy fallback for same-source title matches within 72 hours', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-punct-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'rss-feed',
        name: 'Example Source',
      },
      {
        ...RSS_FEED,
        id: 'atom-feed',
        name: 'Example Source',
        feedUrl: 'https://example.com/atom.xml',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  const normalizedArticles = [
    {
      id: 'article-fuzzy-punct-a',
      feedId: 'rss-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples'],
      title: 'Shared: Title (Update)',
      url: 'https://example.com/posts/shared-punct-a',
      summary: 'Short summary.',
      publishedAt: '2026-03-08T00:00:00.000Z',
      fetchedAt: '2026-03-08T06:00:00.000Z',
      author: null,
      imageUrl: null,
      sourceTags: ['RSS Source'],
      entryTags: ['rss'],
      sourceItemId: 'rss-shared-punct-a',
      provenance: [
        {
          feedId: 'rss-feed',
          firstSeenAt: '2026-03-08T06:00:00.000Z',
          lastSeenAt: '2026-03-08T06:00:00.000Z',
          sourceItemId: 'rss-shared-punct-a',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['rss-feed'],
    },
    {
      id: 'article-fuzzy-punct-b',
      feedId: 'atom-feed',
      sourceName: 'Example Source',
      language: 'en',
      shelfIds: ['examples', 'research'],
      title: ' shared title update ',
      url: 'https://example.com/posts/shared-punct-b',
      summary: 'Longer summary with more useful detail.',
      publishedAt: '2026-03-10T23:59:59.000Z',
      fetchedAt: '2026-03-10T06:05:00.000Z',
      author: 'Atom Author',
      imageUrl: 'https://example.com/shared-update.jpg',
      sourceTags: ['Atom Source'],
      entryTags: ['atom'],
      sourceItemId: 'atom-shared-punct-b',
      provenance: [
        {
          feedId: 'atom-feed',
          firstSeenAt: '2026-03-10T06:05:00.000Z',
          lastSeenAt: '2026-03-10T06:05:00.000Z',
          sourceItemId: 'atom-shared-punct-b',
          matchedBy: 'primary',
        },
      ],
      seenInFeeds: ['atom-feed'],
    },
  ];

  const summary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    fuzzyAuditPath,
    normalizedArticles,
    logger: { log() {} },
  });

  assert.equal(summary.dedupedArticles, 1);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 1);
  assert.deepEqual(JSON.parse(await fs.readFile(fuzzyAuditPath, 'utf8')), [
    {
      winnerArticleId: 'article-fuzzy-punct-b',
      incomingArticleId: 'article-fuzzy-punct-b',
      winnerFeedId: 'atom-feed',
      incomingFeedId: 'atom-feed',
      titleCompareKey: 'shared title update',
      publishedAtDeltaHours: 72,
      matchedBy: 'fuzzyTitleDate',
      scopeKind: 'source',
    },
  ]);
});

test('runPipeline writes fuzzy audit JSON when --fuzzy-audit-file is provided', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-audit-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'rss-feed',
        name: 'Example Source',
      },
      {
        ...RSS_FEED,
        id: 'atom-feed',
        name: 'Example Source',
        feedUrl: 'https://example.com/atom.xml',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    fuzzyAuditPath,
    normalizedArticles: [
      {
        id: 'article-fuzzy-a',
        feedId: 'rss-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Shared Title',
        url: 'https://example.com/posts/shared-a',
        summary: 'Short summary.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['RSS Source'],
        entryTags: ['rss'],
        sourceItemId: 'rss-shared-a',
        provenance: [
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'rss-shared-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['rss-feed'],
      },
      {
        id: 'article-fuzzy-b',
        feedId: 'atom-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples', 'research'],
        title: 'shared title',
        url: 'https://example.com/posts/shared-b',
        summary: 'Longer summary with more useful detail.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Atom Author',
        imageUrl: 'https://example.com/shared.jpg',
        sourceTags: ['Atom Source'],
        entryTags: ['atom'],
        sourceItemId: 'atom-shared-b',
        provenance: [
          {
            feedId: 'atom-feed',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'atom-shared-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['atom-feed'],
      },
    ],
    logger: { log() {} },
  });

  const fuzzyAudit = JSON.parse(await fs.readFile(fuzzyAuditPath, 'utf8'));
  assert.deepEqual(fuzzyAudit, [
    {
      winnerArticleId: 'article-fuzzy-b',
      incomingArticleId: 'article-fuzzy-b',
      winnerFeedId: 'atom-feed',
      incomingFeedId: 'atom-feed',
      titleCompareKey: 'shared title',
      publishedAtDeltaHours: 72,
      matchedBy: 'fuzzyTitleDate',
      scopeKind: 'source',
    },
  ]);
});

test('runPipeline writes fuzzy handoff JSON when --fuzzy-handoff-file is provided', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-handoff-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyHandoffPath = path.join(tempDir, 'reports', 'fuzzy-handoff.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'rss-feed',
        name: 'Example Source',
      },
      {
        ...RSS_FEED,
        id: 'atom-feed',
        name: 'Example Source',
        feedUrl: 'https://example.com/atom.xml',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    fuzzyHandoffPath,
    normalizedArticles: [
      {
        id: 'article-fuzzy-a',
        feedId: 'rss-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Shared Title',
        url: 'https://example.com/posts/shared-a',
        summary: 'Short summary.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['RSS Source'],
        entryTags: ['rss'],
        sourceItemId: 'rss-shared-a',
        provenance: [
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'rss-shared-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['rss-feed'],
      },
      {
        id: 'article-fuzzy-b',
        feedId: 'atom-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples', 'research'],
        title: 'shared title',
        url: 'https://example.com/posts/shared-b',
        summary: 'Longer summary with more useful detail.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Atom Author',
        imageUrl: 'https://example.com/shared.jpg',
        sourceTags: ['Atom Source'],
        entryTags: ['atom'],
        sourceItemId: 'atom-shared-b',
        provenance: [
          {
            feedId: 'atom-feed',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'atom-shared-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['atom-feed'],
      },
    ],
    logger: { log() {} },
  });

  const fuzzyHandoff = JSON.parse(await fs.readFile(fuzzyHandoffPath, 'utf8'));
  assert.deepEqual(fuzzyHandoff, [
    {
      winnerArticleId: 'article-fuzzy-b',
      incomingArticleId: 'article-fuzzy-b',
      winnerFeedId: 'atom-feed',
      incomingFeedId: 'atom-feed',
      titleCompareKey: 'shared title',
      publishedAtDeltaHours: 72,
      matchedBy: 'fuzzyTitleDate',
      winnerTitle: 'shared title',
      incomingTitle: 'shared title',
      winnerUrl: 'https://example.com/posts/shared-b',
      incomingUrl: 'https://example.com/posts/shared-b',
      winnerSourceName: 'Example Source',
      incomingSourceName: 'Example Source',
      scopeKind: 'source',
    },
  ]);
});

test('runPipeline suppresses fuzzy merges when --fuzzy-reject-file is provided', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-reject-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyRejectPath = path.join(tempDir, 'reports', 'fuzzy-reject.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'rss-feed',
        name: 'Example Source',
      },
      {
        ...RSS_FEED,
        id: 'atom-feed',
        name: 'Example Source',
        feedUrl: 'https://example.com/atom.xml',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);
  await fs.mkdir(path.dirname(fuzzyRejectPath), { recursive: true });
  await fs.writeFile(
    fuzzyRejectPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: 'shared title',
        incomingTitle: 'Shared Title',
        note: 'known false positive',
      },
    ]),
  );

  const summary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    fuzzyRejectPath,
    normalizedArticles: [
      {
        id: 'article-fuzzy-a',
        feedId: 'rss-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Shared Title',
        url: 'https://example.com/posts/shared-a',
        summary: 'Short summary.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['RSS Source'],
        entryTags: ['rss'],
        sourceItemId: 'rss-shared-a',
        provenance: [
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'rss-shared-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['rss-feed'],
      },
      {
        id: 'article-fuzzy-b',
        feedId: 'atom-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples', 'research'],
        title: 'shared title',
        url: 'https://example.com/posts/shared-b',
        summary: 'Longer summary with more useful detail.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Atom Author',
        imageUrl: 'https://example.com/shared.jpg',
        sourceTags: ['Atom Source'],
        entryTags: ['atom'],
        sourceItemId: 'atom-shared-b',
        provenance: [
          {
            feedId: 'atom-feed',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'atom-shared-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['atom-feed'],
      },
    ],
    logger: { log() {} },
  });

  assert.equal(summary.dedupedArticles, 2);
  assert.equal(summary.duplicatesCollapsed, 0);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 0);
  assert.equal(summary.publicArticles, 2);
});

test('runPipeline writes canonical fuzzy review-state JSON when --fuzzy-review-state-file is provided', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-review-state-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyRejectPath = path.join(tempDir, 'reports', 'fuzzy-reject.json');
  const fuzzyAcceptPath = path.join(tempDir, 'reports', 'fuzzy-accept.json');
  const fuzzyReviewStatePath = path.join(
    tempDir,
    'reports',
    'fuzzy-review-state.json',
  );

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED]));
  await fs.writeFile(shelvesPath, SHELVES_YAML);
  await fs.mkdir(path.dirname(fuzzyRejectPath), { recursive: true });
  await fs.writeFile(
    fuzzyRejectPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-b', 'article-fuzzy-a'],
        matchedBy: 'fuzzyTitleDate',
        note: 'known false positive',
      },
      {
        articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: 'Shared Title',
      },
      {
        articleIdPair: ['article-fuzzy-d', 'article-fuzzy-c'],
        matchedBy: 'fuzzyTitleDate',
        incomingTitle: 'Other Incoming',
      },
    ]),
  );
  await fs.writeFile(
    fuzzyAcceptPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-b', 'article-fuzzy-a'],
        matchedBy: 'fuzzyTitleDate',
        note: 'should lose to reject',
      },
      {
        articleIdPair: ['article-fuzzy-f', 'article-fuzzy-e'],
        matchedBy: 'fuzzyTitleDate',
        note: 'reviewed true positive',
      },
      {
        articleIdPair: ['article-fuzzy-e', 'article-fuzzy-f'],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: 'Winner Title',
      },
    ]),
  );

  await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-12T00:00:00Z',
    fuzzyRejectPath,
    fuzzyAcceptPath,
    fuzzyReviewStatePath,
    logger: { log() {} },
  });

  assert.deepEqual(
    JSON.parse(await fs.readFile(fuzzyReviewStatePath, 'utf8')),
    {
      accepted: [
        {
          articleIdPair: ['article-fuzzy-e', 'article-fuzzy-f'],
          matchedBy: 'fuzzyTitleDate',
          winnerTitle: 'Winner Title',
          note: 'reviewed true positive',
        },
      ],
      rejected: [
        {
          articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
          matchedBy: 'fuzzyTitleDate',
          winnerTitle: 'Shared Title',
          note: 'known false positive',
        },
        {
          articleIdPair: ['article-fuzzy-c', 'article-fuzzy-d'],
          matchedBy: 'fuzzyTitleDate',
          incomingTitle: 'Other Incoming',
        },
      ],
    },
  );
});

test('runPipeline writes fuzzy review HTML when --fuzzy-review-html-file is provided', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-review-html-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyRejectPath = path.join(tempDir, 'reports', 'fuzzy-reject.json');
  const fuzzyAcceptPath = path.join(tempDir, 'reports', 'fuzzy-accept.json');
  const fuzzyReviewHtmlPath = path.join(
    tempDir,
    'reports',
    'fuzzy-review.html',
  );

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'rss-feed',
        name: 'Example Source',
      },
      {
        ...RSS_FEED,
        id: 'atom-feed',
        name: 'Example Source',
        feedUrl: 'https://example.com/atom.xml',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);
  await fs.mkdir(path.dirname(fuzzyRejectPath), { recursive: true });
  await fs.writeFile(
    fuzzyRejectPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-d', 'article-fuzzy-c'],
        matchedBy: 'fuzzyTitleDate',
        note: 'known false positive',
      },
    ]),
  );
  await fs.writeFile(
    fuzzyAcceptPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-f', 'article-fuzzy-e'],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: 'Winner Title',
        note: 'reviewed true positive',
      },
    ]),
  );

  await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-12T00:00:00Z',
    fuzzyRejectPath,
    fuzzyAcceptPath,
    fuzzyReviewHtmlPath,
    normalizedArticles: [
      {
        id: 'article-fuzzy-a',
        feedId: 'rss-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Shared Title',
        url: 'https://example.com/posts/shared-a',
        summary: 'Short summary.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['RSS Source'],
        entryTags: ['rss'],
        sourceItemId: 'rss-shared-a',
        provenance: [
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'rss-shared-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['rss-feed'],
      },
      {
        id: 'article-fuzzy-b',
        feedId: 'atom-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples', 'research'],
        title: 'shared title',
        url: 'https://example.com/posts/shared-b',
        summary: 'Longer summary with more useful detail.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Atom Author',
        imageUrl: 'https://example.com/shared.jpg',
        sourceTags: ['Atom Source'],
        entryTags: ['atom'],
        sourceItemId: 'atom-shared-b',
        provenance: [
          {
            feedId: 'atom-feed',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'atom-shared-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['atom-feed'],
      },
    ],
    logger: { log() {} },
  });

  const html = await fs.readFile(fuzzyReviewHtmlPath, 'utf8');

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>FeedShelf fuzzy review<\/title>/);
  assert.match(html, /Current-run fuzzy candidates/);
  assert.match(html, /Accepted review-state entries/);
  assert.match(html, /Rejected review-state entries/);
  assert.match(html, /https:\/\/example\.com\/posts\/shared-b/);
  assert.match(html, /article-fuzzy-b/);
  assert.match(html, /status-badge--unreviewed/);
  assert.match(html, /status-badge--accepted/);
  assert.match(html, /status-badge--rejected/);
  assert.match(html, /scopeKind=source/);
  assert.match(html, /reviewed true positive/);
  assert.match(html, /known false positive/);
  assert.doesNotMatch(html, /localStorage/);
  assert.doesNotMatch(html, /<form/i);
});

test('runPipeline suppresses repeat fuzzy audit and handoff records when --fuzzy-accept-file is provided', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-fuzzy-accept-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const fuzzyAuditPath = path.join(tempDir, 'reports', 'fuzzy-audit.json');
  const fuzzyHandoffPath = path.join(tempDir, 'reports', 'fuzzy-handoff.json');
  const fuzzyAcceptPath = path.join(tempDir, 'reports', 'fuzzy-accept.json');

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'rss-feed',
        name: 'Example Source',
      },
      {
        ...RSS_FEED,
        id: 'atom-feed',
        name: 'Example Source',
        feedUrl: 'https://example.com/atom.xml',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);
  await fs.mkdir(path.dirname(fuzzyAcceptPath), { recursive: true });
  await fs.writeFile(
    fuzzyAcceptPath,
    JSON.stringify([
      {
        articleIdPair: ['article-fuzzy-a', 'article-fuzzy-b'],
        matchedBy: 'fuzzyTitleDate',
        winnerTitle: 'shared title',
        incomingTitle: 'Shared Title',
        note: 'reviewed true positive',
      },
    ]),
  );

  const summary = await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir: path.join(tempDir, 'public-data'),
    dryRun: true,
    generatedAt: '2026-03-10T06:05:00Z',
    fuzzyAuditPath,
    fuzzyHandoffPath,
    fuzzyAcceptPath,
    normalizedArticles: [
      {
        id: 'article-fuzzy-a',
        feedId: 'rss-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples'],
        title: 'Shared Title',
        url: 'https://example.com/posts/shared-a',
        summary: 'Short summary.',
        publishedAt: '2026-03-08T00:00:00.000Z',
        fetchedAt: '2026-03-08T06:00:00.000Z',
        author: null,
        imageUrl: null,
        sourceTags: ['RSS Source'],
        entryTags: ['rss'],
        sourceItemId: 'rss-shared-a',
        provenance: [
          {
            feedId: 'rss-feed',
            firstSeenAt: '2026-03-08T06:00:00.000Z',
            lastSeenAt: '2026-03-08T06:00:00.000Z',
            sourceItemId: 'rss-shared-a',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['rss-feed'],
      },
      {
        id: 'article-fuzzy-b',
        feedId: 'atom-feed',
        sourceName: 'Example Source',
        language: 'en',
        shelfIds: ['examples', 'research'],
        title: 'shared title',
        url: 'https://example.com/posts/shared-b',
        summary: 'Longer summary with more useful detail.',
        publishedAt: '2026-03-10T23:59:59.000Z',
        fetchedAt: '2026-03-10T06:05:00.000Z',
        author: 'Atom Author',
        imageUrl: 'https://example.com/shared.jpg',
        sourceTags: ['Atom Source'],
        entryTags: ['atom'],
        sourceItemId: 'atom-shared-b',
        provenance: [
          {
            feedId: 'atom-feed',
            firstSeenAt: '2026-03-10T06:05:00.000Z',
            lastSeenAt: '2026-03-10T06:05:00.000Z',
            sourceItemId: 'atom-shared-b',
            matchedBy: 'primary',
          },
        ],
        seenInFeeds: ['atom-feed'],
      },
    ],
  });

  const fuzzyAudit = JSON.parse(await fs.readFile(fuzzyAuditPath, 'utf8'));
  const fuzzyHandoff = JSON.parse(await fs.readFile(fuzzyHandoffPath, 'utf8'));

  assert.equal(summary.dedupedArticles, 1);
  assert.equal(summary.fuzzyDuplicatesCollapsed, 1);
  assert.deepEqual(fuzzyAudit, []);
  assert.deepEqual(fuzzyHandoff, []);
});

test('runPipeline writes shelves.json, shelf route shells, and reports shelf/category counts', async () => {
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
  const sourcesJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'sources.json'), 'utf8'),
  );
  const tagsJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'tags.json'), 'utf8'),
  );
  const searchIndexJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'search-index.json'), 'utf8'),
  );
  const metaJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'meta.json'), 'utf8'),
  );
  const categoriesJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'categories.json'), 'utf8'),
  );
  const shelfRouteHtml = await fs.readFile(
    path.join(tempDir, 'examples', 'index.html'),
    'utf8',
  );

  assert.equal(shelvesJson[0].id, 'examples');
  assert.equal(articlesJson[0].shelfIds[0], 'examples');
  assert.equal(sourcesJson[0].shelfIds[0], 'examples');
  assert.equal(tagsJson[0].label, 'Cloud');
  assert.equal(searchIndexJson[0].articleId, articlesJson[0].id);
  assert.equal(metaJson.shelfCount, 2);
  assert.equal(metaJson.categoryCount, 2);
  assert.equal(categoriesJson[0].id, shelvesJson[0].id);
  assert.match(shelfRouteHtml, /data-feedshelf-page="shelf"/);
  assert.match(shelfRouteHtml, /data-shelf-id="examples"/);
  assert.match(shelfRouteHtml, /related-sources-title/);
});

test('runPipeline applies deterministic Reddit cleanup before writing public articles', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-reddit-canonicalization-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const redditXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Reddit RSS</title>
    <item>
      <title>Reddit deterministic cleanup article</title>
      <link>https://old.reddit.com/r/programming/comments/abc123/example_post/?context=3&amp;sort=top&amp;share_id=demo&amp;utm_source=rss</link>
      <description><![CDATA[<p>Deterministic cleanup integration.</p>]]></description>
      <pubDate>Fri, 07 Mar 2026 09:00:00 +0900</pubDate>
      <guid>reddit-cleanup-1</guid>
    </item>
  </channel>
</rss>`;

  await fs.writeFile(
    feedsPath,
    JSON.stringify([
      {
        ...RSS_FEED,
        id: 'reddit-programming',
        name: 'Reddit /r/programming',
        siteUrl: 'https://www.reddit.com/r/programming/',
      },
    ]),
  );
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    generatedAt: '2026-03-08T06:00:00Z',
    logger: { log() {} },
    fetchImpl: async () => {
      throw new Error('deterministic rule table should not fetch');
    },
    feedDocuments: [
      {
        feedId: 'reddit-programming',
        xml: redditXml,
        fetchedAt: '2026-03-08T06:00:00Z',
      },
    ],
  });

  const articlesJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'articles.json'), 'utf8'),
  );
  assert.equal(
    articlesJson[0].url,
    'https://www.reddit.com/r/programming/comments/abc123/example_post',
  );
});

test('runPipeline applies canonicalization precision layer before writing public articles', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-run-canonicalization-'),
  );
  const feedsPath = path.join(tempDir, 'feeds.json');
  const shelvesPath = path.join(tempDir, 'shelves.yaml');
  const outputDir = path.join(tempDir, 'public-data');
  const hatenaXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hatena RSS</title>
    <item>
      <title>Hatena precision article</title>
      <link>https://b.hatena.ne.jp/entry/s/example.com/articles/precision?b=2&amp;a=1&amp;utm_source=rss</link>
      <description><![CDATA[<p>Precision layer integration.</p>]]></description>
      <pubDate>Fri, 07 Mar 2026 09:00:00 +0900</pubDate>
      <guid>hatena-precision-1</guid>
    </item>
  </channel>
</rss>`;

  await fs.writeFile(feedsPath, JSON.stringify([RSS_FEED]));
  await fs.writeFile(shelvesPath, SHELVES_YAML);

  await runPipeline({
    feedsPath,
    shelvesPath,
    outputDir,
    generatedAt: '2026-03-08T06:00:00Z',
    logger: { log() {} },
    fetchImpl: async (requestUrl: string) => {
      if (requestUrl === 'https://example.com/articles/precision?a=1&b=2') {
        return {
          ok: false,
          status: 302,
          url: requestUrl,
          headers: new Headers({
            location: 'https://example.com/articles/precision-final?b=2&a=1',
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        url: requestUrl,
        headers: new Headers(),
      };
    },
    feedDocuments: [
      {
        feedId: 'rss-feed',
        xml: hatenaXml,
        fetchedAt: '2026-03-08T06:00:00Z',
      },
    ],
  });

  const articlesJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'articles.json'), 'utf8'),
  );
  assert.equal(
    articlesJson[0].url,
    'https://example.com/articles/precision-final?a=1&b=2',
  );
});

test('repository feed registry keeps every shelf populated by enabled sources', async () => {
  const feeds: FeedDefinition[] = await loadFeeds(
    path.resolve(__dirname, '..', 'data/feeds.json'),
  );
  const shelves: ShelvesDocument = await loadShelves(
    path.resolve(__dirname, '..', 'data/shelves.yaml'),
  );

  const enabledFeeds = feeds.filter((feed: FeedDefinition) => feed.enabled);
  const enabledByShelf = new Map<string, number>();

  for (const shelf of shelves.shelves) {
    enabledByShelf.set(shelf.id, 0);
  }

  for (const feed of enabledFeeds) {
    for (const shelfId of feed.shelfIds) {
      enabledByShelf.set(shelfId, (enabledByShelf.get(shelfId) || 0) + 1);
    }
  }

  for (const shelf of shelves.shelves) {
    assert.ok(
      (enabledByShelf.get(shelf.id) || 0) > 0,
      `Shelf ${shelf.id} must keep at least one enabled source.`,
    );
  }

  const scienceEnabledIds = enabledFeeds
    .filter((feed: FeedDefinition) => feed.shelfIds.includes('science'))
    .map((feed: FeedDefinition) => feed.id);
  assert.ok(
    scienceEnabledIds.some(
      (id: string) => id !== 'sciencedaily-technology' && id !== 'nasa-news',
    ),
    'science shelf should not rely only on hard-science sources.',
  );
});

test('repository feed registry keeps documented first-party feeds and officially documented topic feeds enabled by default', async () => {
  const feeds = (await loadFeeds(
    path.resolve(__dirname, '..', 'data/feeds.json'),
  )) as FeedDefinition[];

  const byId = new Map<string, FeedDefinition>(
    feeds.map((feed: FeedDefinition) => [feed.id, feed]),
  );

  assert.equal(byId.get('itmedia-news')?.enabled, true);
  assert.equal(byId.get('itmedia-news')?.fuzzySourceFamilyKey, 'itmedia');
  assert.equal(
    byId.get('itmedia-news')?.fuzzyRegistrableDomainKey,
    'itmedia.co.jp',
  );
  assert.equal(byId.get('itmedia-aiplus')?.enabled, true);
  assert.equal(byId.get('itmedia-aiplus')?.fuzzySourceFamilyKey, 'itmedia');
  assert.equal(byId.get('qiita-popular')?.enabled, true);
  assert.equal(byId.get('qiita-popular')?.fuzzySourceFamilyKey, 'qiita');
  assert.equal(
    byId.get('qiita-popular')?.fuzzyRegistrableDomainKey,
    'qiita.com',
  );
  assert.equal(byId.get('gigazine')?.enabled, true);
  assert.equal(byId.get('gihyo')?.enabled, true);
  assert.equal(byId.get('codezine')?.enabled, true);
  assert.equal(byId.get('hatena-hotentry-it')?.enabled, true);
  assert.equal(byId.get('openai-news')?.enabled, true);
  assert.equal(byId.get('publickey')?.enabled, true);
  assert.equal(byId.get('zenn-feed')?.fuzzySourceFamilyKey, 'zenn');
  assert.equal(byId.get('zenn-feed')?.fuzzyRegistrableDomainKey, 'zenn.dev');
  assert.equal(byId.get('zenn-topic-python')?.enabled, true);
  assert.equal(byId.get('zenn-topic-python')?.fuzzySourceFamilyKey, 'zenn');
  assert.equal(byId.get('zenn-topic-rust')?.enabled, true);
  assert.equal(byId.get('zenn-topic-ai')?.enabled, true);
  assert.equal(byId.get('zenn-topic-neovim')?.enabled, true);
  assert.equal(byId.get('zenn-topic-linux')?.enabled, true);
  assert.equal(byId.get('zenn-topic-archlinux')?.enabled, true);
  assert.equal(byId.get('zenn-topic-llm')?.enabled, true);
  assert.equal(byId.get('reddit-python')?.enabled, true);
  assert.equal(byId.get('reddit-rust')?.enabled, true);
  assert.equal(byId.get('reddit-linux')?.enabled, true);
  assert.equal(byId.get('reddit-archlinux')?.enabled, true);
  assert.equal(byId.get('reddit-neovim')?.enabled, true);
  assert.equal(byId.get('reddit-localllama')?.enabled, true);
  assert.equal(byId.get('reddit-machinelearning')?.enabled, true);
});

test('repository feed registry keeps broad community feeds and hard-science sources disabled by default', async () => {
  const feeds = (await loadFeeds(
    path.resolve(__dirname, '..', 'data/feeds.json'),
  )) as FeedDefinition[];

  const byId = new Map<string, FeedDefinition>(
    feeds.map((feed: FeedDefinition) => [feed.id, feed]),
  );

  assert.equal(byId.get('reddit-programming')?.enabled, false);
  assert.equal(byId.get('reddit-physics')?.enabled, false);
  assert.equal(byId.get('zenn-feed')?.enabled, false);
  assert.equal(byId.get('zenn-topic-productivityweekly')?.enabled, false);
  assert.equal(byId.get('hacker-news')?.enabled, false);
  assert.equal(byId.get('sciencedaily-technology')?.enabled, false);
  assert.equal(byId.get('nasa-news')?.enabled, false);
});
