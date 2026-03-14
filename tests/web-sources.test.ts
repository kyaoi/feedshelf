const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSourcePageViewModel,
  EMPTY_SOURCE_ARTICLES_MESSAGE,
  MISSING_SOURCE_SELECTION_MESSAGE,
  UNKNOWN_SOURCE_MESSAGE,
} = require('../public/assets/app.js');

test('buildSourcePageViewModel returns missing-source when sourceId is empty', () => {
  const viewModel = buildSourcePageViewModel({
    sourceId: '',
    articles: [],
    sources: [],
    shelves: [],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'missing-source');
  assert.equal(viewModel.statusMessage, MISSING_SOURCE_SELECTION_MESSAGE);
});

test('buildSourcePageViewModel returns unknown-source for invalid id', () => {
  const viewModel = buildSourcePageViewModel({
    sourceId: 'unknown',
    articles: [],
    sources: [],
    shelves: [],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'unknown-source');
  assert.equal(viewModel.statusMessage, UNKNOWN_SOURCE_MESSAGE);
});

test('buildSourcePageViewModel returns empty-source when no articles match sourceId', () => {
  const viewModel = buildSourcePageViewModel({
    sourceId: 'itmedia-news',
    articles: [],
    sources: [
      {
        id: 'itmedia-news',
        name: 'ITmedia NEWS',
        articleCount: 0,
        shelfIds: ['it'],
        tags: ['Japan'],
        language: 'ja',
      },
    ],
    shelves: [
      {
        id: 'it',
        title: 'IT',
        description: 'IT shelf',
        articleCount: 0,
        sourceCount: 1,
        latestSortAt: '',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'empty-source');
  assert.equal(viewModel.statusMessage, EMPTY_SOURCE_ARTICLES_MESSAGE);
  assert.equal(viewModel.articlesCountText, '0 件');
});

test('buildSourcePageViewModel filters articles by sourceId and derives related shelves', () => {
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
        shelfIds: ['it'],
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
        shelfIds: ['science'],
        imageUrl: null,
      },
    ],
    sources: [
      {
        id: 'itmedia-news',
        name: 'ITmedia NEWS',
        articleCount: 1,
        shelfIds: ['it'],
        tags: ['Japan'],
        language: 'ja',
      },
      {
        id: 'gigazine-science',
        name: 'GIGAZINE',
        articleCount: 1,
        shelfIds: ['science'],
        language: 'ja',
      },
    ],
    shelves: [
      {
        id: 'it',
        title: 'IT',
        description: 'IT shelf',
        articleCount: 1,
        sourceCount: 1,
        latestSortAt: '2026-03-09T00:00:00Z',
      },
      {
        id: 'science',
        title: 'Science',
        description: 'Science shelf',
        articleCount: 1,
        sourceCount: 1,
        latestSortAt: '2026-03-09T00:00:00Z',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'ready');
  assert.equal(viewModel.articles.length, 1);
  assert.equal(viewModel.articles[0].title, 'IT article');
  assert.equal(viewModel.navigationItems[0].isSelected, true);
  assert.equal(viewModel.relatedShelves[0].href, '../categories/?id=it');
  assert.equal(viewModel.relatedShelves[0].label, 'IT');
});
