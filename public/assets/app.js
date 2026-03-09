(function (globalScope) {
  const DEFAULT_BASE_PATH = '.';
  const MISSING_SUMMARY_LABEL = '要約はありません。';
  const UNKNOWN_PUBLISHED_AT_LABEL = '公開日時不明';
  const GENERIC_LOAD_ERROR = '公開データの読み込みに失敗しました。GitHub Pages または静的サーバー経由で開いているか確認してください。';
  const FILE_PROTOCOL_ERROR = 'file:// 直開きでは JSON を読み込めない場合があります。静的サーバー経由で開いてください。';
  const MISSING_PUBLIC_DATA_ERROR = '公開データがまだ生成されていません。先に `pnpm run pipeline:run` を実行して `public/data/*.json` を作成してください。';
  const CATEGORY_QUERY_PARAM = 'id';
  const MISSING_CATEGORY_SELECTION_MESSAGE = 'カテゴリが選択されていません。トップページまたはカテゴリ一覧から選んでください。';
  const UNKNOWN_CATEGORY_MESSAGE = '指定されたカテゴリは見つかりませんでした。別のカテゴリを選んでください。';
  const EMPTY_CATEGORY_ARTICLES_MESSAGE = 'このカテゴリの記事はまだありません。次回の生成を待つか、別のカテゴリを選んでください。';

  function buildDataPaths(basePath = DEFAULT_BASE_PATH) {
    const trimmed = String(basePath).replace(/\/+$/u, '') || '.';
    const prefix = trimmed === '.' ? './data' : `${trimmed}/data`;

    return {
      articles: `${prefix}/articles.json`,
      categories: `${prefix}/categories.json`,
      sources: `${prefix}/sources.json`,
      meta: `${prefix}/meta.json`,
    };
  }

  async function fetchJson(fetchImpl, url) {
    if (typeof fetchImpl !== 'function') {
      throw new Error('Fetch API is not available in this environment.');
    }

    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = new Error(`Failed to fetch ${url}: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async function loadHomePageData({ basePath = DEFAULT_BASE_PATH, fetchImpl = globalScope.fetch } = {}) {
    const paths = buildDataPaths(basePath);

    try {
      const [articles, categories, sources, meta] = await Promise.all([
        fetchJson(fetchImpl, paths.articles),
        fetchJson(fetchImpl, paths.categories),
        fetchJson(fetchImpl, paths.sources),
        fetchJson(fetchImpl, paths.meta),
      ]);

      return {
        kind: 'ready',
        articles: Array.isArray(articles) ? articles : [],
        categories: Array.isArray(categories) ? categories : [],
        sources: Array.isArray(sources) ? sources : [],
        meta: meta && typeof meta === 'object' ? meta : {},
      };
    } catch (error) {
      if (error && error.status === 404) {
        return {
          kind: 'missing-data',
          message: MISSING_PUBLIC_DATA_ERROR,
        };
      }

      return {
        kind: 'error',
        message: describeLoadError(error),
      };
    }
  }

  function describeLoadError(error) {
    if (
      globalScope.location &&
      typeof globalScope.location.protocol === 'string' &&
      globalScope.location.protocol === 'file:'
    ) {
      return FILE_PROTOCOL_ERROR;
    }

    if (error && typeof error.message === 'string' && error.message.trim() !== '') {
      return GENERIC_LOAD_ERROR;
    }

    return GENERIC_LOAD_ERROR;
  }

  function formatDateTime(value) {
    if (!value) {
      return UNKNOWN_PUBLISHED_AT_LABEL;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return UNKNOWN_PUBLISHED_AT_LABEL;
    }

    return new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCount(value) {
    return Number.isFinite(Number(value)) ? String(Number(value)) : '0';
  }

  function buildHomePageViewModel({ articles, categories, sources, meta }) {
    return {
      generatedAtText: meta && meta.generatedAt ? `${formatDateTime(meta.generatedAt)} 更新` : '更新時刻不明',
      stats: [
        {
          label: '記事数',
          value: formatCount(meta && meta.articleCount),
        },
        {
          label: '媒体数',
          value: formatCount(meta && meta.sourceCount),
        },
        {
          label: 'カテゴリ数',
          value: formatCount(meta && meta.categoryCount),
        },
      ],
      categories: buildCategoryNavigationItems(categories, { hrefBuilder: buildCategoryHrefFromHome }),
      sources: sources.map((source) => ({
        name: source.name,
        countLabel: `${formatCount(source.articleCount)}件`,
        metaLabel: [source.categoryLabel, source.language].filter(Boolean).join(' / '),
      })),
      articles: buildArticleViewModels(articles),
    };
  }

  function buildArticleViewModels(articles) {
    return articles.map((article) => ({
      title: article.title,
      url: article.url,
      sourceName: article.sourceName,
      categoryLabel: article.categoryLabel,
      publishedAtLabel: formatDateTime(article.publishedAt || article.sortAt),
      summary: article.summary || MISSING_SUMMARY_LABEL,
      hasSummary: Boolean(article.summary),
      imageUrl: article.imageUrl || null,
    }));
  }

  function buildCategoryNavigationItems(categories, { selectedCategoryId = null, hrefBuilder = buildCategoryHrefFromHome } = {}) {
    return categories.map((category) => ({
      id: category.id,
      label: category.label,
      countLabel: `${formatCount(category.articleCount)}件`,
      href: typeof hrefBuilder === 'function' ? hrefBuilder(category.id) : null,
      isSelected: selectedCategoryId === category.id,
    }));
  }

  function buildCategoryPageViewModel({ categoryId, articles, categories, meta }) {
    const navigationItems = buildCategoryNavigationItems(categories, {
      selectedCategoryId: categoryId,
      hrefBuilder: buildCategoryHrefFromCategoryPage,
    });
    const selectedCategory = categories.find((category) => category.id === categoryId) || null;

    if (!categoryId) {
      return {
        kind: 'missing-category',
        generatedAtText: meta && meta.generatedAt ? `${formatDateTime(meta.generatedAt)} 更新` : '更新時刻不明',
        navigationItems,
        title: 'カテゴリを選択してください',
        description: MISSING_CATEGORY_SELECTION_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: MISSING_CATEGORY_SELECTION_MESSAGE,
      };
    }

    if (!selectedCategory) {
      return {
        kind: 'unknown-category',
        generatedAtText: meta && meta.generatedAt ? `${formatDateTime(meta.generatedAt)} 更新` : '更新時刻不明',
        navigationItems,
        title: 'カテゴリが見つかりません',
        description: UNKNOWN_CATEGORY_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: UNKNOWN_CATEGORY_MESSAGE,
      };
    }

    const selectedArticles = articles.filter((article) => article.categoryId === selectedCategory.id);

    return {
      kind: selectedArticles.length === 0 ? 'empty-category' : 'ready',
      generatedAtText: meta && meta.generatedAt ? `${formatDateTime(meta.generatedAt)} 更新` : '更新時刻不明',
      navigationItems,
      title: `${selectedCategory.label} の記事一覧`,
      description: `${selectedCategory.label} に分類された記事だけを新着順で表示しています。`,
      articlesCountText: `${selectedArticles.length} 件`,
      articles: buildArticleViewModels(selectedArticles),
      statusMessage: selectedArticles.length === 0 ? EMPTY_CATEGORY_ARTICLES_MESSAGE : '',
      selectedCategoryLabel: selectedCategory.label,
    };
  }

  function renderStats(stats) {
    return stats
      .map(
        (stat) => `
          <div class="stat-card">
            <dt>${escapeHtml(stat.label)}</dt>
            <dd>${escapeHtml(stat.value)}</dd>
          </div>
        `,
      )
      .join('');
  }

  function renderChipItems(categories) {
    if (categories.length === 0) {
      return '<p class="placeholder-text">カテゴリはまだありません。</p>';
    }

    return categories
      .map((category) => renderCategoryChip(category))
      .join('');
  }

  function renderCategoryChip(category) {
    const selectedClassName = category.isSelected ? ' chip--selected' : '';
    const content = `
      <span>${escapeHtml(category.label)}</span>
      <span class="chip__count">${escapeHtml(category.countLabel)}</span>
    `;

    if (category.href) {
      return `
        <a class="chip${selectedClassName}" href="${escapeHtml(category.href)}" ${category.isSelected ? 'aria-current="page"' : ''}>
          ${content}
        </a>
      `;
    }

    return `
      <span class="chip${selectedClassName}">
        ${content}
      </span>
    `;
  }

  function renderSourceItems(sources) {
    if (sources.length === 0) {
      return '<p class="placeholder-text">媒体はまだありません。</p>';
    }

    return sources
      .map(
        (source) => `
          <span class="source-pill">
            <span>${escapeHtml(source.name)}</span>
            <span class="source-pill__count">${escapeHtml(source.countLabel)}</span>
            ${source.metaLabel ? `<span class="source-pill__meta">${escapeHtml(source.metaLabel)}</span>` : ''}
          </span>
        `,
      )
      .join('');
  }

  function renderArticleItems(articles) {
    return articles
      .map(
        (article) => `
          <li class="article-card ${article.imageUrl ? 'article-card--with-image' : ''}">
            <article class="article-card__content">
              <div class="article-card__meta">
                <span class="meta-pill">${escapeHtml(article.sourceName)}</span>
                <span class="meta-pill">${escapeHtml(article.categoryLabel)}</span>
                <span class="meta-pill">${escapeHtml(article.publishedAtLabel)}</span>
              </div>
              <h3 class="article-card__title">
                <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHtml(article.title)}
                </a>
              </h3>
              <p class="article-card__summary ${article.hasSummary ? '' : 'article-card__summary--missing'}">
                ${escapeHtml(article.summary)}
              </p>
              <div class="article-card__footer">
                <span class="muted">元記事で続きを読む</span>
                <a class="article-card__link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">
                  開く
                </a>
              </div>
            </article>
            ${
              article.imageUrl
                ? `<img class="article-card__image" src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy" />`
                : ''
            }
          </li>
        `,
      )
      .join('');
  }

  function buildCategoryHrefFromHome(categoryId) {
    return `./categories/?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
  }

  function buildCategoryHrefFromCategoryPage(categoryId) {
    return `./?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
  }

  function getCategoryIdFromLocation(locationRef = globalScope.location) {
    if (!locationRef || typeof locationRef.search !== 'string') {
      return '';
    }

    const params = new URLSearchParams(locationRef.search);
    return params.get(CATEGORY_QUERY_PARAM) || '';
  }

  function setStatus(documentRef, { kind, message }) {
    const statusElement = documentRef.getElementById('articles-status');
    const listElement = documentRef.getElementById('articles-list');

    if (!statusElement || !listElement) {
      return;
    }

    statusElement.hidden = false;
    statusElement.className = `status ${kind ? `status--${kind}` : ''}`.trim();
    statusElement.textContent = message;
    listElement.hidden = true;
    listElement.innerHTML = '';
  }

  function renderHomePage(documentRef, payload) {
    const viewModel = buildHomePageViewModel(payload);
    const generatedAtElement = documentRef.getElementById('generated-at');
    const metaStatsElement = documentRef.getElementById('meta-stats');
    const categoriesElement = documentRef.getElementById('categories-list');
    const sourcesElement = documentRef.getElementById('sources-list');
    const articlesCountElement = documentRef.getElementById('articles-count');
    const statusElement = documentRef.getElementById('articles-status');
    const listElement = documentRef.getElementById('articles-list');

    if (generatedAtElement) {
      generatedAtElement.textContent = viewModel.generatedAtText;
    }

    if (metaStatsElement) {
      metaStatsElement.innerHTML = renderStats(viewModel.stats);
    }

    if (categoriesElement) {
      categoriesElement.innerHTML = renderChipItems(viewModel.categories);
    }

    if (sourcesElement) {
      sourcesElement.innerHTML = renderSourceItems(viewModel.sources);
    }

    if (articlesCountElement) {
      articlesCountElement.textContent = `${viewModel.articles.length} 件`;
    }

    if (!statusElement || !listElement) {
      return;
    }

    if (viewModel.articles.length === 0) {
      setStatus(documentRef, {
        kind: 'warning',
        message: '記事はまだありません。`public/data/articles.json` が空か、取得対象 feed が未設定の可能性があります。',
      });
      return;
    }

    statusElement.hidden = true;
    listElement.hidden = false;
    listElement.innerHTML = renderArticleItems(viewModel.articles);
  }

  function renderCategoryPage(documentRef, payload, { categoryId } = {}) {
    const viewModel = buildCategoryPageViewModel({
      categoryId,
      articles: payload.articles,
      categories: payload.categories,
      meta: payload.meta,
    });
    const generatedAtElement = documentRef.getElementById('generated-at');
    const navElement = documentRef.getElementById('category-nav');
    const titleElement = documentRef.getElementById('category-page-title');
    const descriptionElement = documentRef.getElementById('category-page-description');
    const articlesCountElement = documentRef.getElementById('articles-count');
    const statusElement = documentRef.getElementById('articles-status');
    const listElement = documentRef.getElementById('articles-list');

    if (generatedAtElement) {
      generatedAtElement.textContent = viewModel.generatedAtText;
    }

    if (navElement) {
      navElement.innerHTML = renderChipItems(viewModel.navigationItems);
    }

    if (titleElement) {
      titleElement.textContent = viewModel.title;
    }

    if (descriptionElement) {
      descriptionElement.textContent = viewModel.description;
    }

    if (articlesCountElement) {
      articlesCountElement.textContent = viewModel.articlesCountText;
    }

    if (!statusElement || !listElement) {
      return viewModel;
    }

    if (viewModel.kind !== 'ready') {
      setStatus(documentRef, {
        kind: 'warning',
        message: viewModel.statusMessage,
      });
      return viewModel;
    }

    statusElement.hidden = true;
    listElement.hidden = false;
    listElement.innerHTML = renderArticleItems(viewModel.articles);
    return viewModel;
  }

  async function initHomePage({ basePath = DEFAULT_BASE_PATH, fetchImpl = globalScope.fetch, documentRef = globalScope.document } = {}) {
    if (!documentRef) {
      return { kind: 'skipped' };
    }

    setStatus(documentRef, {
      kind: 'loading',
      message: '公開 JSON を読み込んでいます…',
    });

    const payload = await loadHomePageData({ basePath, fetchImpl });

    if (payload.kind === 'ready') {
      renderHomePage(documentRef, payload);
      return payload;
    }

    setStatus(documentRef, {
      kind: payload.kind === 'missing-data' ? 'warning' : 'error',
      message: payload.message,
    });
    return payload;
  }

  async function initCategoryPage({
    basePath = '..',
    fetchImpl = globalScope.fetch,
    documentRef = globalScope.document,
    locationRef = globalScope.location,
  } = {}) {
    if (!documentRef) {
      return { kind: 'skipped' };
    }

    setStatus(documentRef, {
      kind: 'loading',
      message: '公開 JSON を読み込んでいます…',
    });

    const payload = await loadHomePageData({ basePath, fetchImpl });

    if (payload.kind === 'ready') {
      return renderCategoryPage(documentRef, payload, {
        categoryId: getCategoryIdFromLocation(locationRef),
      });
    }

    setStatus(documentRef, {
      kind: payload.kind === 'missing-data' ? 'warning' : 'error',
      message: payload.message,
    });
    return payload;
  }

  const exported = {
    CATEGORY_QUERY_PARAM,
    DEFAULT_BASE_PATH,
    EMPTY_CATEGORY_ARTICLES_MESSAGE,
    MISSING_CATEGORY_SELECTION_MESSAGE,
    MISSING_PUBLIC_DATA_ERROR,
    MISSING_SUMMARY_LABEL,
    UNKNOWN_CATEGORY_MESSAGE,
    UNKNOWN_PUBLISHED_AT_LABEL,
    buildArticleViewModels,
    buildCategoryHrefFromCategoryPage,
    buildCategoryHrefFromHome,
    buildCategoryNavigationItems,
    buildCategoryPageViewModel,
    buildDataPaths,
    buildHomePageViewModel,
    describeLoadError,
    escapeHtml,
    formatCount,
    formatDateTime,
    getCategoryIdFromLocation,
    initCategoryPage,
    initHomePage,
    loadHomePageData,
    renderArticleItems,
    renderCategoryPage,
    renderChipItems,
    renderHomePage,
    renderSourceItems,
    renderStats,
    setStatus,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  globalScope.FeedShelfApp = exported;

  if (globalScope.document) {
    globalScope.addEventListener('DOMContentLoaded', () => {
      const pathname = globalScope.location && typeof globalScope.location.pathname === 'string'
        ? globalScope.location.pathname
        : '';
      const isCategoryPage = /\/categories\/(?:index\.html)?$/u.test(pathname);
      const initializer = isCategoryPage ? initCategoryPage : initHomePage;

      initializer().catch((error) => {
        console.error('[feedshelf] failed to initialize page', error);
      });
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
