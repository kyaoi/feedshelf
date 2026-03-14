const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildDataPaths,
  loadHomePageData,
  buildHomePageViewModel,
  buildSourceNavigationItems,
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

test('README and shelf-first copy stay aligned with compatibility route guidance', () => {
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
  assert.match(readme, /http:\/\/localhost:4173\/categories\//);

  assert.match(appSource, /MISSING_CATEGORY_SELECTION_MESSAGE/);
  assert.match(appSource, /棚カタログ・タグ・検索/);
  assert.match(appSource, /UNKNOWN_CATEGORY_MESSAGE/);
  assert.match(appSource, /buildCategoryHrefFromHome/);
  assert.match(appSource, /\.\/categories\/\?/);
});
