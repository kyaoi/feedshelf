const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EMPTY_TAG_ARTICLES_MESSAGE,
  MISSING_TAG_SELECTION_MESSAGE,
  PAGE_QUERY_PARAM,
  TAG_QUERY_PARAM,
  UNKNOWN_TAG_MESSAGE,
  articleHasTag,
  buildPaginationHref,
  buildTagHrefFromHome,
  buildTagHrefFromTagPage,
  buildTagPageViewModel,
  getPageFromLocation,
  getTagIdFromLocation,
} = require('../public/assets/app.js');

test('buildTagHrefFromHome and buildTagHrefFromTagPage build stable query routes', () => {
  assert.equal(buildTagHrefFromHome('tag-cloud'), './tags/?id=tag-cloud');
  assert.equal(buildTagHrefFromTagPage('tag-cloud'), './?id=tag-cloud');
});

test('getTagIdFromLocation reads id query parameter', () => {
  assert.equal(getTagIdFromLocation({ search: '?id=tag-cloud' }), 'tag-cloud');
  assert.equal(getTagIdFromLocation({ search: '' }), '');
  assert.equal(getTagIdFromLocation(null), '');
  assert.equal(TAG_QUERY_PARAM, 'id');
});

test('tag pagination helpers preserve tag selection while switching pages', () => {
  assert.equal(getPageFromLocation({ search: '?id=tag-cloud&page=3' }), 3);
  assert.equal(PAGE_QUERY_PARAM, 'page');
  assert.equal(
    buildPaginationHref({ page: 1, selectedTagId: 'tag-cloud' }),
    './?id=tag-cloud',
  );
  assert.equal(
    buildPaginationHref({ page: 2, selectedTagId: 'tag-cloud' }),
    './?id=tag-cloud&page=2',
  );
});

test('articleHasTag matches sourceTags and entryTags with normalized compare key', () => {
  const article = {
    sourceTags: ['Cloud Native'],
    entryTags: ['Kubernetes'],
  };

  assert.equal(articleHasTag(article, 'cloud native'), true);
  assert.equal(articleHasTag(article, 'Kubernetes'), true);
  assert.equal(articleHasTag(article, 'AI'), false);
});

test('buildTagPageViewModel returns selection guidance when id is missing', () => {
  const viewModel = buildTagPageViewModel({
    tagId: '',
    articles: [],
    tags: [
      {
        id: 'tag-cloud',
        label: 'Cloud',
        articleCount: 0,
        sourceCount: 1,
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'missing-tag');
  assert.equal(viewModel.statusMessage, MISSING_TAG_SELECTION_MESSAGE);
  assert.equal(viewModel.navigationItems[0].href, './?id=tag-cloud');
});

test('buildTagPageViewModel returns warning state when tag is unknown', () => {
  const viewModel = buildTagPageViewModel({
    tagId: 'tag-unknown',
    articles: [],
    tags: [
      {
        id: 'tag-cloud',
        label: 'Cloud',
        articleCount: 0,
        sourceCount: 1,
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'unknown-tag');
  assert.equal(viewModel.statusMessage, UNKNOWN_TAG_MESSAGE);
});

test('buildTagPageViewModel returns empty-tag when selected tag has no articles', () => {
  const viewModel = buildTagPageViewModel({
    tagId: 'tag-cloud',
    articles: [],
    tags: [
      {
        id: 'tag-cloud',
        label: 'Cloud',
        articleCount: 0,
        sourceCount: 1,
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'empty-tag');
  assert.equal(viewModel.statusMessage, EMPTY_TAG_ARTICLES_MESSAGE);
});

test('buildTagPageViewModel filters articles by sourceTags and entryTags union', () => {
  const viewModel = buildTagPageViewModel({
    tagId: 'tag-cloud',
    articles: [
      {
        id: 'article-1',
        title: 'Cloud source tag article',
        url: 'https://example.com/cloud',
        summary: null,
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceId: 'source-1',
        sourceName: 'Source 1',
        categoryId: 'example',
        categoryLabel: 'Example',
        imageUrl: null,
        sourceTags: ['Cloud'],
        entryTags: [],
      },
      {
        id: 'article-2',
        title: 'Entry tag article',
        url: 'https://example.com/k8s',
        summary: null,
        publishedAt: '2026-03-08T00:00:00Z',
        sortAt: '2026-03-08T00:00:00Z',
        sourceId: 'source-2',
        sourceName: 'Source 2',
        categoryId: 'example',
        categoryLabel: 'Example',
        imageUrl: null,
        sourceTags: [],
        entryTags: ['Cloud'],
      },
      {
        id: 'article-3',
        title: 'Other article',
        url: 'https://example.com/other',
        summary: null,
        publishedAt: '2026-03-07T00:00:00Z',
        sortAt: '2026-03-07T00:00:00Z',
        sourceId: 'source-3',
        sourceName: 'Source 3',
        categoryId: 'example',
        categoryLabel: 'Example',
        imageUrl: null,
        sourceTags: ['AI'],
        entryTags: [],
      },
    ],
    tags: [
      {
        id: 'tag-cloud',
        label: 'Cloud',
        articleCount: 2,
        sourceCount: 2,
        latestSortAt: '2026-03-09T00:00:00Z',
      },
    ],
    meta: { generatedAt: '2026-03-09T00:00:00Z' },
  });

  assert.equal(viewModel.kind, 'ready');
  assert.equal(viewModel.articles.length, 2);
  assert.deepEqual(
    viewModel.articles.map((article: { title: string }) => article.title),
    ['Cloud source tag article', 'Entry tag article'],
  );
  assert.equal(viewModel.navigationItems[0].isSelected, true);
  assert.equal(viewModel.articles[0].visibleTags[0], 'Cloud');
});

test('checked-in tag shell keeps pagination placeholder for prerendered page shards', () => {
  const tagHtml = fs.readFileSync(
    path.resolve(__dirname, '..', 'public/tags/index.html'),
    'utf8',
  );
  assert.match(tagHtml, /id="articles-pagination"/);
});
