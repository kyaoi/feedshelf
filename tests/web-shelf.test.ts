const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  buildPublicExports,
  writePublicExports,
} = require('../scripts/pipeline/buildPublicExports');
const {
  buildShelfPageViewModel,
  EMPTY_SHELF_ARTICLES_MESSAGE,
  MISSING_SHELF_SELECTION_MESSAGE,
  UNKNOWN_SHELF_MESSAGE,
} = require('../public/assets/app.js');

const SHELVES_DOCUMENT = {
  site: {
    title: 'FeedShelf',
    description: 'Discover articles by shelf',
    intro: 'Curated shelves for reading',
  },
  shelves: [
    {
      id: 'it',
      title: 'IT',
      description: 'IT shelf',
    },
    {
      id: 'science',
      title: 'Science',
      description: 'Science shelf',
    },
  ],
};

const FEEDS = [
  {
    id: 'itmedia-news',
    name: 'ITmedia NEWS',
    feedUrl: 'https://example.com/itmedia.xml',
    siteUrl: 'https://example.com/itmedia',
    language: 'ja',
    enabled: true,
    shelfIds: ['it'],
    tags: ['Japan'],
  },
  {
    id: 'nature-briefing',
    name: 'Nature Briefing',
    feedUrl: 'https://example.com/nature.xml',
    siteUrl: 'https://example.com/nature',
    language: 'en',
    enabled: true,
    shelfIds: ['science'],
    tags: ['Research'],
  },
];

const CANONICAL_ARTICLES = [
  {
    id: 'article-1',
    feedId: 'itmedia-news',
    sourceName: 'ITmedia NEWS',
    language: 'ja',
    shelfIds: ['it'],
    title: 'IT article',
    url: 'https://example.com/it/article-1',
    summary: 'IT summary',
    publishedAt: '2026-03-09T00:00:00Z',
    fetchedAt: '2026-03-09T00:05:00Z',
    author: null,
    imageUrl: null,
    sourceTags: ['Japan'],
    entryTags: ['Cloud'],
    sourceItemId: 'it-1',
    provenance: [
      {
        feedId: 'itmedia-news',
        firstSeenAt: '2026-03-09T00:05:00Z',
        lastSeenAt: '2026-03-09T00:05:00Z',
        sourceItemId: 'it-1',
        matchedBy: 'primary',
      },
    ],
    seenInFeeds: ['itmedia-news'],
  },
  {
    id: 'article-2',
    feedId: 'itmedia-news',
    sourceName: 'ITmedia NEWS',
    language: 'ja',
    shelfIds: ['it'],
    title: 'Another IT article',
    url: 'https://example.com/it/article-2',
    summary: 'Another IT summary',
    publishedAt: '2026-03-08T00:00:00Z',
    fetchedAt: '2026-03-08T00:05:00Z',
    author: null,
    imageUrl: null,
    sourceTags: ['Japan'],
    entryTags: ['AI'],
    sourceItemId: 'it-2',
    provenance: [
      {
        feedId: 'itmedia-news',
        firstSeenAt: '2026-03-08T00:05:00Z',
        lastSeenAt: '2026-03-08T00:05:00Z',
        sourceItemId: 'it-2',
        matchedBy: 'primary',
      },
    ],
    seenInFeeds: ['itmedia-news'],
  },
  {
    id: 'article-3',
    feedId: 'nature-briefing',
    sourceName: 'Nature Briefing',
    language: 'en',
    shelfIds: ['science'],
    title: 'Science article',
    url: 'https://example.com/science/article-3',
    summary: 'Science summary',
    publishedAt: '2026-03-07T00:00:00Z',
    fetchedAt: '2026-03-07T00:05:00Z',
    author: null,
    imageUrl: null,
    sourceTags: ['Research'],
    entryTags: ['Physics'],
    sourceItemId: 'science-1',
    provenance: [
      {
        feedId: 'nature-briefing',
        firstSeenAt: '2026-03-07T00:05:00Z',
        lastSeenAt: '2026-03-07T00:05:00Z',
        sourceItemId: 'science-1',
        matchedBy: 'primary',
      },
    ],
    seenInFeeds: ['nature-briefing'],
  },
];

const PUBLIC_SHELVES = [
  {
    id: 'it',
    title: 'IT',
    description: 'IT shelf',
    articleCount: 2,
    sourceCount: 1,
    latestSortAt: '2026-03-09T00:00:00Z',
  },
  {
    id: 'science',
    title: 'Science',
    description: 'Science shelf',
    articleCount: 1,
    sourceCount: 1,
    latestSortAt: '2026-03-07T00:00:00Z',
  },
];

const PUBLIC_SOURCES = [
  {
    id: 'itmedia-news',
    name: 'ITmedia NEWS',
    siteUrl: 'https://example.com/itmedia',
    language: 'ja',
    shelfIds: ['it'],
    articleCount: 2,
    latestSortAt: '2026-03-09T00:00:00Z',
    tags: ['Japan'],
  },
  {
    id: 'nature-briefing',
    name: 'Nature Briefing',
    siteUrl: 'https://example.com/nature',
    language: 'en',
    shelfIds: ['science'],
    articleCount: 1,
    latestSortAt: '2026-03-07T00:00:00Z',
    tags: ['Research'],
  },
];

const PUBLIC_ARTICLES = [
  {
    id: 'article-1',
    title: 'IT article',
    url: 'https://example.com/it/article-1',
    summary: 'IT summary',
    publishedAt: '2026-03-09T00:00:00Z',
    sortAt: '2026-03-09T00:00:00Z',
    sourceId: 'itmedia-news',
    sourceName: 'ITmedia NEWS',
    shelfIds: ['it'],
    imageUrl: null,
    sourceTags: ['Japan'],
    entryTags: ['Cloud'],
  },
  {
    id: 'article-2',
    title: 'Another IT article',
    url: 'https://example.com/it/article-2',
    summary: 'Another IT summary',
    publishedAt: '2026-03-08T00:00:00Z',
    sortAt: '2026-03-08T00:00:00Z',
    sourceId: 'itmedia-news',
    sourceName: 'ITmedia NEWS',
    shelfIds: ['it'],
    imageUrl: null,
    sourceTags: ['Japan'],
    entryTags: ['AI'],
  },
  {
    id: 'article-3',
    title: 'Science article',
    url: 'https://example.com/science/article-3',
    summary: 'Science summary',
    publishedAt: '2026-03-07T00:00:00Z',
    sortAt: '2026-03-07T00:00:00Z',
    sourceId: 'nature-briefing',
    sourceName: 'Nature Briefing',
    shelfIds: ['science'],
    imageUrl: null,
    sourceTags: ['Research'],
    entryTags: ['Physics'],
  },
];

const META = {
  generatedAt: '2026-03-09T00:10:00Z',
};

test('checked-in generated shelf shells keep pagination placeholders in sync', async () => {
  for (const shelfId of ['ai', 'it', 'science']) {
    const shelfHtml = await fs.readFile(
      path.resolve(__dirname, '..', 'public', shelfId, 'index.html'),
      'utf8',
    );
    assert.match(shelfHtml, /id="articles-pagination"/);
  }
});

test('buildShelfPageViewModel returns missing-shelf when shelfId is empty', () => {
  const viewModel = buildShelfPageViewModel({
    shelfId: '',
    articles: [],
    shelves: [],
    sources: [],
    meta: META,
  });

  assert.equal(viewModel.kind, 'missing-shelf');
  assert.equal(viewModel.statusMessage, MISSING_SHELF_SELECTION_MESSAGE);
});

test('buildShelfPageViewModel returns unknown-shelf for invalid id', () => {
  const viewModel = buildShelfPageViewModel({
    shelfId: 'unknown',
    articles: [],
    shelves: PUBLIC_SHELVES,
    sources: PUBLIC_SOURCES,
    meta: META,
  });

  assert.equal(viewModel.kind, 'unknown-shelf');
  assert.equal(viewModel.statusMessage, UNKNOWN_SHELF_MESSAGE);
});

test('buildShelfPageViewModel derives featured articles and related sources', () => {
  const viewModel = buildShelfPageViewModel({
    shelfId: 'it',
    articles: PUBLIC_ARTICLES,
    shelves: PUBLIC_SHELVES,
    sources: PUBLIC_SOURCES,
    meta: META,
  });

  assert.equal(viewModel.kind, 'ready');
  assert.equal(viewModel.selectedShelfTitle, 'IT');
  assert.equal(viewModel.featuredArticles.length, 2);
  assert.equal(viewModel.articles.length, 2);
  assert.equal(viewModel.featuredArticles[0].title, 'IT article');
  assert.equal(viewModel.relatedSources.length, 1);
  assert.equal(viewModel.relatedSources[0].name, 'ITmedia NEWS');
  assert.equal(viewModel.relatedSources[0].href, '../sources/?id=itmedia-news');
  assert.match(viewModel.description, /注目 2 件/);
  assert.match(viewModel.description, /関連媒体 1 件/);
});

test('buildShelfPageViewModel returns empty-shelf when no articles match shelfId', () => {
  const viewModel = buildShelfPageViewModel({
    shelfId: 'science',
    articles: [],
    shelves: PUBLIC_SHELVES,
    sources: PUBLIC_SOURCES,
    meta: META,
  });

  assert.equal(viewModel.kind, 'empty-shelf');
  assert.equal(viewModel.statusMessage, EMPTY_SHELF_ARTICLES_MESSAGE);
  assert.equal(viewModel.relatedSources.length, 1);
});

test('writePublicExports escapes shelf metadata in generated shelf route shells', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-shelf-escape-'),
  );
  const outputDir = path.join(tempDir, 'data');
  const shelvesDocument = {
    ...SHELVES_DOCUMENT,
    shelves: [
      {
        id: 'research-notes',
        title: 'R&D <Daily>',
        description: 'AI & ML "notes" <beta>',
      },
    ],
  };
  const publicExports = buildPublicExports({
    articles: CANONICAL_ARTICLES.map((article) => ({
      ...article,
      shelfIds: ['research-notes'],
    })),
    feeds: FEEDS.map((feed) => ({
      ...feed,
      shelfIds: ['research-notes'],
    })),
    shelves: shelvesDocument,
    generatedAt: '2026-03-09T00:10:00Z',
  });

  await writePublicExports({
    outputDir,
    publicExports,
    shelvesDocument,
  });

  const shelfHtml = await fs.readFile(
    path.join(tempDir, 'research-notes', 'index.html'),
    'utf8',
  );

  assert.match(shelfHtml, /<title>R&amp;D &lt;Daily&gt; \| FeedShelf<\/title>/);
  assert.match(
    shelfHtml,
    /content="AI &amp; ML &quot;notes&quot; &lt;beta&gt; FeedShelf/,
  );
  assert.match(
    shelfHtml,
    /<h1 id="shelf-page-title">R&amp;D &lt;Daily&gt; 棚<\/h1>/,
  );
  assert.match(shelfHtml, /AI &amp; ML &quot;notes&quot; &lt;beta&gt;/);

  const renderedShelfHtml = shelfHtml.split(
    '<script id="feedshelf-bootstrap" type="application/json">',
  )[0];

  assert.doesNotMatch(renderedShelfHtml, /R&D <Daily>/);
  assert.doesNotMatch(renderedShelfHtml, /AI & ML "notes" <beta>/);
});

test('writePublicExports creates shelf route shells alongside public JSON', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedshelf-shelf-'));
  const outputDir = path.join(tempDir, 'data');
  const publicExports = buildPublicExports({
    articles: CANONICAL_ARTICLES,
    feeds: FEEDS,
    shelves: SHELVES_DOCUMENT,
    generatedAt: '2026-03-09T00:10:00Z',
  });

  await writePublicExports({
    outputDir,
    publicExports,
    shelvesDocument: SHELVES_DOCUMENT,
  });

  const shelfHtml = await fs.readFile(
    path.join(tempDir, 'it', 'index.html'),
    'utf8',
  );
  const shelvesJson = JSON.parse(
    await fs.readFile(path.join(outputDir, 'shelves.json'), 'utf8'),
  );

  assert.equal(shelvesJson[0].id, 'it');
  assert.match(shelfHtml, /data-feedshelf-page="shelf"/);
  assert.match(shelfHtml, /data-shelf-id="it"/);
  assert.match(shelfHtml, /IT 棚/);
  assert.match(shelfHtml, /注目記事/);
  assert.match(shelfHtml, /関連する媒体/);
});

test('writePublicExports prunes stale generated shelf routes and refreshes fixed tag route shells', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-shelf-prune-'),
  );
  const outputDir = path.join(tempDir, 'data');
  const initialExports = buildPublicExports({
    articles: CANONICAL_ARTICLES,
    feeds: FEEDS,
    shelves: SHELVES_DOCUMENT,
    generatedAt: '2026-03-09T00:10:00Z',
  });

  await writePublicExports({
    outputDir,
    publicExports: initialExports,
    shelvesDocument: SHELVES_DOCUMENT,
  });

  const fixedRouteDir = path.join(tempDir, 'tags');
  await fs.mkdir(fixedRouteDir, { recursive: true });
  await fs.writeFile(
    path.join(fixedRouteDir, 'index.html'),
    '<!doctype html><title>fixed route</title>',
  );

  const nextShelvesDocument = {
    ...SHELVES_DOCUMENT,
    shelves: SHELVES_DOCUMENT.shelves.filter((shelf) => shelf.id === 'it'),
  };
  const nextExports = buildPublicExports({
    articles: CANONICAL_ARTICLES.filter((article) =>
      article.shelfIds.includes('it'),
    ),
    feeds: FEEDS.filter((feed) => feed.shelfIds.includes('it')),
    shelves: nextShelvesDocument,
    generatedAt: '2026-03-10T00:10:00Z',
  });

  await writePublicExports({
    outputDir,
    publicExports: nextExports,
    shelvesDocument: nextShelvesDocument,
  });

  await assert.rejects(
    fs.readFile(path.join(tempDir, 'science', 'index.html'), 'utf8'),
    { code: 'ENOENT' },
  );
  const remainingShelfHtml = await fs.readFile(
    path.join(tempDir, 'it', 'index.html'),
    'utf8',
  );
  assert.match(remainingShelfHtml, /data-shelf-id="it"/);
  const fixedRouteHtml = await fs.readFile(
    path.join(fixedRouteDir, 'index.html'),
    'utf8',
  );
  assert.match(fixedRouteHtml, /FeedShelf \/ Tags/);
  assert.match(fixedRouteHtml, /feedshelf-bootstrap/);
});

test('writePublicExports writes shelf page shards for pagination bootstrap', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-shelf-pages-'),
  );
  const outputDir = path.join(tempDir, 'public-data');
  const articleCopies = Array.from({ length: 26 }, (_, index) => ({
    ...CANONICAL_ARTICLES[0],
    id: `copy-${index + 1}`,
    url: `https://example.com/articles/copy-${index + 1}`,
    publishedAt: `2026-03-${String((index % 9) + 1).padStart(2, '0')}T00:00:00Z`,
    sortAt: `2026-03-${String((index % 9) + 1).padStart(2, '0')}T00:00:00Z`,
  }));
  const publicExports = buildPublicExports({
    articles: articleCopies,
    feeds: FEEDS,
    shelves: SHELVES_DOCUMENT,
    generatedAt: '2026-03-10T00:10:00Z',
  });

  await writePublicExports({
    outputDir,
    publicExports,
    shelvesDocument: SHELVES_DOCUMENT,
  });

  const pageOne = JSON.parse(
    await fs.readFile(
      path.join(outputDir, 'pages', 'shelves', 'it', 'page-1.json'),
      'utf8',
    ),
  );
  const pageTwo = JSON.parse(
    await fs.readFile(
      path.join(outputDir, 'pages', 'shelves', 'it', 'page-2.json'),
      'utf8',
    ),
  );

  assert.equal(pageOne.routeKind, 'shelf');
  assert.equal(pageOne.page, 1);
  assert.equal(pageOne.totalPages, 2);
  assert.equal(pageOne.articles.length, 24);
  assert.equal(pageTwo.page, 2);
  assert.equal(pageTwo.articles.length, 2);
});

test('writePublicExports replaces prior bootstrap payload instead of duplicating it', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-bootstrap-refresh-'),
  );
  const outputDir = path.join(tempDir, 'data');
  const firstExports = buildPublicExports({
    articles: CANONICAL_ARTICLES,
    feeds: FEEDS,
    shelves: SHELVES_DOCUMENT,
    generatedAt: '2026-03-09T00:10:00Z',
  });
  const secondExports = buildPublicExports({
    articles: CANONICAL_ARTICLES,
    feeds: FEEDS,
    shelves: SHELVES_DOCUMENT,
    generatedAt: '2026-03-10T00:10:00Z',
  });

  await writePublicExports({
    outputDir,
    publicExports: firstExports,
    shelvesDocument: SHELVES_DOCUMENT,
  });
  await writePublicExports({
    outputDir,
    publicExports: secondExports,
    shelvesDocument: SHELVES_DOCUMENT,
  });

  for (const relativePath of [
    'index.html',
    'tags/index.html',
    'it/index.html',
  ]) {
    const html = await fs.readFile(path.join(tempDir, relativePath), 'utf8');
    const matches = html.match(/feedshelf-bootstrap/g) || [];
    assert.equal(matches.length, 1);
  }
});
