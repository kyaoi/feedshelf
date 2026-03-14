const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMPTY_SEARCH_RESULTS_MESSAGE,
  MISSING_SEARCH_QUERY_MESSAGE,
  SEARCH_QUERY_PARAM,
  buildSearchHrefFromHome,
  buildSearchPageViewModel,
  getSearchQueryFromLocation,
  normalizeSearchCompareText,
  scoreSearchEntry,
  tokenizeSearchQuery,
} = require('../public/assets/app.js');

test('buildSearchHrefFromHome and getSearchQueryFromLocation use q query parameter', () => {
  assert.equal(
    buildSearchHrefFromHome('kubernetes cloud'),
    './search/?q=kubernetes%20cloud',
  );
  assert.equal(
    getSearchQueryFromLocation({ search: '?q=Cloud%20Native' }),
    'Cloud Native',
  );
  assert.equal(getSearchQueryFromLocation({ search: '' }), '');
  assert.equal(getSearchQueryFromLocation(null), '');
  assert.equal(SEARCH_QUERY_PARAM, 'q');
});

test('normalizeSearchCompareText and tokenizeSearchQuery normalize whitespace and case', () => {
  assert.equal(
    normalizeSearchCompareText('  Cloud　Native  KuBerNetes '),
    'cloud native kubernetes',
  );
  assert.deepEqual(tokenizeSearchQuery('  Cloud　Native  KuBerNetes '), [
    'cloud',
    'native',
    'kubernetes',
  ]);
});

test('scoreSearchEntry prefers title over sourceName and tags', () => {
  const titleMatch = {
    articleId: 'article-title',
    sortAt: '2026-03-09T00:00:00Z',
    title: 'Kubernetes rollout guide',
    sourceName: 'Example Source',
    sourceTags: ['Cloud'],
    entryTags: ['Operations'],
    titleText: 'kubernetes rollout guide',
    sourceText: 'example source',
    tagText: 'cloud operations',
    searchText: 'kubernetes rollout guide example source cloud operations',
  };
  const tagMatch = {
    articleId: 'article-tag',
    sortAt: '2026-03-09T00:00:00Z',
    title: 'Weekly digest',
    sourceName: 'Example Source',
    sourceTags: ['Kubernetes'],
    entryTags: [],
    titleText: 'weekly digest',
    sourceText: 'example source',
    tagText: 'kubernetes',
    searchText: 'weekly digest example source kubernetes',
  };

  assert.ok(
    scoreSearchEntry(titleMatch, 'kubernetes') >
      scoreSearchEntry(tagMatch, 'kubernetes'),
  );
  assert.equal(scoreSearchEntry(tagMatch, 'nonexistent'), 0);
});

test('buildSearchPageViewModel returns helper state when query is empty', () => {
  const viewModel = buildSearchPageViewModel({
    query: '   ',
    articles: [],
    searchIndex: [],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'missing-query');
  assert.equal(
    viewModel.statusMessage.includes(MISSING_SEARCH_QUERY_MESSAGE),
    true,
  );
  assert.equal(viewModel.articles.length, 0);
});

test('buildSearchPageViewModel returns score-sorted results resolved via articles.json', () => {
  const viewModel = buildSearchPageViewModel({
    query: 'kubernetes cloud',
    articles: [
      {
        id: 'article-title',
        title: 'Kubernetes cloud rollout guide',
        url: 'https://example.com/title',
        summary: 'Title match article.',
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceId: 'source-a',
        sourceName: 'Example Source',
        categoryId: 'examples',
        categoryLabel: 'Examples',
        imageUrl: null,
        sourceTags: ['Cloud'],
        entryTags: ['Kubernetes'],
      },
      {
        id: 'article-tag',
        title: 'Weekly digest',
        url: 'https://example.com/tag',
        summary: 'Tag match article.',
        publishedAt: '2026-03-08T00:00:00Z',
        sortAt: '2026-03-08T00:00:00Z',
        sourceId: 'source-b',
        sourceName: 'Another Source',
        categoryId: 'examples',
        categoryLabel: 'Examples',
        imageUrl: null,
        sourceTags: ['Cloud'],
        entryTags: ['Kubernetes'],
      },
    ],
    searchIndex: [
      {
        articleId: 'article-tag',
        sortAt: '2026-03-08T00:00:00Z',
        title: 'Weekly digest',
        sourceName: 'Another Source',
        sourceTags: ['Cloud'],
        entryTags: ['Kubernetes'],
        titleText: 'weekly digest',
        sourceText: 'another source',
        tagText: 'cloud kubernetes',
        searchText: 'weekly digest another source cloud kubernetes',
      },
      {
        articleId: 'article-title',
        sortAt: '2026-03-09T00:00:00Z',
        title: 'Kubernetes cloud rollout guide',
        sourceName: 'Example Source',
        sourceTags: ['Cloud'],
        entryTags: ['Kubernetes'],
        titleText: 'kubernetes cloud rollout guide',
        sourceText: 'example source',
        tagText: 'cloud kubernetes',
        searchText:
          'kubernetes cloud rollout guide example source cloud kubernetes',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'ready');
  assert.deepEqual(
    viewModel.articles.map((article: { title: string }) => article.title),
    ['Kubernetes cloud rollout guide', 'Weekly digest'],
  );
  assert.equal(viewModel.articlesCountText, '2 件');
});

test('buildSearchPageViewModel returns no-results when query matches nothing', () => {
  const viewModel = buildSearchPageViewModel({
    query: 'quantum',
    articles: [
      {
        id: 'article-a',
        title: 'Cloud digest',
        url: 'https://example.com/a',
        summary: null,
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceId: 'source-a',
        sourceName: 'Example Source',
        categoryId: 'examples',
        categoryLabel: 'Examples',
        imageUrl: null,
        sourceTags: ['Cloud'],
        entryTags: [],
      },
    ],
    searchIndex: [
      {
        articleId: 'article-a',
        sortAt: '2026-03-09T00:00:00Z',
        title: 'Cloud digest',
        sourceName: 'Example Source',
        sourceTags: ['Cloud'],
        entryTags: [],
        titleText: 'cloud digest',
        sourceText: 'example source',
        tagText: 'cloud',
        searchText: 'cloud digest example source cloud',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'no-results');
  assert.equal(
    viewModel.statusMessage.includes(EMPTY_SEARCH_RESULTS_MESSAGE),
    true,
  );
  assert.equal(viewModel.articles.length, 0);
});
