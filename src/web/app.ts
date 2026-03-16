interface PublicShelfSummaryLike {
  id: string;
  title: string;
  description: string;
  articleCount: number;
  sourceCount: number;
  latestSortAt?: string;
  sampleTags?: string[];
}

interface PublicArticleSummaryLike {
  id: string;
  title: string;
  url: string | null;
  summary: string | null;
  publishedAt: string | null;
  sortAt: string;
  sourceId: string;
  sourceName: string;
  shelfIds?: string[];
  categoryId?: string;
  categoryLabel?: string;
  imageUrl: string | null;
  sourceTags?: string[];
  entryTags?: string[];
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
  language: string;
  siteUrl?: string;
  shelfIds?: string[];
  categoryLabel?: string;
  categoryId?: string;
  latestSortAt?: string;
  tags?: string[];
}

interface PublicTagSummaryLike {
  id: string;
  label: string;
  articleCount: number;
  sourceCount?: number;
  latestSortAt?: string;
}

interface PublicSearchIndexEntryLike {
  articleId: string;
  sortAt: string;
  shelfIds?: string[];
  title: string;
  sourceName: string;
  sourceTags?: string[];
  entryTags?: string[];
  titleText?: string;
  sourceText?: string;
  tagText?: string;
  searchText?: string;
}

interface PublicMetaLike {
  generatedAt?: string;
  articleCount?: number;
  sourceCount?: number;
  shelfCount?: number;
  categoryCount?: number;
  tagCount?: number;
  searchIndexCount?: number;
}

interface ReadyPayload {
  kind: 'ready';
  articles: PublicArticleSummaryLike[];
  shelves: PublicShelfSummaryLike[];
  categories: PublicCategorySummaryLike[];
  sources: PublicSourceSummaryLike[];
  tags: PublicTagSummaryLike[];
  meta: PublicMetaLike;
}

interface SearchReadyPayload extends ReadyPayload {
  searchIndex: PublicSearchIndexEntryLike[];
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
  visibleTags: string[];
}

interface CategoryNavigationItem {
  id: string;
  label: string;
  countLabel: string;
  href: string | null;
  isSelected: boolean;
}

interface ShelfCardViewModel {
  id: string;
  title: string;
  description: string;
  countLabel: string;
  sourceCountLabel: string;
  freshnessLabel: string;
  href: string | null;
}

interface SourceNavigationItem {
  id: string;
  name: string;
  countLabel: string;
  metaLabel: string;
  href: string | null;
  isSelected: boolean;
}

type TagNavigationItem = CategoryNavigationItem;

interface HomePageViewModel {
  generatedAtText: string;
  stats: StatViewModel[];
  shelves: ShelfCardViewModel[];
  tags: TagNavigationItem[];
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

interface ShelfPageViewModel {
  kind: 'missing-shelf' | 'unknown-shelf' | 'empty-shelf' | 'ready';
  generatedAtText: string;
  navigationItems: CategoryNavigationItem[];
  relatedSources: SourceNavigationItem[];
  title: string;
  description: string;
  featuredCountText: string;
  featuredArticles: ArticleViewModel[];
  articlesCountText: string;
  articles: ArticleViewModel[];
  statusMessage: string;
  selectedShelfTitle?: string;
}

interface SourcePageViewModel {
  kind: 'missing-source' | 'unknown-source' | 'empty-source' | 'ready';
  generatedAtText: string;
  navigationItems: SourceNavigationItem[];
  relatedShelves: CategoryNavigationItem[];
  title: string;
  description: string;
  articlesCountText: string;
  articles: ArticleViewModel[];
  statusMessage: string;
  selectedSourceName?: string;
}

interface TagPageViewModel {
  kind: 'missing-tag' | 'unknown-tag' | 'empty-tag' | 'ready';
  generatedAtText: string;
  navigationItems: TagNavigationItem[];
  title: string;
  description: string;
  articlesCountText: string;
  articles: ArticleViewModel[];
  statusMessage: string;
  selectedTagLabel?: string;
}

interface SearchPageViewModel {
  kind: 'missing-query' | 'no-results' | 'ready';
  generatedAtText: string;
  title: string;
  description: string;
  articlesCountText: string;
  articles: ArticleViewModel[];
  statusMessage: string;
  queryValue: string;
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

interface SearchPageInitOptions extends HomePageInitOptions {
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
    '公開データがまだ生成されていません。先に `pnpm run pipeline:update` を実行して `public/data/*.json` を作成してください。';
  const CATEGORY_QUERY_PARAM = 'id';
  const MISSING_CATEGORY_SELECTION_MESSAGE =
    'カテゴリが選択されていません。compatibility route 上の一覧から選ぶか、棚カタログ・タグ・検索から探し直してください。';
  const UNKNOWN_CATEGORY_MESSAGE =
    '指定されたカテゴリは見つかりませんでした。棚カタログへ戻るか、別のカテゴリを選んでください。';
  const EMPTY_CATEGORY_ARTICLES_MESSAGE =
    'このカテゴリの記事はまだありません。次回の生成を待つか、棚・タグ・媒体ページから別の導線を試してください。';
  const MISSING_SHELF_SELECTION_MESSAGE =
    '棚 route が特定できませんでした。トップの棚カタログから入り直してください。';
  const UNKNOWN_SHELF_MESSAGE =
    '指定された棚は見つかりませんでした。棚カタログへ戻るか、別の棚を選んでください。';
  const EMPTY_SHELF_ARTICLES_MESSAGE =
    'この棚の記事はまだありません。次回の生成を待つか、タグ・媒体・検索から別の導線を試してください。';
  const SOURCE_QUERY_PARAM = 'id';
  const TAG_QUERY_PARAM = 'id';
  const SEARCH_QUERY_PARAM = 'q';
  const MISSING_SOURCE_SELECTION_MESSAGE =
    '媒体が選択されていません。トップページまたは媒体一覧から選んでください。';
  const UNKNOWN_SOURCE_MESSAGE =
    '指定された媒体は見つかりませんでした。別の媒体を選んでください。';
  const EMPTY_SOURCE_ARTICLES_MESSAGE =
    'この媒体の記事はまだありません。次回の生成を待つか、別の媒体を選んでください。';
  const MISSING_TAG_SELECTION_MESSAGE =
    'タグが選択されていません。トップページまたはタグ一覧から選んでください。';
  const UNKNOWN_TAG_MESSAGE =
    '指定されたタグは見つかりませんでした。別のタグを選んでください。';
  const EMPTY_TAG_ARTICLES_MESSAGE =
    'このタグの記事はまだありません。別のタグを選ぶか、次回の生成を待ってください。';
  const MISSING_SEARCH_QUERY_MESSAGE =
    '検索語がまだ入力されていません。タイトル・媒体名・タグ名から探したい語を入力してください。';
  const EMPTY_SEARCH_RESULTS_MESSAGE =
    '一致する記事が見つかりませんでした。語句を減らすか、タグ・媒体ページから探し直してください。';
  const SEARCH_RANKING_HINT = '並び順: title > sourceName > tags > freshness';
  const INVALID_ARTICLE_LINK_LABEL = '元記事リンクを確認できません。';

  function buildDataPaths(basePath = DEFAULT_BASE_PATH) {
    const trimmed = String(basePath).replace(/\/+$/u, '') || '.';
    const prefix = trimmed === '.' ? './data' : `${trimmed}/data`;

    return {
      articles: `${prefix}/articles.json`,
      shelves: `${prefix}/shelves.json`,
      categories: `${prefix}/categories.json`,
      sources: `${prefix}/sources.json`,
      tags: `${prefix}/tags.json`,
      searchIndex: `${prefix}/search-index.json`,
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
      const [articles, shelvesResult, categories, sources, tags, meta] =
        await Promise.all([
          fetchJson<unknown>(fetchImpl, paths.articles),
          fetchJson<unknown>(fetchImpl, paths.shelves).catch(() => []),
          fetchJson<unknown>(fetchImpl, paths.categories),
          fetchJson<unknown>(fetchImpl, paths.sources),
          fetchJson<unknown>(fetchImpl, paths.tags),
          fetchJson<unknown>(fetchImpl, paths.meta),
        ]);

      const parsedCategories = Array.isArray(categories)
        ? (categories as PublicCategorySummaryLike[])
        : [];
      const parsedShelves =
        Array.isArray(shelvesResult) && shelvesResult.length > 0
          ? (shelvesResult as PublicShelfSummaryLike[])
          : parsedCategories.map((category) => ({
              id: category.id,
              title: category.label,
              description: '',
              articleCount: category.articleCount,
              sourceCount: 0,
              latestSortAt: category.latestSortAt,
            }));

      return {
        kind: 'ready',
        articles: Array.isArray(articles)
          ? (articles as PublicArticleSummaryLike[])
          : [],
        shelves: parsedShelves,
        categories: parsedCategories,
        sources: Array.isArray(sources)
          ? (sources as PublicSourceSummaryLike[])
          : [],
        tags: Array.isArray(tags) ? (tags as PublicTagSummaryLike[]) : [],
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

  async function loadSearchPageData({
    basePath = DEFAULT_BASE_PATH,
    fetchImpl = browserScope.fetch,
  }: HomePageInitOptions = {}): Promise<
    SearchReadyPayload | MissingDataPayload | ErrorPayload
  > {
    const payload = await loadHomePageData({ basePath, fetchImpl });

    if (payload.kind !== 'ready') {
      return payload;
    }

    const paths = buildDataPaths(basePath);

    try {
      const searchIndex = await fetchJson<unknown>(
        fetchImpl,
        paths.searchIndex,
      );

      return {
        ...payload,
        searchIndex: Array.isArray(searchIndex)
          ? (searchIndex as PublicSearchIndexEntryLike[])
          : [],
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

  function toComparableTime(value: string | null | undefined): number {
    if (!value) {
      return Number.NEGATIVE_INFINITY;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? Number.NEGATIVE_INFINITY
      : parsed.getTime();
  }

  function compareByNewestTime(
    left: string | null | undefined,
    right: string | null | undefined,
  ): number {
    const leftTime = toComparableTime(left);
    const rightTime = toComparableTime(right);

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return 0;
  }

  function buildHomePageViewModel({
    articles,
    shelves,
    sources,
    tags,
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
          label: '棚数',
          value: formatCount(meta && (meta.shelfCount || meta.categoryCount)),
        },
      ],
      shelves: buildShelfCards({
        shelves,
      }),
      tags: buildTagNavigationItems(tags, {
        hrefBuilder: buildTagHrefFromHome,
      }),
      sources: buildSourceNavigationItems(sources, {
        hrefBuilder: buildSourceHrefFromHome,
      }),
      articles: buildArticleViewModels(articles),
    };
  }

  function normalizeWhitespace(value: string): string {
    return String(value).replace(/\s+/gu, ' ').trim();
  }

  function normalizeTagCompareKey(value: string | null | undefined): string {
    if (typeof value !== 'string') {
      return '';
    }

    return normalizeWhitespace(value.normalize('NFKC')).toLocaleLowerCase(
      'en-US',
    );
  }

  function normalizeSearchCompareText(
    value: string | null | undefined,
  ): string {
    if (typeof value !== 'string') {
      return '';
    }

    return normalizeWhitespace(value.normalize('NFKC')).toLocaleLowerCase(
      'en-US',
    );
  }

  function tokenizeSearchQuery(value: string | null | undefined): string[] {
    const normalized = normalizeSearchCompareText(value);
    return normalized === '' ? [] : normalized.split(' ');
  }

  function buildSearchEntryFields(entry: PublicSearchIndexEntryLike): {
    titleText: string;
    sourceText: string;
    tagText: string;
    searchText: string;
  } {
    const sourceTags = Array.isArray(entry.sourceTags) ? entry.sourceTags : [];
    const entryTags = Array.isArray(entry.entryTags) ? entry.entryTags : [];
    const tagLabels = uniqueLabels([...sourceTags, ...entryTags]);

    const titleText =
      entry.titleText || normalizeSearchCompareText(entry.title || '');
    const sourceText =
      entry.sourceText || normalizeSearchCompareText(entry.sourceName || '');
    const tagText =
      entry.tagText || normalizeSearchCompareText(tagLabels.join(' '));
    const searchText =
      entry.searchText ||
      normalizeSearchCompareText(
        [entry.title || '', entry.sourceName || '', ...tagLabels].join(' '),
      );

    return {
      titleText,
      sourceText,
      tagText,
      searchText,
    };
  }

  function scoreSearchEntry(
    entry: PublicSearchIndexEntryLike,
    query: string | null | undefined,
  ): number {
    const normalizedQuery = normalizeSearchCompareText(query);
    const terms = tokenizeSearchQuery(normalizedQuery);
    if (terms.length === 0) {
      return 0;
    }

    const { titleText, sourceText, tagText, searchText } =
      buildSearchEntryFields(entry);

    for (const term of terms) {
      if (!searchText.includes(term)) {
        return 0;
      }
    }

    let score = 0;

    if (normalizedQuery !== '') {
      if (titleText === normalizedQuery) {
        score += 1_000;
      } else if (titleText.includes(normalizedQuery)) {
        score += 400;
      }

      if (sourceText.includes(normalizedQuery)) {
        score += 180;
      }

      if (tagText.includes(normalizedQuery)) {
        score += 120;
      }
    }

    for (const term of terms) {
      if (titleText.includes(term)) {
        score += 120;
      }

      if (sourceText.includes(term)) {
        score += 72;
      }

      if (tagText.includes(term)) {
        score += 36;
      }
    }

    return score;
  }

  function uniqueLabels(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      if (typeof value !== 'string') {
        continue;
      }

      const normalized = normalizeWhitespace(value.normalize('NFKC'));
      const compareKey = normalizeTagCompareKey(normalized);
      if (!compareKey || seen.has(compareKey)) {
        continue;
      }

      seen.add(compareKey);
      result.push(normalized);
    }

    return result;
  }

  function buildVisibleTags(article: PublicArticleSummaryLike): string[] {
    return uniqueLabels([
      ...(Array.isArray(article.entryTags) ? article.entryTags : []),
      ...(Array.isArray(article.sourceTags) ? article.sourceTags : []),
    ]).slice(0, 3);
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
        categoryLabel: article.categoryLabel || '',
        publishedAtLabel: formatDateTime(article.publishedAt || article.sortAt),
        summary: article.summary || MISSING_SUMMARY_LABEL,
        hasSummary: Boolean(article.summary),
        imageUrl: article.imageUrl || null,
        canOpenExternal: Boolean(externalUrl),
        externalLinkDescription: externalUrl
          ? '元記事で続きを読む'
          : INVALID_ARTICLE_LINK_LABEL,
        visibleTags: buildVisibleTags(article),
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

  function buildShelfCards({
    shelves,
  }: {
    shelves: PublicShelfSummaryLike[];
  }): ShelfCardViewModel[] {
    return shelves.map((shelf) => {
      const sampleTags = Array.isArray(shelf.sampleTags)
        ? shelf.sampleTags.slice(0, 3)
        : [];
      const descriptionParts = [shelf.description];

      if (sampleTags.length > 0) {
        descriptionParts.push(`注目タグ: ${sampleTags.join(' / ')}`);
      }

      return {
        id: shelf.id,
        title: shelf.title,
        description: descriptionParts.filter(Boolean).join(' '),
        countLabel: `${formatCount(shelf.articleCount)} 件`,
        sourceCountLabel: `${formatCount(shelf.sourceCount)} 媒体`,
        freshnessLabel: shelf.latestSortAt
          ? `${formatDateTime(shelf.latestSortAt)} 更新`
          : '更新時刻不明',
        href: buildShelfHrefFromHome(shelf.id),
      };
    });
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
      metaLabel: [
        `${formatCount(Array.isArray(source.shelfIds) ? source.shelfIds.length : source.categoryLabel ? 1 : 0)} 棚`,
        source.language,
      ]
        .filter(Boolean)
        .join(' / '),
      href: typeof hrefBuilder === 'function' ? hrefBuilder(source.id) : null,
      isSelected: selectedSourceId === source.id,
    }));
  }

  function buildTagNavigationItems(
    tags: PublicTagSummaryLike[],
    {
      selectedTagId = null,
      hrefBuilder = buildTagHrefFromHome,
    }: {
      selectedTagId?: string | null;
      hrefBuilder?: ((tagId: string) => string) | null;
    } = {},
  ): TagNavigationItem[] {
    return tags.map((tag) => ({
      id: tag.id,
      label: tag.label,
      countLabel: `${formatCount(tag.articleCount)}件`,
      href: typeof hrefBuilder === 'function' ? hrefBuilder(tag.id) : null,
      isSelected: selectedTagId === tag.id,
    }));
  }

  function buildShelfNavigationItems(
    shelves: PublicShelfSummaryLike[],
    {
      selectedShelfId = null,
      hrefBuilder = buildShelfHrefFromHome,
    }: {
      selectedShelfId?: string | null;
      hrefBuilder?: ((shelfId: string) => string) | null;
    } = {},
  ): CategoryNavigationItem[] {
    return buildCategoryNavigationItems(
      shelves.map((shelf) => ({
        id: shelf.id,
        label: shelf.title,
        articleCount: shelf.articleCount,
        latestSortAt: shelf.latestSortAt || '',
      })),
      {
        selectedCategoryId: selectedShelfId,
        hrefBuilder,
      },
    );
  }

  function buildShelfPageViewModel({
    shelfId,
    articles,
    shelves,
    sources,
    meta,
  }: {
    shelfId: string;
    articles: PublicArticleSummaryLike[];
    shelves: PublicShelfSummaryLike[];
    sources: PublicSourceSummaryLike[];
    meta: PublicMetaLike;
  }): ShelfPageViewModel {
    const navigationItems = buildShelfNavigationItems(shelves, {
      selectedShelfId: shelfId,
      hrefBuilder: buildShelfHrefFromShelfPage,
    });
    const selectedShelf = shelves.find((shelf) => shelf.id === shelfId) || null;
    const generatedAtText =
      meta && meta.generatedAt
        ? `${formatDateTime(meta.generatedAt)} 更新`
        : '更新時刻不明';

    if (!shelfId) {
      return {
        kind: 'missing-shelf',
        generatedAtText,
        navigationItems,
        relatedSources: [],
        title: '棚を選択してください',
        description: MISSING_SHELF_SELECTION_MESSAGE,
        featuredCountText: '0 件',
        featuredArticles: [],
        articlesCountText: '0 件',
        articles: [],
        statusMessage: MISSING_SHELF_SELECTION_MESSAGE,
      };
    }

    if (!selectedShelf) {
      return {
        kind: 'unknown-shelf',
        generatedAtText,
        navigationItems,
        relatedSources: [],
        title: '棚が見つかりません',
        description: UNKNOWN_SHELF_MESSAGE,
        featuredCountText: '0 件',
        featuredArticles: [],
        articlesCountText: '0 件',
        articles: [],
        statusMessage: UNKNOWN_SHELF_MESSAGE,
      };
    }

    const selectedArticles = articles.filter((article) =>
      Array.isArray(article.shelfIds)
        ? article.shelfIds.includes(selectedShelf.id)
        : article.categoryId === selectedShelf.id,
    );
    const featuredArticles = buildArticleViewModels(
      selectedArticles.slice(0, 3),
    );
    const relatedSources = buildSourceNavigationItems(
      sources.filter((source) =>
        Array.isArray(source.shelfIds)
          ? source.shelfIds.includes(selectedShelf.id)
          : source.categoryId === selectedShelf.id,
      ),
      {
        hrefBuilder: buildSourceHrefFromShelfPage,
      },
    );
    const description = `${selectedShelf.description} 注目 ${formatCount(
      featuredArticles.length,
    )} 件と新着 ${formatCount(selectedArticles.length)} 件、関連媒体 ${formatCount(
      selectedShelf.sourceCount,
    )} 件をこの棚から辿れます。`;

    return {
      kind: selectedArticles.length === 0 ? 'empty-shelf' : 'ready',
      generatedAtText,
      navigationItems,
      relatedSources,
      title: `${selectedShelf.title} 棚`,
      description,
      featuredCountText: `${featuredArticles.length} 件`,
      featuredArticles,
      articlesCountText: `${selectedArticles.length} 件`,
      articles: buildArticleViewModels(selectedArticles),
      statusMessage:
        selectedArticles.length === 0 ? EMPTY_SHELF_ARTICLES_MESSAGE : '',
      selectedShelfTitle: selectedShelf.title,
    };
  }

  function buildSourcePageViewModel({
    sourceId,
    articles,
    sources,
    shelves,
    meta,
  }: {
    sourceId: string;
    articles: PublicArticleSummaryLike[];
    sources: PublicSourceSummaryLike[];
    shelves: PublicShelfSummaryLike[];
    meta: PublicMetaLike;
  }): SourcePageViewModel {
    const navigationItems = buildSourceNavigationItems(sources, {
      selectedSourceId: sourceId,
      hrefBuilder: buildSourceHrefFromSourcePage,
    });
    const selectedSource =
      sources.find((source) => source.id === sourceId) || null;
    const generatedAtText =
      meta && meta.generatedAt
        ? `${formatDateTime(meta.generatedAt)} 更新`
        : '更新時刻不明';

    if (!sourceId) {
      return {
        kind: 'missing-source',
        generatedAtText,
        navigationItems,
        relatedShelves: [],
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
        generatedAtText,
        navigationItems,
        relatedShelves: [],
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
    const relatedShelves = buildCategoryNavigationItems(
      shelves
        .filter((shelf) =>
          Array.isArray(selectedSource.shelfIds)
            ? selectedSource.shelfIds.includes(shelf.id)
            : selectedSource.categoryId
              ? shelf.id === selectedSource.categoryId
              : shelf.title === selectedSource.categoryLabel,
        )
        .map((shelf) => ({
          id: shelf.id,
          label: shelf.title,
          articleCount: shelf.articleCount,
          latestSortAt: shelf.latestSortAt || '',
        })),
      {
        hrefBuilder: buildShelfHrefFromSourcePage,
      },
    );
    const descriptionParts = [
      selectedSource.language,
      Array.isArray(selectedSource.tags) && selectedSource.tags.length > 0
        ? `タグ: ${selectedSource.tags.join(' / ')}`
        : '',
    ].filter(Boolean);
    const description =
      descriptionParts.length > 0
        ? `${selectedSource.name} (${descriptionParts.join(' / ')}) の記事だけを新着順で表示しています。関連する棚から一覧へ戻れます。`
        : `${selectedSource.name} の記事だけを新着順で表示しています。関連する棚から一覧へ戻れます。`;

    return {
      kind: selectedArticles.length === 0 ? 'empty-source' : 'ready',
      generatedAtText,
      navigationItems,
      relatedShelves,
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
        title: 'カテゴリ互換一覧から選択してください',
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
        title: 'カテゴリ互換導線でカテゴリが見つかりません',
        description: UNKNOWN_CATEGORY_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: UNKNOWN_CATEGORY_MESSAGE,
      };
    }

    const selectedArticles = articles.filter((article) =>
      Array.isArray(article.shelfIds)
        ? article.shelfIds.includes(selectedCategory.id)
        : article.categoryId === selectedCategory.id,
    );

    return {
      kind: selectedArticles.length === 0 ? 'empty-category' : 'ready',
      generatedAtText:
        meta && meta.generatedAt
          ? `${formatDateTime(meta.generatedAt)} 更新`
          : '更新時刻不明',
      navigationItems,
      title: `${selectedCategory.label} の記事一覧`,
      description: `${selectedCategory.label} の legacy category deep link を compatibility route で表示しています。必要に応じて棚・タグ・検索へ戻って探し直せます。`,
      articlesCountText: `${selectedArticles.length} 件`,
      articles: buildArticleViewModels(selectedArticles),
      statusMessage:
        selectedArticles.length === 0 ? EMPTY_CATEGORY_ARTICLES_MESSAGE : '',
      selectedCategoryLabel: selectedCategory.label,
    };
  }

  function articleHasTag(
    article: PublicArticleSummaryLike,
    tagLabel: string,
  ): boolean {
    const compareKey = normalizeTagCompareKey(tagLabel);
    if (!compareKey) {
      return false;
    }

    return [...(article.sourceTags || []), ...(article.entryTags || [])].some(
      (candidate) => normalizeTagCompareKey(candidate) === compareKey,
    );
  }

  function buildTagPageViewModel({
    tagId,
    articles,
    tags,
    meta,
  }: {
    tagId: string;
    articles: PublicArticleSummaryLike[];
    tags: PublicTagSummaryLike[];
    meta: PublicMetaLike;
  }): TagPageViewModel {
    const navigationItems = buildTagNavigationItems(tags, {
      selectedTagId: tagId,
      hrefBuilder: buildTagHrefFromTagPage,
    });
    const selectedTag = tags.find((tag) => tag.id === tagId) || null;
    const generatedAtText =
      meta && meta.generatedAt
        ? `${formatDateTime(meta.generatedAt)} 更新`
        : '更新時刻不明';

    if (!tagId) {
      return {
        kind: 'missing-tag',
        generatedAtText,
        navigationItems,
        title: 'タグを選択してください',
        description: MISSING_TAG_SELECTION_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: MISSING_TAG_SELECTION_MESSAGE,
      };
    }

    if (!selectedTag) {
      return {
        kind: 'unknown-tag',
        generatedAtText,
        navigationItems,
        title: 'タグが見つかりません',
        description: UNKNOWN_TAG_MESSAGE,
        articlesCountText: '0 件',
        articles: [],
        statusMessage: UNKNOWN_TAG_MESSAGE,
      };
    }

    const selectedArticles = articles.filter((article) =>
      articleHasTag(article, selectedTag.label),
    );

    return {
      kind: selectedArticles.length === 0 ? 'empty-tag' : 'ready',
      generatedAtText,
      navigationItems,
      title: `${selectedTag.label} の記事一覧`,
      description: `${selectedTag.label} に関連する記事を新着順で表示しています。sourceTags と entryTags の両方を統合した導線です。`,
      articlesCountText: `${selectedArticles.length} 件`,
      articles: buildArticleViewModels(selectedArticles),
      statusMessage:
        selectedArticles.length === 0 ? EMPTY_TAG_ARTICLES_MESSAGE : '',
      selectedTagLabel: selectedTag.label,
    };
  }

  function buildSearchPageViewModel({
    query,
    articles,
    searchIndex,
    meta,
  }: {
    query: string;
    articles: PublicArticleSummaryLike[];
    searchIndex: PublicSearchIndexEntryLike[];
    meta: PublicMetaLike;
  }): SearchPageViewModel {
    const generatedAtText =
      meta && meta.generatedAt
        ? `${formatDateTime(meta.generatedAt)} 更新`
        : '更新時刻不明';
    const normalizedQuery = normalizeSearchCompareText(query);
    const queryValue = normalizeWhitespace(query || '');

    if (normalizedQuery === '') {
      return {
        kind: 'missing-query',
        generatedAtText,
        title: '横断検索で探す',
        description:
          'タイトル・媒体名・タグ名から探したい語を入力すると、検索 index から最近の記事へ辿れます。',
        articlesCountText: '0 件',
        articles: [],
        statusMessage:
          `${MISSING_SEARCH_QUERY_MESSAGE} ${SEARCH_RANKING_HINT}`.trim(),
        queryValue,
      };
    }

    const articleMap = new Map<string, PublicArticleSummaryLike>(
      articles.map((article) => [article.id, article]),
    );
    const matches = searchIndex
      .map((entry) => ({
        entry,
        article: articleMap.get(entry.articleId) || null,
        score: scoreSearchEntry(entry, normalizedQuery),
      }))
      .filter(
        (
          candidate,
        ): candidate is {
          entry: PublicSearchIndexEntryLike;
          article: PublicArticleSummaryLike;
          score: number;
        } => Boolean(candidate.article) && candidate.score > 0,
      )
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score;
        }

        const timeOrder = compareByNewestTime(
          left.entry.sortAt || left.article.sortAt,
          right.entry.sortAt || right.article.sortAt,
        );
        if (timeOrder !== 0) {
          return timeOrder;
        }

        const titleOrder = left.article.title.localeCompare(
          right.article.title,
          'en',
        );
        if (titleOrder !== 0) {
          return titleOrder;
        }

        return left.article.id.localeCompare(right.article.id, 'en');
      });

    if (matches.length === 0) {
      return {
        kind: 'no-results',
        generatedAtText,
        title: `「${queryValue}」の検索結果`,
        description:
          'タイトル・媒体名・タグ名を横断検索しましたが、一致する記事は見つかりませんでした。',
        articlesCountText: '0 件',
        articles: [],
        statusMessage:
          `${EMPTY_SEARCH_RESULTS_MESSAGE} ${SEARCH_RANKING_HINT}`.trim(),
        queryValue,
      };
    }

    return {
      kind: 'ready',
      generatedAtText,
      title: `「${queryValue}」の検索結果`,
      description: `title / sourceName / tags を対象に横断検索し、score 順で記事を表示しています。${SEARCH_RANKING_HINT}`,
      articlesCountText: `${matches.length} 件`,
      articles: buildArticleViewModels(
        matches.map((candidate) => candidate.article),
      ),
      statusMessage: '',
      queryValue,
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
      <span class="chip__label">${escapeHtml(category.label)}</span>
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

  function renderShelfCards(shelves: ShelfCardViewModel[]): string {
    if (shelves.length === 0) {
      return '<p class="placeholder-text">棚はまだありません。</p>';
    }

    return shelves
      .map(
        (shelf) => `
          <article class="shelf-card">
            <div class="shelf-card__meta">
              <span class="meta-pill">${escapeHtml(shelf.countLabel)}</span>
              <span class="meta-pill">${escapeHtml(shelf.sourceCountLabel)}</span>
            </div>
            <div class="shelf-card__body">
              <h3>${escapeHtml(shelf.title)}</h3>
              <p class="muted">${escapeHtml(shelf.description)}</p>
            </div>
            <div class="shelf-card__footer">
              <span class="muted">${escapeHtml(shelf.freshnessLabel)}</span>
              ${
                shelf.href
                  ? `<a class="article-card__link" href="${escapeHtml(shelf.href)}">棚を開く</a>`
                  : '<span class="article-card__link article-card__link--disabled" aria-disabled="true">準備中</span>'
              }
            </div>
          </article>
        `,
      )
      .join('');
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
      <span class="source-pill__label">${escapeHtml(source.name)}</span>
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
        const categoryMetaMarkup = article.categoryLabel
          ? `<span class="meta-pill meta-pill--category">${escapeHtml(article.categoryLabel)}</span>`
          : '';
        const visibleTagsMarkup =
          article.visibleTags.length > 0
            ? `
                <div class="article-card__tags" aria-label="記事タグ">
                  ${article.visibleTags
                    .map(
                      (tag) =>
                        `<span class="chip chip--muted">${escapeHtml(tag)}</span>`,
                    )
                    .join('')}
                </div>
              `
            : '';

        return `
          <li class="article-card ${article.imageUrl ? 'article-card--with-image' : ''}">
            <article class="article-card__content">
              <div class="article-card__meta">
                ${categoryMetaMarkup}
                <span class="meta-pill">${escapeHtml(article.sourceName)}</span>
                <span class="meta-pill">${escapeHtml(article.publishedAtLabel)}</span>
              </div>
              <h3 class="article-card__title">
                ${articleTitleMarkup}
              </h3>
              ${visibleTagsMarkup}
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

  function buildShelfHrefFromHome(shelfId: string): string {
    return `./${encodeURIComponent(shelfId)}/`;
  }

  function buildShelfHrefFromShelfPage(shelfId: string): string {
    return `../${encodeURIComponent(shelfId)}/`;
  }

  function buildShelfHrefFromSourcePage(shelfId: string): string {
    return `../${encodeURIComponent(shelfId)}/`;
  }

  function buildCategoryHrefFromHome(categoryId: string): string {
    return `./categories/?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
  }

  function buildCategoryHrefFromCategoryPage(categoryId: string): string {
    return `./?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
  }

  function buildCategoryHrefFromSourcePage(categoryId: string): string {
    return `../categories/?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
  }

  function buildTagHrefFromHome(tagId: string): string {
    return `./tags/?${TAG_QUERY_PARAM}=${encodeURIComponent(tagId)}`;
  }

  function buildTagHrefFromTagPage(tagId: string): string {
    return `./?${TAG_QUERY_PARAM}=${encodeURIComponent(tagId)}`;
  }

  function buildSourceHrefFromHome(sourceId: string): string {
    return `./sources/?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
  }

  function buildSourceHrefFromSourcePage(sourceId: string): string {
    return `./?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
  }

  function buildSourceHrefFromShelfPage(sourceId: string): string {
    return `../sources/?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
  }

  function buildSearchHrefFromHome(query: string): string {
    return `./search/?${SEARCH_QUERY_PARAM}=${encodeURIComponent(query)}`;
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

  function getShelfIdFromDocument(
    documentRef: Document | null | undefined = browserScope.document,
  ): string {
    if (!documentRef || !documentRef.body) {
      return '';
    }

    return documentRef.body.dataset.shelfId || '';
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

  function getTagIdFromLocation(
    locationRef: LocationLike | null | undefined = browserScope.location,
  ): string {
    if (!locationRef || typeof locationRef.search !== 'string') {
      return '';
    }

    const params = new URLSearchParams(locationRef.search);
    return params.get(TAG_QUERY_PARAM) || '';
  }

  function getSearchQueryFromLocation(
    locationRef: LocationLike | null | undefined = browserScope.location,
  ): string {
    if (!locationRef || typeof locationRef.search !== 'string') {
      return '';
    }

    const params = new URLSearchParams(locationRef.search);
    return params.get(SEARCH_QUERY_PARAM) || '';
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
    const shelvesElement = documentRef.getElementById('shelves-list');
    const tagsElement = documentRef.getElementById('tags-list');
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

    if (shelvesElement) {
      shelvesElement.innerHTML = renderShelfCards(viewModel.shelves);
    }

    if (tagsElement) {
      tagsElement.innerHTML = renderChipItems(viewModel.tags);
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

  function renderShelfPage(
    documentRef: Document,
    payload: ReadyPayload,
    { shelfId }: { shelfId?: string } = {},
  ): ShelfPageViewModel {
    const viewModel = buildShelfPageViewModel({
      shelfId: shelfId || '',
      articles: payload.articles,
      shelves: payload.shelves,
      sources: payload.sources,
      meta: payload.meta,
    });
    const generatedAtElement = documentRef.getElementById('generated-at');
    const navElement = documentRef.getElementById('shelf-nav');
    const relatedSourcesElement = documentRef.getElementById('related-sources');
    const titleElement = documentRef.getElementById('shelf-page-title');
    const descriptionElement = documentRef.getElementById(
      'shelf-page-description',
    );
    const featuredCountElement = documentRef.getElementById('featured-count');
    const featuredListElement = documentRef.getElementById('featured-list');
    const articlesCountElement = documentRef.getElementById('articles-count');
    const statusElement = documentRef.getElementById('articles-status');
    const listElement = documentRef.getElementById('articles-list');

    if (generatedAtElement) {
      generatedAtElement.textContent = viewModel.generatedAtText;
    }

    if (navElement) {
      navElement.innerHTML = renderChipItems(viewModel.navigationItems);
    }

    if (relatedSourcesElement) {
      relatedSourcesElement.innerHTML = renderSourceItems(
        viewModel.relatedSources,
      );
    }

    if (titleElement) {
      titleElement.textContent = viewModel.title;
    }

    if (descriptionElement) {
      descriptionElement.textContent = viewModel.description;
    }

    if (featuredCountElement) {
      featuredCountElement.textContent = viewModel.featuredCountText;
    }

    if (featuredListElement) {
      featuredListElement.innerHTML =
        viewModel.featuredArticles.length > 0
          ? renderArticleItems(viewModel.featuredArticles)
          : '<li class="placeholder-text">注目記事はまだありません。</li>';
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
      shelves: payload.shelves,
      meta: payload.meta,
    });
    const generatedAtElement = documentRef.getElementById('generated-at');
    const navElement = documentRef.getElementById('source-nav');
    const relatedShelvesElement = documentRef.getElementById('related-shelves');
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

    if (relatedShelvesElement) {
      relatedShelvesElement.innerHTML = renderChipItems(
        viewModel.relatedShelves,
      );
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

  function renderTagPage(
    documentRef: Document,
    payload: ReadyPayload,
    { tagId }: { tagId?: string } = {},
  ): TagPageViewModel {
    const viewModel = buildTagPageViewModel({
      tagId: tagId || '',
      articles: payload.articles,
      tags: payload.tags,
      meta: payload.meta,
    });
    const generatedAtElement = documentRef.getElementById('generated-at');
    const navElement = documentRef.getElementById('tag-nav');
    const titleElement = documentRef.getElementById('tag-page-title');
    const descriptionElement = documentRef.getElementById(
      'tag-page-description',
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

  function renderSearchPage(
    documentRef: Document,
    payload: SearchReadyPayload,
    { query }: { query?: string } = {},
  ): SearchPageViewModel {
    const viewModel = buildSearchPageViewModel({
      query: query || '',
      articles: payload.articles,
      searchIndex: payload.searchIndex,
      meta: payload.meta,
    });
    const generatedAtElement = documentRef.getElementById('generated-at');
    const titleElement = documentRef.getElementById('search-page-title');
    const descriptionElement = documentRef.getElementById(
      'search-page-description',
    );
    const articlesCountElement = documentRef.getElementById('articles-count');
    const statusElement = documentRef.getElementById('articles-status');
    const listElement = documentRef.getElementById('articles-list');
    const inputElement = documentRef.getElementById(
      'search-query-input',
    ) as HTMLInputElement | null;

    if (generatedAtElement) {
      generatedAtElement.textContent = viewModel.generatedAtText;
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

    if (inputElement) {
      inputElement.value = viewModel.queryValue;
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

  async function initShelfPage({
    basePath = '..',
    fetchImpl = browserScope.fetch,
    documentRef = browserScope.document,
  }: HomePageInitOptions = {}): Promise<
    ShelfPageViewModel | MissingDataPayload | ErrorPayload | { kind: 'skipped' }
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
      return renderShelfPage(documentRef, payload, {
        shelfId: getShelfIdFromDocument(documentRef),
      });
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

  async function initTagPage({
    basePath = '..',
    fetchImpl = browserScope.fetch,
    documentRef = browserScope.document,
    locationRef = browserScope.location,
  }: SourcePageInitOptions = {}): Promise<
    TagPageViewModel | MissingDataPayload | ErrorPayload | { kind: 'skipped' }
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
      return renderTagPage(documentRef, payload, {
        tagId: getTagIdFromLocation(locationRef),
      });
    }

    setStatus(documentRef, {
      kind: payload.kind === 'missing-data' ? 'warning' : 'error',
      message: payload.message,
    });
    return payload;
  }

  async function initSearchPage({
    basePath = '..',
    fetchImpl = browserScope.fetch,
    documentRef = browserScope.document,
    locationRef = browserScope.location,
  }: SearchPageInitOptions = {}): Promise<
    | SearchPageViewModel
    | MissingDataPayload
    | ErrorPayload
    | { kind: 'skipped' }
  > {
    if (!documentRef) {
      return { kind: 'skipped' };
    }

    setStatus(documentRef, {
      kind: 'loading',
      message: '検索 index を読み込んでいます…',
    });

    const payload = await loadSearchPageData({ basePath, fetchImpl });

    if (payload.kind === 'ready') {
      return renderSearchPage(documentRef, payload, {
        query: getSearchQueryFromLocation(locationRef),
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
    EMPTY_SHELF_ARTICLES_MESSAGE,
    MISSING_CATEGORY_SELECTION_MESSAGE,
    MISSING_PUBLIC_DATA_ERROR,
    MISSING_SHELF_SELECTION_MESSAGE,
    MISSING_SOURCE_SELECTION_MESSAGE,
    INVALID_ARTICLE_LINK_LABEL,
    MISSING_SUMMARY_LABEL,
    SOURCE_QUERY_PARAM,
    UNKNOWN_CATEGORY_MESSAGE,
    UNKNOWN_PUBLISHED_AT_LABEL,
    UNKNOWN_SHELF_MESSAGE,
    UNKNOWN_SOURCE_MESSAGE,
    buildArticleViewModels,
    buildCategoryHrefFromCategoryPage,
    buildCategoryHrefFromHome,
    buildCategoryHrefFromSourcePage,
    buildCategoryNavigationItems,
    buildCategoryPageViewModel,
    buildShelfCards,
    buildShelfHrefFromHome,
    buildShelfHrefFromShelfPage,
    buildShelfHrefFromSourcePage,
    buildShelfNavigationItems,
    buildShelfPageViewModel,
    buildSourceHrefFromHome,
    buildSourceHrefFromShelfPage,
    buildSourceHrefFromSourcePage,
    buildSourceNavigationItems,
    buildSourcePageViewModel,
    buildSearchHrefFromHome,
    buildSearchPageViewModel,
    buildDataPaths,
    buildHomePageViewModel,
    normalizeExternalArticleUrl,
    describeLoadError,
    escapeHtml,
    formatCount,
    formatDateTime,
    getCategoryIdFromLocation,
    getShelfIdFromDocument,
    getSourceIdFromLocation,
    getSearchQueryFromLocation,
    initCategoryPage,
    initHomePage,
    initShelfPage,
    initSearchPage,
    initSourcePage,
    loadHomePageData,
    loadSearchPageData,
    renderArticleItems,
    renderCategoryPage,
    renderChipItems,
    renderHomePage,
    renderShelfCards,
    renderShelfPage,
    renderSourceItems,
    renderSourcePage,
    renderStats,
    setStatus,
    EMPTY_SOURCE_ARTICLES_MESSAGE,
    EMPTY_TAG_ARTICLES_MESSAGE,
    MISSING_TAG_SELECTION_MESSAGE,
    TAG_QUERY_PARAM,
    UNKNOWN_TAG_MESSAGE,
    MISSING_SEARCH_QUERY_MESSAGE,
    EMPTY_SEARCH_RESULTS_MESSAGE,
    SEARCH_QUERY_PARAM,
    SEARCH_RANKING_HINT,
    articleHasTag,
    buildTagHrefFromHome,
    buildTagHrefFromTagPage,
    buildTagNavigationItems,
    buildTagPageViewModel,
    getTagIdFromLocation,
    initTagPage,
    normalizeSearchCompareText,
    renderSearchPage,
    renderTagPage,
    scoreSearchEntry,
    tokenizeSearchQuery,
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
      const pageType = browserScope.document.body?.dataset.feedshelfPage || '';
      const isCategoryPage = /\/categories\/(?:index\.html)?$/u.test(pathname);
      const isSourcePage = /\/sources\/(?:index\.html)?$/u.test(pathname);
      const isTagPage = /\/tags\/(?:index\.html)?$/u.test(pathname);
      const isSearchPage = /\/search\/(?:index\.html)?$/u.test(pathname);
      const initializer =
        pageType === 'shelf'
          ? initShelfPage
          : isCategoryPage
            ? initCategoryPage
            : isSourcePage
              ? initSourcePage
              : isTagPage
                ? initTagPage
                : isSearchPage
                  ? initSearchPage
                  : initHomePage;

      initializer().catch((error: unknown) => {
        console.error('[feedshelf] failed to initialize page', error);
      });
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
