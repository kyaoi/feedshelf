const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CATEGORY_QUERY_PARAM,
  EMPTY_CATEGORY_ARTICLES_MESSAGE,
  MISSING_CATEGORY_SELECTION_MESSAGE,
  UNKNOWN_CATEGORY_MESSAGE,
  buildCategoryHrefFromCategoryPage,
  buildCategoryHrefFromHome,
  buildCategoryPageViewModel,
  getCategoryIdFromLocation,
} = require('../public/assets/app.js');

test('buildCategoryHrefFromHome and buildCategoryHrefFromCategoryPage build stable query routes', () => {
  assert.equal(
    buildCategoryHrefFromHome('physics'),
    './categories/?id=physics',
  );
  assert.equal(buildCategoryHrefFromCategoryPage('physics'), './?id=physics');
});

test('getCategoryIdFromLocation reads id query parameter', () => {
  assert.equal(getCategoryIdFromLocation({ search: '?id=physics' }), 'physics');
  assert.equal(getCategoryIdFromLocation({ search: '' }), '');
  assert.equal(getCategoryIdFromLocation(null), '');
  assert.equal(CATEGORY_QUERY_PARAM, 'id');
});

test('buildCategoryPageViewModel returns selection guidance when id is missing', () => {
  const viewModel = buildCategoryPageViewModel({
    categoryId: '',
    articles: [],
    categories: [{ id: 'physics', label: 'Physics', articleCount: 0 }],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'missing-category');
  assert.equal(viewModel.statusMessage, MISSING_CATEGORY_SELECTION_MESSAGE);
  assert.equal(viewModel.navigationItems[0].href, './?id=physics');
});

test('buildCategoryPageViewModel returns warning state when category is unknown', () => {
  const viewModel = buildCategoryPageViewModel({
    categoryId: 'unknown',
    articles: [],
    categories: [{ id: 'physics', label: 'Physics', articleCount: 0 }],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'unknown-category');
  assert.equal(viewModel.statusMessage, UNKNOWN_CATEGORY_MESSAGE);
  assert.equal(viewModel.articles.length, 0);
});

test('buildCategoryPageViewModel returns empty-category when selected category has no articles', () => {
  const viewModel = buildCategoryPageViewModel({
    categoryId: 'physics',
    articles: [],
    categories: [{ id: 'physics', label: 'Physics', articleCount: 0 }],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'empty-category');
  assert.equal(viewModel.statusMessage, EMPTY_CATEGORY_ARTICLES_MESSAGE);
  assert.equal(viewModel.articlesCountText, '0 件');
});

test('buildCategoryPageViewModel filters articles by categoryId and marks selected chip', () => {
  const viewModel = buildCategoryPageViewModel({
    categoryId: 'physics',
    articles: [
      {
        id: 'article-1',
        title: 'Physics article',
        url: 'https://example.com/physics',
        summary: null,
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceName: 'Example Source',
        categoryId: 'physics',
        categoryLabel: 'Physics',
        imageUrl: null,
      },
      {
        id: 'article-2',
        title: 'Math article',
        url: 'https://example.com/math',
        summary: null,
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceName: 'Example Source',
        categoryId: 'math',
        categoryLabel: 'Math',
        imageUrl: null,
      },
    ],
    categories: [
      { id: 'physics', label: 'Physics', articleCount: 1 },
      { id: 'math', label: 'Math', articleCount: 1 },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'ready');
  assert.equal(viewModel.articles.length, 1);
  assert.equal(viewModel.articles[0].title, 'Physics article');
  assert.equal(viewModel.navigationItems[0].isSelected, true);
  assert.equal(viewModel.navigationItems[1].isSelected, false);
});
