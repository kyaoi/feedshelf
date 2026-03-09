const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INVALID_ARTICLE_LINK_LABEL,
  MISSING_PUBLIC_DATA_ERROR,
  MISSING_SUMMARY_LABEL,
  buildDataPaths,
  buildHomePageViewModel,
  loadHomePageData,
  normalizeExternalArticleUrl,
  renderArticleItems,
} = require('../public/assets/app.js');

test('buildDataPaths builds public JSON paths under ./data by default', () => {
  assert.deepEqual(buildDataPaths(), {
    articles: './data/articles.json',
    categories: './data/categories.json',
    sources: './data/sources.json',
    meta: './data/meta.json',
  });
});

test('loadHomePageData loads articles/categories/sources/meta together', async () => {
  const calls = [];
  const fixtures = {
    './data/articles.json': [{
      id: 'article-1',
      title: 'Example article',
      url: 'https://example.com/articles/1',
      summary: 'Summary',
      publishedAt: '2026-03-09T00:00:00Z',
      sortAt: '2026-03-09T00:00:00Z',
      sourceName: 'Example Source',
      categoryLabel: 'Example Category',
      imageUrl: null,
    }],
    './data/categories.json': [{ id: 'example', label: 'Example Category', articleCount: 1 }],
    './data/sources.json': [{ id: 'example-source', name: 'Example Source', categoryLabel: 'Example Category', language: 'en', articleCount: 1 }],
    './data/meta.json': { generatedAt: '2026-03-09T00:00:00Z', articleCount: 1, sourceCount: 1, categoryCount: 1 },
  };

  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => fixtures[url],
    };
  };

  const result = await loadHomePageData({ fetchImpl });
  assert.equal(result.kind, 'ready');
  assert.deepEqual(calls, [
    './data/articles.json',
    './data/categories.json',
    './data/sources.json',
    './data/meta.json',
  ]);
  assert.equal(result.articles.length, 1);
  assert.equal(result.categories.length, 1);
  assert.equal(result.sources.length, 1);
  assert.equal(result.meta.articleCount, 1);
});

test('loadHomePageData returns missing-data when public JSON is not generated yet', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    json: async () => {
      throw new Error('not found');
    },
  });

  const result = await loadHomePageData({ fetchImpl });
  assert.deepEqual(result, {
    kind: 'missing-data',
    message: MISSING_PUBLIC_DATA_ERROR,
  });
});

test('buildHomePageViewModel fills nullable article fields with display-safe values', () => {
  const viewModel = buildHomePageViewModel({
    articles: [
      {
        id: 'article-1',
        title: 'No summary article',
        url: 'https://example.com/articles/1',
        summary: null,
        publishedAt: null,
        sortAt: null,
        sourceName: 'Example Source',
        categoryLabel: 'Example Category',
        imageUrl: null,
      },
    ],
    categories: [{ id: 'example-category', label: 'Example Category', articleCount: 4 }],
    sources: [{ id: 'example-source', name: 'Example Source', categoryLabel: 'Example Category', language: 'en', articleCount: 4 }],
    meta: { generatedAt: '2026-03-09T00:00:00Z', articleCount: 4, sourceCount: 1, categoryCount: 1 },
  });

  assert.equal(viewModel.articles[0].summary, MISSING_SUMMARY_LABEL);
  assert.equal(viewModel.articles[0].publishedAtLabel, '公開日時不明');
  assert.equal(viewModel.categories[0].countLabel, '4件');
  assert.equal(viewModel.sources[0].metaLabel, 'Example Category / en');
  assert.match(viewModel.generatedAtText, /更新$/);
});

test('renderArticleItems escapes HTML in titles and summaries', () => {
  const markup = renderArticleItems([
    {
      title: '<script>alert(1)</script>',
      url: 'https://example.com/articles/1',
      sourceName: 'Example Source',
      categoryLabel: 'Example Category',
      publishedAtLabel: '2026/03/09 09:00',
      summary: '<b>unsafe</b>',
      hasSummary: true,
      imageUrl: null,
    },
  ]);

  assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(markup, /&lt;b&gt;unsafe&lt;\/b&gt;/);
  assert.doesNotMatch(markup, /<script>alert/);
});


test('normalizeExternalArticleUrl accepts only http and https URLs', () => {
  assert.equal(normalizeExternalArticleUrl('https://example.com/articles/1'), 'https://example.com/articles/1');
  assert.equal(normalizeExternalArticleUrl('http://example.com/articles/1'), 'http://example.com/articles/1');
  assert.equal(normalizeExternalArticleUrl('javascript:alert(1)'), null);
  assert.equal(normalizeExternalArticleUrl('mailto:test@example.com'), null);
  assert.equal(normalizeExternalArticleUrl(''), null);
});

test('buildHomePageViewModel marks invalid external links as unavailable', () => {
  const viewModel = buildHomePageViewModel({
    articles: [
      {
        id: 'article-1',
        title: 'Broken link article',
        url: 'javascript:alert(1)',
        summary: null,
        publishedAt: '2026-03-09T00:00:00Z',
        sortAt: '2026-03-09T00:00:00Z',
        sourceName: 'Example Source',
        categoryLabel: 'Example Category',
        imageUrl: null,
      },
    ],
    categories: [],
    sources: [],
    meta: { generatedAt: '2026-03-09T00:00:00Z', articleCount: 1, sourceCount: 0, categoryCount: 0 },
  });

  assert.equal(viewModel.articles[0].url, null);
  assert.equal(viewModel.articles[0].canOpenExternal, false);
  assert.equal(viewModel.articles[0].externalLinkDescription, INVALID_ARTICLE_LINK_LABEL);
});

test('renderArticleItems disables external link button when article URL is unsafe', () => {
  const markup = renderArticleItems([
    {
      title: 'Unsafe link article',
      url: null,
      sourceName: 'Example Source',
      categoryLabel: 'Example Category',
      publishedAtLabel: '2026/03/09 09:00',
      summary: 'Summary',
      hasSummary: true,
      imageUrl: null,
      canOpenExternal: false,
      externalLinkDescription: INVALID_ARTICLE_LINK_LABEL,
    },
  ]);

  assert.match(markup, /元記事リンクを確認できません。/);
  assert.match(markup, /article-card__link article-card__link--disabled/);
  assert.match(markup, /aria-disabled="true"/);
  assert.doesNotMatch(markup, /target="_blank"/);
  assert.doesNotMatch(markup, /href="javascript:/);
});
