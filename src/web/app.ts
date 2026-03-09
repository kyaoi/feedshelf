interface PublicArticleSummaryLike {
  id: string;
  title: string;
  url: string | null;
  summary: string | null;
  publishedAt: string | null;
  sortAt: string;
  sourceId: string;
  sourceName: string;
  categoryId: string;
  categoryLabel: string;
  imageUrl: string | null;
}

interface PublicCategorySummaryLike {
  id: string;
  label: string;
  articleCount: number;
  latestSortAt?: string;
}

interface PublicSourceSummaryLike {
  id: string;
  name: string;
  articleCount: number;
  categoryLabel: string;
  language: string;
  siteUrl?: string;
  categoryId?: string;
  latestSortAt?: string;
}

interface PublicMetaLike {
  generatedAt?: string;
  articleCount?: number;
  sourceCount?: number;
  categoryCount?: number;
}

interface ReadyPayload {
  kind: 'ready';
  articles: PublicArticleSummaryLike[];
  categories: PublicCategorySummaryLike[];
  sources: PublicSourceSummaryLike[];
  meta: PublicMetaLike;
}

interface MissingDataPayload {
  kind: 'missing-data';
  message: string;
}

interface ErrorPayload {
  kind: 'error';
  message: string;
}

type HomePageDataResult = ReadyPayload | MissingDataPayload | ErrorPayload;

interface StatViewModel {
  label: string;
  value: string;
}

interface ArticleViewModel {
  title: string;
  url: string | null;
  sourceName: string;
  categoryLabel: string;
  publishedAtLabel: string;
  summary: string;
  hasSummary: boolean;
  imageUrl: string | null;
  canOpenExternal: boolean;
  externalLinkDescription: string;
}

interface CategoryNavigationItem {
  id: string;
  label: string;
  countLabel: string;
  href: string | null;
  isSelected: boolean;
}

interface SourceNavigationItem {
  id: string;
  name: string;
  countLabel: string;
  metaLabel: string;
  href: string | null;
  isSelected: boolean;
}

interface HomePageViewModel {
  generatedAtText: string;
  stats: StatViewModel[];
  categories: CategoryNavigationItem[];
  sources: SourceNavigationItem[];
  articles: ArticleViewModel[];
}

interface CategoryPageViewModel {
  kind: 'missing-category' | 'unknown-category' | 'empty-category' | 'ready';
  generatedAtText: string;
  navigationItems: CategoryNavigationItem[];
  title: string;
  description: string;
  articlesCountText: string;
  articles: ArticleViewModel[];
  statusMessage: string;
  selectedCategoryLabel?: string;
}

interface SourcePageViewModel {
  kind: 'missing-source' | 'unknown-source' | 'empty-source' | 'ready';
  generatedAtText: string;
  navigationItems: SourceNavigationItem[];
  title: string;
  description: string;
  articlesCountText: string;
  articles: ArticleViewModel[];
  statusMessage: string;
  selectedSourceName?: string;
}

interface StatusOptions {
  kind: string;
  message: string;
}

interface LocationLike {
  search?: string;
  pathname?: string;
  protocol?: string;
}

interface HomePageInitOptions {
  basePath?: string;
  fetchImpl?: typeof fetch;
  documentRef?: Document | null;
}

interface CategoryPageInitOptions extends HomePageInitOptions {
  locationRef?: LocationLike | null;
}

interface SourcePageInitOptions extends HomePageInitOptions {
  locationRef?: LocationLike | null;
}

type FeedShelfGlobalScope = typeof globalThis & {
  document?: Document;
  location?: LocationLike;
  fetch?: typeof fetch;
  addEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void;
  FeedShelfApp?: unknown;
};

((globalScope: typeof globalThis) => {
  const browserScope = globalScope as FeedShelfGlobalScope;
  const commonJsModule = (() => {
    try {
      return eval('typeof module !== "undefined" ? module : undefined') as
        | { exports?: unknown }
        | undefined;
    } catch {
      return undefined;
    }
  })();
  const DEFAULT_BASE_PATH = '.';
  const MISSING_SUMMARY_LABEL = '要約はありません。';
  const UNKNOWN_PUBLISHED_AT_LABEL = '公開日時不明';
  const GENERIC_LOAD_ERROR =
    '公開データの読み込みに失敗しました。GitHub Pages または静的サーバー経由で開いているか確認してください。';
  const FILE_PROTOCOL_ERROR =
    'file:// 直開きでは JSON を読み込めない場合があります。静的サーバー経由で開いてください。';
  const MISSING_PUBLIC_DATA_ERROR =
    '公開データがまだ生成されていません。先に `pnpm run pipeline:run` を実行して `public/data/*.json` を作成してください。';
  const CATEGORY_QUERY_PARAM = 'id';
  const MISSING_CATEGORY_SELECTION_MESSAGE =
    'カテゴリが選択されていません。トップページまたはカテゴリ一覧から選んでください。';
  const UNKNOWN_CATEGORY_MESSAGE =
    '指定されたカテゴリは見つかりませんでした。別のカテゴリを選んでください。';
  const EMPTY_CATEGORY_ARTICLES_MESSAGE =
    'このカテゴリの記事はまだありません。次回の生成を待つか、別のカテゴリを選んでください。';
  const SOURCE_QUERY_PARAM = 'id';
  const MISSING_SOURCE_SELECTION_MESSAGE =
    '媒体が選択されていません。トップページまたは媒体一覧から選んでください。';
  const UNKNOWN_SOURCE_MESSAGE =
    '指定された媒体は見つかりませんでした。別の媒体を選んでください。';
  const EMPTY_SOURCE_ARTICLES_MESSAGE =
    'この媒体の記事はまだありません。次回の生成を待つか、別の媒体を選んでください。';
  const INVALID_ARTICLE_LINK_LABEL = '元記事リンクを確認できません。';

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

  async function fetchJson<T = unknown>(
    fetchImpl: typeof fetch | undefined,
    url: string,
  ): Promise<T> {
    if (typeof fetchImpl !== 'function') {
      throw new Error('Fetch API is not available in this environment.');
    }

    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = new Error(
        `Failed to fetch ${url}: ${response.status}`,
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return response.json() as Promise<T>;
  }

  async function loadHomePageData({
    basePath = DEFAULT_BASE_PATH,
    fetchImpl = browserScope.fetch,
  }: HomePageInitOptions = {}): Promise<HomePageDataResult> {
    const paths = buildDataPaths(basePath);

    try {
      const [articles, categories, sources, meta] = await Promise.all([
        fetchJson<unknown>(fetchImpl, paths.articles),
        fetchJson<unknown>(fetchImpl, paths.categories),
        fetchJson<unknown>(fetchImpl, paths.sources),
        fetchJson<unknown>(fetchImpl, paths.meta),
      ]);

      return {
        kind: 'ready',
        articles: Array.isArray(articles)
          ? (articles as PublicArticleSummaryLike[])
          : [],
        categories: Array.isArray(categories)
          ? (categories as PublicCategorySummaryLike[])
          : [],
        sources: Array.isArray(sources)
          ? (sources as PublicSourceSummaryLike[])
          : [],
        meta: meta && typeof meta === 'object' ? (meta as PublicMetaLike) : {},
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status?: number }).status === 404
      ) {
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

  function describeLoadError(error: unknown): string {
    if (
      browserScope.location &&
      typeof browserScope.location.protocol === 'string' &&
      browserScope.location.protocol === 'file:'
    ) {
      return FILE_PROTOCOL_ERROR;
    }

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: string }).message === 'string' &&
      (error as { message: string }).message.trim() !== ''
    ) {
      return GENERIC_LOAD_ERROR;
    }

    return GENERIC_LOAD_ERROR;
  }

  function formatDateTime(value: string | null | undefined): string {
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

  function escapeHtml(value: unknown): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCount(value: number | string | null | undefined): string {
    return Number.isFinite(Number(value)) ? String(Number(value)) : '0';
  }

  function buildHomePageViewModel({
    articles,
    categories,
    sources,
    meta,
  }: ReadyPayload): HomePageViewModel {
    return {
      generatedAtText:
        meta && meta.generatedAt
          ? `${formatDateTime(meta.generatedAt)} 更新`
          : '更新時刻不明',
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
      categories: buildCategoryNavigationItems(categories, {
        hrefBuilder: buildCategoryHrefFromHome,
      }),
      sources: buildSourceNavigationItems(sources, {
        hrefBuilder: buildSourceHrefFromHome,
      }),
      articles: buildArticleViewModels(articles),
    };
  }

  function normalizeExternalArticleUrl(
    value: string | null | undefined,
  ): string | null {
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }

      return parsed.toString();
    } catch (_error) {
      return null;
    }
  }

  function buildArticleViewModels(
    articles: PublicArticleSummaryLike[],
  ): ArticleViewModel[] {
    return articles.map((article) => {
      const externalUrl = normalizeExternalArticleUrl(article.url);

      return {
        title: article.title,
        url: externalUrl,
        sourceName: article.sourceName,
        categoryLabel: article.categoryLabel,
        publishedAtLabel: formatDateTime(article.publishedAt || article.sortAt),
        summary: article.summary || MISSING_SUMMARY_LABEL,
        hasSummary: Boolean(article.summary),
        imageUrl: article.imageUrl || null,
        canOpenExternal: Boolean(externalUrl),
        externalLinkDescription: externalUrl
          ? '元記事で続きを読む'
          : INVALID_ARTICLE_LINK_LABEL,
      };
    });
  }

  function buildCategoryNavigationItems(
    categories: PublicCategorySummaryLike[],
    {
      selectedCategoryId = null,
      hrefBuilder = buildCategoryHrefFromHome,
    }: {
      selectedCategoryId?: string | null;
      hrefBuilder?: ((categoryId: string) => string) | null;
    } = {},
  ): CategoryNavigationItem[] {
    return categories.map((category) => ({
      id: category.id,
      label: category.label,
      countLabel: `${formatCount(category.articleCount)}件`,
      href: typeof hrefBuilder === 'function' ? hrefBuilder(category.id) : null,
      isSelected: selectedCategoryId === category.id,
    }));
  }

  function buildSourceNavigationItems(
    sources: PublicSourceSummaryLike[],
    {
      selectedSourceId = null,
      hrefBuilder = buildSourceHrefFromHome,
    }: {
      selectedSourceId?: string | null;
      hrefBuilder?: ((sourceId: string) => string) | null;
    } = {},
  ): SourceNavigationItem[] {
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      countLabel: `${formatCount(source.articleCount)}件`,
      metaLabel: [source.categoryLabel, source.language]
        .filter(Boolean)
        .join(' / '),
      href: typeof hrefBuilder === 'function' ? hrefBuilder(source.id) : null,
      isSelected: selectedSourceId === source.id,
    }));
  }

  function buildSourcePageViewModel({
    sourceId,
    articles,
    sources,
    meta,
  }: {
    sourceId: string;
    articles: PublicArticleSummaryLike[];
    sources: PublicSourceSummaryLike[];
    meta: PublicMetaLike;
  }): SourcePageViewModel {
    const navigationItems = buildSourceNavigationItems(sources, {
      selectedSourceId: sourceId,
      hrefBuilder: buildSourceHrefFromSourcePage,
    });
    const selectedSource =
      sources.find((source) => source.id === sourceId) || null;

    if (!sourceId) {
      return {
        kind: 'missing-source',
        generatedAtText:
          meta && meta.generatedAt
            ? `${formatDateTime(meta.generatedAt)} 更新`
            : '更新時刻不明',
        navigationItems,
        title: '媒体を選択してください',
        description: MISSING_SOURCE_SELECTION_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: MISSING_SOURCE_SELECTION_MESSAGE,
      };
    }

    if (!selectedSource) {
      return {
        kind: 'unknown-source',
        generatedAtText:
          meta && meta.generatedAt
            ? `${formatDateTime(meta.generatedAt)} 更新`
            : '更新時刻不明',
        navigationItems,
        title: '媒体が見つかりません',
        description: UNKNOWN_SOURCE_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: UNKNOWN_SOURCE_MESSAGE,
      };
    }

    const selectedArticles = articles.filter(
      (article) => article.sourceId === selectedSource.id,
    );
    const descriptionParts = [
      selectedSource.categoryLabel,
      selectedSource.language,
    ].filter(Boolean);
    const description =
      descriptionParts.length > 0
        ? `${selectedSource.name} (${descriptionParts.join(' / ')}) の記事だけを新着順で表示しています。`
        : `${selectedSource.name} の記事だけを新着順で表示しています。`;

    return {
      kind: selectedArticles.length === 0 ? 'empty-source' : 'ready',
      generatedAtText:
        meta && meta.generatedAt
          ? `${formatDateTime(meta.generatedAt)} 更新`
          : '更新時刻不明',
      navigationItems,
      title: `${selectedSource.name} の記事一覧`,
      description,
      articlesCountText: `${selectedArticles.length} 件`,
      articles: buildArticleViewModels(selectedArticles),
      statusMessage:
        selectedArticles.length === 0 ? EMPTY_SOURCE_ARTICLES_MESSAGE : '',
      selectedSourceName: selectedSource.name,
    };
  }

  function buildCategoryPageViewModel({
    categoryId,
    articles,
    categories,
    meta,
  }: {
    categoryId: string;
    articles: PublicArticleSummaryLike[];
    categories: PublicCategorySummaryLike[];
    meta: PublicMetaLike;
  }): CategoryPageViewModel {
    const navigationItems = buildCategoryNavigationItems(categories, {
      selectedCategoryId: categoryId,
      hrefBuilder: buildCategoryHrefFromCategoryPage,
    });
    const selectedCategory =
      categories.find((category) => category.id === categoryId) || null;

    if (!categoryId) {
      return {
        kind: 'missing-category',
        generatedAtText:
          meta && meta.generatedAt
            ? `${formatDateTime(meta.generatedAt)} 更新`
            : '更新時刻不明',
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
        generatedAtText:
          meta && meta.generatedAt
            ? `${formatDateTime(meta.generatedAt)} 更新`
            : '更新時刻不明',
        navigationItems,
        title: 'カテゴリが見つかりません',
        description: UNKNOWN_CATEGORY_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: UNKNOWN_CATEGORY_MESSAGE,
      };
    }

    const selectedArticles = articles.filter(
      (article) => article.categoryId === selectedCategory.id,
    );

    return {
      kind: selectedArticles.length === 0 ? 'empty-category' : 'ready',
      generatedAtText:
        meta && meta.generatedAt
          ? `${formatDateTime(meta.generatedAt)} 更新`
          : '更新時刻不明',
      navigationItems,
      title: `${selectedCategory.label} の記事一覧`,
      description: `${selectedCategory.label} に分類された記事だけを新着順で表示しています。`,
      articlesCountText: `${selectedArticles.length} 件`,
      articles: buildArticleViewModels(selectedArticles),
      statusMessage:
        selectedArticles.length === 0 ? EMPTY_CATEGORY_ARTICLES_MESSAGE : '',
      selectedCategoryLabel: selectedCategory.label,
    };
  }

  function renderStats(stats: StatViewModel[]): string {
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

  function renderChipItems(categories: CategoryNavigationItem[]): string {
    if (categories.length === 0) {
      return '<p class="placeholder-text">カテゴリはまだありません。</p>';
    }

    return categories.map((category) => renderCategoryChip(category)).join('');
  }

  function renderCategoryChip(category: CategoryNavigationItem): string {
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

  function renderSourceItems(sources: SourceNavigationItem[]): string {
    if (sources.length === 0) {
      return '<p class="placeholder-text">媒体はまだありません。</p>';
    }

    return sources.map((source) => renderSourcePill(source)).join('');
  }

  function renderSourcePill(source: SourceNavigationItem): string {
    const selectedClassName = source.isSelected ? ' source-pill--selected' : '';
    const content = `
      <span>${escapeHtml(source.name)}</span>
      <span class="source-pill__count">${escapeHtml(source.countLabel)}</span>
      ${source.metaLabel ? `<span class="source-pill__meta">${escapeHtml(source.metaLabel)}</span>` : ''}
    `;

    if (source.href) {
      return `
        <a class="source-pill${selectedClassName}" href="${escapeHtml(source.href)}" ${source.isSelected ? 'aria-current="page"' : ''}>
          ${content}
        </a>
      `;
    }

    return `
      <span class="source-pill${selectedClassName}">
        ${content}
      </span>
    `;
  }

  function renderArticleItems(articles: ArticleViewModel[]): string {
    return articles
      .map((article) => {
        const safeArticleUrl =
          article.canOpenExternal === false
            ? null
            : normalizeExternalArticleUrl(article.url);
        const canOpenExternal = Boolean(safeArticleUrl);
        const externalLinkDescription =
          article.externalLinkDescription ||
          (canOpenExternal ? '元記事で続きを読む' : INVALID_ARTICLE_LINK_LABEL);
        const articleTitleMarkup = canOpenExternal
          ? `
              <a href="${escapeHtml(safeArticleUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`${article.title} を元記事で開く`)}">
                ${escapeHtml(article.title)}
              </a>
            `
          : `<span>${escapeHtml(article.title)}</span>`;
        const articleLinkMarkup = canOpenExternal
          ? `
              <a class="article-card__link" href="${escapeHtml(safeArticleUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`${article.title} を元記事で開く`)}">
                開く
              </a>
            `
          : '<span class="article-card__link article-card__link--disabled" aria-disabled="true">リンクなし</span>';

        return `
          <li class="article-card ${article.imageUrl ? 'article-card--with-image' : ''}">
            <article class="article-card__content">
              <div class="article-card__meta">
                <span class="meta-pill">${escapeHtml(article.sourceName)}</span>
                <span class="meta-pill">${escapeHtml(article.categoryLabel)}</span>
                <span class="meta-pill">${escapeHtml(article.publishedAtLabel)}</span>
              </div>
              <h3 class="article-card__title">
                ${articleTitleMarkup}
              </h3>
              <p class="article-card__summary ${article.hasSummary ? '' : 'article-card__summary--missing'}">
                ${escapeHtml(article.summary)}
              </p>
              <div class="article-card__footer">
                <span class="muted">${escapeHtml(externalLinkDescription)}</span>
                ${articleLinkMarkup}
              </div>
            </article>
            ${
              article.imageUrl
                ? `<img class="article-card__image" src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy" />`
                : ''
            }
          </li>
        `;
      })
      .join('');
  }

  function buildCategoryHrefFromHome(categoryId: string): string {
    return `./categories/?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
  }

  function buildCategoryHrefFromCategoryPage(categoryId: string): string {
    return `./?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
  }

  function buildSourceHrefFromHome(sourceId: string): string {
    return `./sources/?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
  }

  function buildSourceHrefFromSourcePage(sourceId: string): string {
    return `./?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
  }

  function getCategoryIdFromLocation(
    locationRef: LocationLike | null | undefined = browserScope.location,
  ): string {
    if (!locationRef || typeof locationRef.search !== 'string') {
      return '';
    }

    const params = new URLSearchParams(locationRef.search);
    return params.get(CATEGORY_QUERY_PARAM) || '';
  }

  function getSourceIdFromLocation(
    locationRef: LocationLike | null | undefined = browserScope.location,
  ): string {
    if (!locationRef || typeof locationRef.search !== 'string') {
      return '';
    }

    const params = new URLSearchParams(locationRef.search);
    return params.get(SOURCE_QUERY_PARAM) || '';
  }

  function setStatus(
    documentRef: Document,
    { kind, message }: StatusOptions,
  ): void {
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

  function renderHomePage(documentRef: Document, payload: ReadyPayload): void {
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
        message:
          '記事はまだありません。`public/data/articles.json` が空か、取得対象 feed が未設定の可能性があります。',
      });
      return;
    }

    statusElement.hidden = true;
    listElement.hidden = false;
    listElement.innerHTML = renderArticleItems(viewModel.articles);
  }

  function renderCategoryPage(
    documentRef: Document,
    payload: ReadyPayload,
    { categoryId }: { categoryId?: string } = {},
  ): CategoryPageViewModel {
    const viewModel = buildCategoryPageViewModel({
      categoryId: categoryId || '',
      articles: payload.articles,
      categories: payload.categories,
      meta: payload.meta,
    });
    const generatedAtElement = documentRef.getElementById('generated-at');
    const navElement = documentRef.getElementById('category-nav');
    const titleElement = documentRef.getElementById('category-page-title');
    const descriptionElement = documentRef.getElementById(
      'category-page-description',
    );
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

  function renderSourcePage(
    documentRef: Document,
    payload: ReadyPayload,
    { sourceId }: { sourceId?: string } = {},
  ): SourcePageViewModel {
    const viewModel = buildSourcePageViewModel({
      sourceId: sourceId || '',
      articles: payload.articles,
      sources: payload.sources,
      meta: payload.meta,
    });
    const generatedAtElement = documentRef.getElementById('generated-at');
    const navElement = documentRef.getElementById('source-nav');
    const titleElement = documentRef.getElementById('source-page-title');
    const descriptionElement = documentRef.getElementById(
      'source-page-description',
    );
    const articlesCountElement = documentRef.getElementById('articles-count');
    const statusElement = documentRef.getElementById('articles-status');
    const listElement = documentRef.getElementById('articles-list');

    if (generatedAtElement) {
      generatedAtElement.textContent = viewModel.generatedAtText;
    }

    if (navElement) {
      navElement.innerHTML = renderSourceItems(viewModel.navigationItems);
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

  async function initHomePage({
    basePath = DEFAULT_BASE_PATH,
    fetchImpl = browserScope.fetch,
    documentRef = browserScope.document,
  }: HomePageInitOptions = {}): Promise<
    HomePageDataResult | { kind: 'skipped' }
  > {
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
    fetchImpl = browserScope.fetch,
    documentRef = browserScope.document,
    locationRef = browserScope.location,
  }: CategoryPageInitOptions = {}): Promise<
    | CategoryPageViewModel
    | MissingDataPayload
    | ErrorPayload
    | { kind: 'skipped' }
  > {
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

  async function initSourcePage({
    basePath = '..',
    fetchImpl = browserScope.fetch,
    documentRef = browserScope.document,
    locationRef = browserScope.location,
  }: SourcePageInitOptions = {}): Promise<
    | SourcePageViewModel
    | MissingDataPayload
    | ErrorPayload
    | { kind: 'skipped' }
  > {
    if (!documentRef) {
      return { kind: 'skipped' };
    }

    setStatus(documentRef, {
      kind: 'loading',
      message: '公開 JSON を読み込んでいます…',
    });

    const payload = await loadHomePageData({ basePath, fetchImpl });

    if (payload.kind === 'ready') {
      return renderSourcePage(documentRef, payload, {
        sourceId: getSourceIdFromLocation(locationRef),
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
    MISSING_SOURCE_SELECTION_MESSAGE,
    INVALID_ARTICLE_LINK_LABEL,
    MISSING_SUMMARY_LABEL,
    SOURCE_QUERY_PARAM,
    UNKNOWN_CATEGORY_MESSAGE,
    UNKNOWN_PUBLISHED_AT_LABEL,
    UNKNOWN_SOURCE_MESSAGE,
    buildArticleViewModels,
    buildCategoryHrefFromCategoryPage,
    buildCategoryHrefFromHome,
    buildCategoryNavigationItems,
    buildCategoryPageViewModel,
    buildSourceHrefFromHome,
    buildSourceHrefFromSourcePage,
    buildSourceNavigationItems,
    buildSourcePageViewModel,
    buildDataPaths,
    buildHomePageViewModel,
    normalizeExternalArticleUrl,
    describeLoadError,
    escapeHtml,
    formatCount,
    formatDateTime,
    getCategoryIdFromLocation,
    getSourceIdFromLocation,
    initCategoryPage,
    initHomePage,
    initSourcePage,
    loadHomePageData,
    renderArticleItems,
    renderCategoryPage,
    renderChipItems,
    renderHomePage,
    renderSourceItems,
    renderSourcePage,
    renderStats,
    setStatus,
    EMPTY_SOURCE_ARTICLES_MESSAGE,
  };

  if (commonJsModule && typeof commonJsModule === 'object') {
    commonJsModule.exports = exported;
  }

  browserScope.FeedShelfApp = exported;

  if (browserScope.document) {
    browserScope.addEventListener('DOMContentLoaded', () => {
      const pathname =
        browserScope.location &&
        typeof browserScope.location.pathname === 'string'
          ? browserScope.location.pathname
          : '';
      const isCategoryPage = /\/categories\/(?:index\.html)?$/u.test(pathname);
      const isSourcePage = /\/sources\/(?:index\.html)?$/u.test(pathname);
      const initializer = isCategoryPage
        ? initCategoryPage
        : isSourcePage
          ? initSourcePage
          : initHomePage;

      initializer().catch((error: unknown) => {
        console.error('[feedshelf] failed to initialize page', error);
      });
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
