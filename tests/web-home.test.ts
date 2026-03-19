const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PAGE_QUERY_PARAM,
  buildDataPaths,
  buildPaginationHref,
  loadHomePageData,
  buildArticleViewModels,
  buildHomePageViewModel,
  buildShelfHrefFromHome,
  buildSourceNavigationItems,
  renderArticleItems,
  getPageFromLocation,
  MISSING_PUBLIC_DATA_ERROR,
} = require('../public/assets/app.js');

test('buildDataPaths includes shelves.json alongside existing public JSON files', () => {
  assert.deepEqual(buildDataPaths('.'), {
    articles: './data/articles.json',
    shelves: './data/shelves.json',
    categories: './data/categories.json',
    sources: './data/sources.json',
    tags: './data/tags.json',
    searchIndex: './data/search-index.json',
    meta: './data/meta.json',
  });
});

test('page query helpers keep canonical first page URLs stable', () => {
  assert.equal(getPageFromLocation({ search: '?page=3' }), 3);
  assert.equal(getPageFromLocation({ search: '?page=1' }), 1);
  assert.equal(getPageFromLocation({ search: '?page=0' }), 1);
  assert.equal(getPageFromLocation({ search: '' }), 1);
  assert.equal(PAGE_QUERY_PARAM, 'page');
  assert.equal(buildPaginationHref({ page: 1 }), './');
  assert.equal(buildPaginationHref({ page: 2 }), './?page=2');
});

test('loadHomePageData loads shelves.json and preserves fetch order', async () => {
  const calls: string[] = [];
  const fixtures: Record<string, unknown> = {
    './data/articles.json': [],
    './data/shelves.json': [
      {
        id: 'example',
        title: 'Example Shelf',
        description: 'Shelf description',
        articleCount: 1,
        sourceCount: 1,
        latestSortAt: '2026-03-10T00:00:00Z',
      },
    ],
    './data/categories.json': [
      {
        id: 'example',
        label: 'Example Shelf',
        articleCount: 1,
        latestSortAt: '2026-03-10T00:00:00Z',
      },
    ],
    './data/sources.json': [
      {
        id: 'source-1',
        name: 'Example Source',
        articleCount: 1,
        shelfIds: ['example'],
        language: 'en',
      },
    ],
    './data/tags.json': [],
    './data/meta.json': {
      articleCount: 1,
      sourceCount: 1,
      shelfCount: 1,
      categoryCount: 1,
    },
  };

  const payload = await loadHomePageData({
    fetchImpl: async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        async json() {
          return fixtures[url];
        },
      };
    },
  });

  assert.equal(payload.kind, 'ready');
  assert.deepEqual(calls, [
    './data/articles.json',
    './data/shelves.json',
    './data/categories.json',
    './data/sources.json',
    './data/tags.json',
    './data/meta.json',
  ]);
  assert.equal(payload.shelves[0].id, 'example');
});

test('loadHomePageData falls back to categories when shelves.json is missing', async () => {
  const payload = await loadHomePageData({
    fetchImpl: async (url: string) => {
      if (url === './data/shelves.json') {
        const error: Error & { status?: number } = new Error('missing');
        error.status = 404;
        throw error;
      }

      const fixtures: Record<string, unknown> = {
        './data/articles.json': [],
        './data/categories.json': [
          {
            id: 'example',
            label: 'Example Category',
            articleCount: 1,
            latestSortAt: '2026-03-10T00:00:00Z',
          },
        ],
        './data/sources.json': [],
        './data/tags.json': [],
        './data/meta.json': {
          shelfCount: 1,
          categoryCount: 1,
        },
      };

      return {
        ok: true,
        async json() {
          return fixtures[url];
        },
      };
    },
  });

  assert.equal(payload.kind, 'ready');
  assert.equal(payload.shelves[0].title, 'Example Category');
});

test('loadHomePageData returns missing-data when public JSON is absent', async () => {
  const payload = await loadHomePageData({
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });

  assert.deepEqual(payload, {
    kind: 'missing-data',
    message: MISSING_PUBLIC_DATA_ERROR,
  });
});

test('buildHomePageViewModel uses shelfCount and shelf summaries', () => {
  const viewModel = buildHomePageViewModel({
    kind: 'ready',
    articles: [
      {
        id: 'article-1',
        title: 'Example article',
        url: 'https://example.com/article',
        summary: 'summary',
        publishedAt: '2026-03-10T00:00:00Z',
        sortAt: '2026-03-10T00:00:00Z',
        sourceId: 'source-1',
        sourceName: 'Example Source',
        shelfIds: ['example'],
        imageUrl: null,
        sourceTags: ['Source Tag'],
        entryTags: ['Entry Tag'],
      },
    ],
    shelves: [
      {
        id: 'example',
        title: 'Example Shelf',
        description: 'Shelf description',
        articleCount: 1,
        sourceCount: 1,
        latestSortAt: '2026-03-10T00:00:00Z',
        sampleTags: ['Entry Tag', 'Source Tag'],
      },
    ],
    categories: [],
    sources: [
      {
        id: 'source-1',
        name: 'Example Source',
        articleCount: 1,
        shelfIds: ['example'],
        language: 'en',
      },
    ],
    tags: [],
    meta: {
      articleCount: 1,
      sourceCount: 1,
      shelfCount: 1,
    },
  });

  assert.equal(viewModel.stats[2].value, '1');
  assert.equal(viewModel.shelves[0].title, 'Example Shelf');
  assert.match(viewModel.shelves[0].description, /Shelf description/);
  assert.match(viewModel.shelves[0].description, /Entry Tag/);
});

test('buildArticleViewModels resolves bounded secondary-source chips for home cards', () => {
  const viewModels = buildArticleViewModels(
    [
      {
        id: 'article-1',
        title: 'Example article',
        url: 'https://example.com/article',
        summary: 'summary',
        publishedAt: '2026-03-10T00:00:00Z',
        sortAt: '2026-03-10T00:00:00Z',
        sourceId: 'source-1',
        sourceName: 'Example Source',
        alsoSeenInSourceIds: [
          'source-2',
          'missing-source',
          'source-3',
          'source-4',
        ],
        shelfIds: ['example'],
        imageUrl: null,
        sourceTags: ['Source Tag'],
        entryTags: ['Entry Tag'],
      },
    ],
    {
      sources: [
        {
          id: 'source-1',
          name: 'Example Source',
          articleCount: 1,
          shelfIds: ['example'],
          language: 'en',
        },
        {
          id: 'source-2',
          name: 'Mirror One',
          articleCount: 1,
          shelfIds: ['example'],
          language: 'en',
        },
        {
          id: 'source-3',
          name: 'Mirror Two',
          articleCount: 1,
          shelfIds: ['example'],
          language: 'en',
        },
        {
          id: 'source-4',
          name: 'Mirror Three',
          articleCount: 1,
          shelfIds: ['example'],
          language: 'en',
        },
      ],
      sourceHrefBuilder: (sourceId: string) => `./sources/?id=${sourceId}`,
    },
  );

  assert.deepEqual(viewModels[0].secondarySourceChips, [
    { label: 'Mirror One', href: './sources/?id=source-2' },
    { label: 'Mirror Two', href: './sources/?id=source-3' },
    { label: '+1', href: null },
  ]);

  const markup = renderArticleItems(viewModels);
  assert.match(markup, /article-card__secondary-sources/);
  assert.match(markup, /\.\/sources\/\?id=source-2/);
  assert.match(markup, />\+1</);
});

test('buildSourceNavigationItems shows shelf count and language', () => {
  const items = buildSourceNavigationItems([
    {
      id: 'source-1',
      name: 'Example Source',
      articleCount: 1,
      shelfIds: ['example'],
      language: 'en',
    },
  ]);

  assert.equal(items[0].metaLabel, '1 棚 / en');
});

test('README and shelf-first copy stay aligned with shelf routes and compatibility guidance', () => {
  const readme = fs.readFileSync(
    path.resolve(__dirname, '..', 'README.md'),
    'utf8',
  );
  const appSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'src/web/app.ts'),
    'utf8',
  );

  assert.match(readme, /shelf-first/);
  assert.match(readme, /\/`・`\/tags\/`・`\/search\/`・`\/sources\//);
  assert.match(readme, /`categories\.json` は compatibility export/);
  assert.match(
    readme,
    /articles \/ shelves \/ sources \/ tags \/ search-index \/ meta/,
  );
  assert.match(readme, /`\/<shelfId>\//);
  assert.match(readme, /http:\/\/localhost:4173\/it\//);
  assert.match(readme, /http:\/\/localhost:4173\/categories\//);

  assert.equal(buildShelfHrefFromHome('it'), './it/');
  assert.match(appSource, /MISSING_CATEGORY_SELECTION_MESSAGE/);
  assert.match(appSource, /MISSING_SHELF_SELECTION_MESSAGE/);
  assert.match(appSource, /buildShelfHrefFromHome/);
  assert.match(appSource, /\.\/\$\{encodeURIComponent\(shelfId\)\}\/`/);
});

test('checked-in home shell and app source stay aligned with prerender pagination hooks', () => {
  const homeHtml = fs.readFileSync(
    path.resolve(__dirname, '..', 'public/index.html'),
    'utf8',
  );
  const appSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'src/web/app.ts'),
    'utf8',
  );

  assert.match(homeHtml, /id="articles-pagination"/);
  assert.match(appSource, /BOOTSTRAP_SCRIPT_ID/);
  assert.match(appSource, /loadArticlePageShard/);
  assert.match(appSource, /renderPaginationNav/);
});
