const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SOURCE_QUERY_PARAM,
  EMPTY_SOURCE_ARTICLES_MESSAGE,
  MISSING_SOURCE_SELECTION_MESSAGE,
  UNKNOWN_SOURCE_MESSAGE,
  buildSourceHrefFromHome,
  buildSourceHrefFromSourcePage,
  buildSourcePageViewModel,
  getSourceIdFromLocation,
} = require('../public/assets/app.js');

test('buildSourceHrefFromHome and buildSourceHrefFromSourcePage build stable query routes', () => {
  assert.equal(
    buildSourceHrefFromHome('itmedia-news'),
    './sources/?id=itmedia-news',
  );
  assert.equal(
    buildSourceHrefFromSourcePage('itmedia-news'),
    './?id=itmedia-news',
  );
});

test('getSourceIdFromLocation reads id query parameter', () => {
  assert.equal(
    getSourceIdFromLocation({ search: '?id=itmedia-news' }),
    'itmedia-news',
  );
  assert.equal(getSourceIdFromLocation({ search: '' }), '');
  assert.equal(getSourceIdFromLocation(null), '');
  assert.equal(SOURCE_QUERY_PARAM, 'id');
});

test('buildSourcePageViewModel returns selection guidance when id is missing', () => {
  const viewModel = buildSourcePageViewModel({
    sourceId: '',
    articles: [],
    sources: [
      {
        id: 'itmedia-news',
        name: 'ITmedia NEWS',
        articleCount: 0,
        categoryLabel: '日本IT',
        language: 'ja',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'missing-source');
  assert.equal(viewModel.statusMessage, MISSING_SOURCE_SELECTION_MESSAGE);
  assert.equal(viewModel.navigationItems[0].href, './?id=itmedia-news');
});

test('buildSourcePageViewModel returns warning state when source is unknown', () => {
  const viewModel = buildSourcePageViewModel({
    sourceId: 'unknown-source',
    articles: [],
    sources: [
      {
        id: 'itmedia-news',
        name: 'ITmedia NEWS',
        articleCount: 0,
        categoryLabel: '日本IT',
        language: 'ja',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'unknown-source');
  assert.equal(viewModel.statusMessage, UNKNOWN_SOURCE_MESSAGE);
  assert.equal(viewModel.articles.length, 0);
});

test('buildSourcePageViewModel returns empty-source when selected source has no articles', () => {
  const viewModel = buildSourcePageViewModel({
    sourceId: 'itmedia-news',
    articles: [],
    sources: [
      {
        id: 'itmedia-news',
        name: 'ITmedia NEWS',
        articleCount: 0,
        categoryLabel: '日本IT',
        language: 'ja',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'empty-source');
  assert.equal(viewModel.statusMessage, EMPTY_SOURCE_ARTICLES_MESSAGE);
  assert.equal(viewModel.articlesCountText, '0 件');
});

test('buildSourcePageViewModel filters articles by sourceId and marks selected pill', () => {
  const viewModel = buildSourcePageViewModel({
    sourceId: 'itmedia-news',
    articles: [
      {
        id: 'article-1',
        title: 'IT article',
        url: 'https://example.com/it',
        summary: null,
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceId: 'itmedia-news',
        sourceName: 'ITmedia NEWS',
        categoryId: 'japan-it',
        categoryLabel: '日本IT',
        imageUrl: null,
      },
      {
        id: 'article-2',
        title: 'Science article',
        url: 'https://example.com/science',
        summary: null,
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceId: 'gigazine-science',
        sourceName: 'GIGAZINE',
        categoryId: 'science',
        categoryLabel: 'Science',
        imageUrl: null,
      },
    ],
    sources: [
      {
        id: 'itmedia-news',
        name: 'ITmedia NEWS',
        articleCount: 1,
        categoryLabel: '日本IT',
        language: 'ja',
      },
      {
        id: 'gigazine-science',
        name: 'GIGAZINE',
        articleCount: 1,
        categoryLabel: 'Science',
        language: 'ja',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'ready');
  assert.equal(viewModel.articles.length, 1);
  assert.equal(viewModel.articles[0].title, 'IT article');
  assert.equal(viewModel.navigationItems[0].isSelected, true);
  assert.equal(viewModel.navigationItems[1].isSelected, false);
  assert.match(viewModel.description, /ITmedia NEWS/);
});
