"use strict";
((globalScope) => {
    const browserScope = globalScope;
    const commonJsModule = (() => {
        try {
            return eval('typeof module !== "undefined" ? module : undefined');
        }
        catch {
            return undefined;
        }
    })();
    const DEFAULT_BASE_PATH = '.';
    const MISSING_SUMMARY_LABEL = '要約はありません。';
    const UNKNOWN_PUBLISHED_AT_LABEL = '公開日時不明';
    const GENERIC_LOAD_ERROR = '公開データの読み込みに失敗しました。GitHub Pages または静的サーバー経由で開いているか確認してください。';
    const FILE_PROTOCOL_ERROR = 'file:// 直開きでは JSON を読み込めない場合があります。静的サーバー経由で開いてください。';
    const MISSING_PUBLIC_DATA_ERROR = '公開データがまだ生成されていません。先に `pnpm run pipeline:update` を実行して `public/data/*.json` を作成してください。';
    const CATEGORY_QUERY_PARAM = 'id';
    const MISSING_CATEGORY_SELECTION_MESSAGE = 'カテゴリが選択されていません。compatibility route 上の一覧から選ぶか、棚カタログ・タグ・検索から探し直してください。';
    const UNKNOWN_CATEGORY_MESSAGE = '指定されたカテゴリは見つかりませんでした。棚カタログへ戻るか、別のカテゴリを選んでください。';
    const EMPTY_CATEGORY_ARTICLES_MESSAGE = 'このカテゴリの記事はまだありません。次回の生成を待つか、棚・タグ・媒体ページから別の導線を試してください。';
    const MISSING_SHELF_SELECTION_MESSAGE = '棚 route が特定できませんでした。トップの棚カタログから入り直してください。';
    const UNKNOWN_SHELF_MESSAGE = '指定された棚は見つかりませんでした。棚カタログへ戻るか、別の棚を選んでください。';
    const EMPTY_SHELF_ARTICLES_MESSAGE = 'この棚の記事はまだありません。次回の生成を待つか、タグ・媒体・検索から別の導線を試してください。';
    const SOURCE_QUERY_PARAM = 'id';
    const TAG_QUERY_PARAM = 'id';
    const SEARCH_QUERY_PARAM = 'q';
    const PAGE_QUERY_PARAM = 'page';
    const BOOTSTRAP_SCRIPT_ID = 'feedshelf-bootstrap';
    const DEFAULT_ARTICLE_PAGE_SIZE = 24;
    const MISSING_SOURCE_SELECTION_MESSAGE = '媒体が選択されていません。トップページまたは媒体一覧から選んでください。';
    const UNKNOWN_SOURCE_MESSAGE = '指定された媒体は見つかりませんでした。別の媒体を選んでください。';
    const EMPTY_SOURCE_ARTICLES_MESSAGE = 'この媒体の記事はまだありません。次回の生成を待つか、別の媒体を選んでください。';
    const MISSING_TAG_SELECTION_MESSAGE = 'タグが選択されていません。トップページまたはタグ一覧から選んでください。';
    const UNKNOWN_TAG_MESSAGE = '指定されたタグは見つかりませんでした。別のタグを選んでください。';
    const EMPTY_TAG_ARTICLES_MESSAGE = 'このタグの記事はまだありません。別のタグを選ぶか、次回の生成を待ってください。';
    const MISSING_SEARCH_QUERY_MESSAGE = '検索語がまだ入力されていません。タイトル・媒体名・タグ名から探したい語を入力してください。';
    const EMPTY_SEARCH_RESULTS_MESSAGE = '一致する記事が見つかりませんでした。語句を減らすか、タグ・媒体ページから探し直してください。';
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
    function readBootstrapPayload(documentRef) {
        if (!documentRef) {
            return null;
        }
        const element = documentRef.getElementById(BOOTSTRAP_SCRIPT_ID);
        if (!element || !element.textContent) {
            return null;
        }
        try {
            return JSON.parse(element.textContent);
        }
        catch {
            return null;
        }
    }
    function getPageFromLocation(locationRef) {
        const search = locationRef && typeof locationRef.search === 'string'
            ? locationRef.search
            : '';
        const value = new URLSearchParams(search).get(PAGE_QUERY_PARAM) || '';
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
    }
    function buildPaginationHref({ page, selectedTagId = '', }) {
        const params = new URLSearchParams();
        if (selectedTagId) {
            params.set(TAG_QUERY_PARAM, selectedTagId);
        }
        if (page > 1) {
            params.set(PAGE_QUERY_PARAM, String(page));
        }
        const query = params.toString();
        return query === '' ? './' : `./?${query}`;
    }
    function renderPaginationItems({ currentPage, totalPages, selectedTagId = '', }) {
        if (totalPages <= 1) {
            return '';
        }
        return Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            const className = page === currentPage ? 'chip chip--selected' : 'chip chip--muted';
            return `<a class="${className}" href="${buildPaginationHref({ page, selectedTagId })}">Page ${page}</a>`;
        }).join('');
    }
    function renderPaginationNav(documentRef, { currentPage, totalPages, selectedTagId = '', }) {
        const navElement = documentRef.getElementById('articles-pagination');
        if (!navElement) {
            return;
        }
        if (totalPages <= 1) {
            navElement.hidden = true;
            navElement.innerHTML = '';
            return;
        }
        navElement.hidden = false;
        navElement.innerHTML = renderPaginationItems({
            currentPage,
            totalPages,
            selectedTagId,
        });
    }
    function buildPageShardPath({ basePath, routeKind, page, shelfId = '', tagId = '', }) {
        const trimmed = String(basePath).replace(/\/+$/u, '') || '.';
        const prefix = trimmed === '.' ? './data/pages' : `${trimmed}/data/pages`;
        if (routeKind === 'home') {
            return `${prefix}/home/page-${page}.json`;
        }
        if (routeKind === 'shelf') {
            return `${prefix}/shelves/${encodeURIComponent(shelfId)}/page-${page}.json`;
        }
        return `${prefix}/tags/${encodeURIComponent(tagId)}/page-${page}.json`;
    }
    async function loadArticlePageShard({ basePath, routeKind, page, fetchImpl, shelfId = '', tagId = '', }) {
        return fetchJson(fetchImpl, buildPageShardPath({
            basePath,
            routeKind,
            page,
            shelfId,
            tagId,
        }));
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
    async function loadHomePageData({ basePath = DEFAULT_BASE_PATH, fetchImpl = browserScope.fetch, } = {}) {
        const paths = buildDataPaths(basePath);
        try {
            const [articles, shelvesResult, categories, sources, tags, meta] = await Promise.all([
                fetchJson(fetchImpl, paths.articles),
                fetchJson(fetchImpl, paths.shelves).catch(() => []),
                fetchJson(fetchImpl, paths.categories),
                fetchJson(fetchImpl, paths.sources),
                fetchJson(fetchImpl, paths.tags),
                fetchJson(fetchImpl, paths.meta),
            ]);
            const parsedCategories = Array.isArray(categories)
                ? categories
                : [];
            const parsedShelves = Array.isArray(shelvesResult) && shelvesResult.length > 0
                ? shelvesResult
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
                    ? articles
                    : [],
                shelves: parsedShelves,
                categories: parsedCategories,
                sources: Array.isArray(sources)
                    ? sources
                    : [],
                tags: Array.isArray(tags) ? tags : [],
                meta: meta && typeof meta === 'object' ? meta : {},
            };
        }
        catch (error) {
            if (error &&
                typeof error === 'object' &&
                'status' in error &&
                error.status === 404) {
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
    async function loadSearchPageData({ basePath = DEFAULT_BASE_PATH, fetchImpl = browserScope.fetch, } = {}) {
        const payload = await loadHomePageData({ basePath, fetchImpl });
        if (payload.kind !== 'ready') {
            return payload;
        }
        const paths = buildDataPaths(basePath);
        try {
            const searchIndex = await fetchJson(fetchImpl, paths.searchIndex);
            return {
                ...payload,
                searchIndex: Array.isArray(searchIndex)
                    ? searchIndex
                    : [],
            };
        }
        catch (error) {
            if (error &&
                typeof error === 'object' &&
                'status' in error &&
                error.status === 404) {
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
        if (browserScope.location &&
            typeof browserScope.location.protocol === 'string' &&
            browserScope.location.protocol === 'file:') {
            return FILE_PROTOCOL_ERROR;
        }
        if (error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string' &&
            error.message.trim() !== '') {
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
    function toComparableTime(value) {
        if (!value) {
            return Number.NEGATIVE_INFINITY;
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
            ? Number.NEGATIVE_INFINITY
            : parsed.getTime();
    }
    function compareByNewestTime(left, right) {
        const leftTime = toComparableTime(left);
        const rightTime = toComparableTime(right);
        if (leftTime !== rightTime) {
            return rightTime - leftTime;
        }
        return 0;
    }
    function buildHomePageViewModel({ articles, shelves, sources, tags, meta, }) {
        return {
            generatedAtText: meta && meta.generatedAt
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
    function normalizeWhitespace(value) {
        return String(value).replace(/\s+/gu, ' ').trim();
    }
    function normalizeTagCompareKey(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return normalizeWhitespace(value.normalize('NFKC')).toLocaleLowerCase('en-US');
    }
    function normalizeSearchCompareText(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return normalizeWhitespace(value.normalize('NFKC')).toLocaleLowerCase('en-US');
    }
    function tokenizeSearchQuery(value) {
        const normalized = normalizeSearchCompareText(value);
        return normalized === '' ? [] : normalized.split(' ');
    }
    function buildSearchEntryFields(entry) {
        const sourceTags = Array.isArray(entry.sourceTags) ? entry.sourceTags : [];
        const entryTags = Array.isArray(entry.entryTags) ? entry.entryTags : [];
        const tagLabels = uniqueLabels([...sourceTags, ...entryTags]);
        const titleText = entry.titleText || normalizeSearchCompareText(entry.title || '');
        const sourceText = entry.sourceText || normalizeSearchCompareText(entry.sourceName || '');
        const tagText = entry.tagText || normalizeSearchCompareText(tagLabels.join(' '));
        const searchText = entry.searchText ||
            normalizeSearchCompareText([entry.title || '', entry.sourceName || '', ...tagLabels].join(' '));
        return {
            titleText,
            sourceText,
            tagText,
            searchText,
        };
    }
    function scoreSearchEntry(entry, query) {
        const normalizedQuery = normalizeSearchCompareText(query);
        const terms = tokenizeSearchQuery(normalizedQuery);
        if (terms.length === 0) {
            return 0;
        }
        const { titleText, sourceText, tagText, searchText } = buildSearchEntryFields(entry);
        for (const term of terms) {
            if (!searchText.includes(term)) {
                return 0;
            }
        }
        let score = 0;
        if (normalizedQuery !== '') {
            if (titleText === normalizedQuery) {
                score += 1_000;
            }
            else if (titleText.includes(normalizedQuery)) {
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
    function uniqueLabels(values) {
        const seen = new Set();
        const result = [];
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
    function buildVisibleTags(article) {
        return uniqueLabels([
            ...(Array.isArray(article.entryTags) ? article.entryTags : []),
            ...(Array.isArray(article.sourceTags) ? article.sourceTags : []),
        ]).slice(0, 3);
    }
    function normalizeExternalArticleUrl(value) {
        if (typeof value !== 'string' || value.trim() === '') {
            return null;
        }
        try {
            const parsed = new URL(value);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return null;
            }
            return parsed.toString();
        }
        catch (_error) {
            return null;
        }
    }
    function buildArticleViewModels(articles) {
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
    function buildCategoryNavigationItems(categories, { selectedCategoryId = null, hrefBuilder = buildCategoryHrefFromHome, } = {}) {
        return categories.map((category) => ({
            id: category.id,
            label: category.label,
            countLabel: `${formatCount(category.articleCount)}件`,
            href: typeof hrefBuilder === 'function' ? hrefBuilder(category.id) : null,
            isSelected: selectedCategoryId === category.id,
        }));
    }
    function buildShelfCards({ shelves, }) {
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
    function buildSourceNavigationItems(sources, { selectedSourceId = null, hrefBuilder = buildSourceHrefFromHome, } = {}) {
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
    function buildTagNavigationItems(tags, { selectedTagId = null, hrefBuilder = buildTagHrefFromHome, } = {}) {
        return tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            countLabel: `${formatCount(tag.articleCount)}件`,
            href: typeof hrefBuilder === 'function' ? hrefBuilder(tag.id) : null,
            isSelected: selectedTagId === tag.id,
        }));
    }
    function buildShelfNavigationItems(shelves, { selectedShelfId = null, hrefBuilder = buildShelfHrefFromHome, } = {}) {
        return buildCategoryNavigationItems(shelves.map((shelf) => ({
            id: shelf.id,
            label: shelf.title,
            articleCount: shelf.articleCount,
            latestSortAt: shelf.latestSortAt || '',
        })), {
            selectedCategoryId: selectedShelfId,
            hrefBuilder,
        });
    }
    function buildShelfPageViewModel({ shelfId, articles, shelves, sources, meta, }) {
        const navigationItems = buildShelfNavigationItems(shelves, {
            selectedShelfId: shelfId,
            hrefBuilder: buildShelfHrefFromShelfPage,
        });
        const selectedShelf = shelves.find((shelf) => shelf.id === shelfId) || null;
        const generatedAtText = meta && meta.generatedAt
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
        const selectedArticles = articles.filter((article) => Array.isArray(article.shelfIds)
            ? article.shelfIds.includes(selectedShelf.id)
            : article.categoryId === selectedShelf.id);
        const featuredArticles = buildArticleViewModels(selectedArticles.slice(0, 3));
        const relatedSources = buildSourceNavigationItems(sources.filter((source) => Array.isArray(source.shelfIds)
            ? source.shelfIds.includes(selectedShelf.id)
            : source.categoryId === selectedShelf.id), {
            hrefBuilder: buildSourceHrefFromShelfPage,
        });
        const description = `${selectedShelf.description} 注目 ${formatCount(featuredArticles.length)} 件と新着 ${formatCount(selectedArticles.length)} 件、関連媒体 ${formatCount(selectedShelf.sourceCount)} 件をこの棚から辿れます。`;
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
            statusMessage: selectedArticles.length === 0 ? EMPTY_SHELF_ARTICLES_MESSAGE : '',
            selectedShelfTitle: selectedShelf.title,
        };
    }
    function buildSourcePageViewModel({ sourceId, articles, sources, shelves, meta, }) {
        const navigationItems = buildSourceNavigationItems(sources, {
            selectedSourceId: sourceId,
            hrefBuilder: buildSourceHrefFromSourcePage,
        });
        const selectedSource = sources.find((source) => source.id === sourceId) || null;
        const generatedAtText = meta && meta.generatedAt
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
        const selectedArticles = articles.filter((article) => article.sourceId === selectedSource.id);
        const relatedShelves = buildCategoryNavigationItems(shelves
            .filter((shelf) => Array.isArray(selectedSource.shelfIds)
            ? selectedSource.shelfIds.includes(shelf.id)
            : selectedSource.categoryId
                ? shelf.id === selectedSource.categoryId
                : shelf.title === selectedSource.categoryLabel)
            .map((shelf) => ({
            id: shelf.id,
            label: shelf.title,
            articleCount: shelf.articleCount,
            latestSortAt: shelf.latestSortAt || '',
        })), {
            hrefBuilder: buildShelfHrefFromSourcePage,
        });
        const descriptionParts = [
            selectedSource.language,
            Array.isArray(selectedSource.tags) && selectedSource.tags.length > 0
                ? `タグ: ${selectedSource.tags.join(' / ')}`
                : '',
        ].filter(Boolean);
        const description = descriptionParts.length > 0
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
            statusMessage: selectedArticles.length === 0 ? EMPTY_SOURCE_ARTICLES_MESSAGE : '',
            selectedSourceName: selectedSource.name,
        };
    }
    function buildCategoryPageViewModel({ categoryId, articles, categories, meta, }) {
        const navigationItems = buildCategoryNavigationItems(categories, {
            selectedCategoryId: categoryId,
            hrefBuilder: buildCategoryHrefFromCategoryPage,
        });
        const selectedCategory = categories.find((category) => category.id === categoryId) || null;
        if (!categoryId) {
            return {
                kind: 'missing-category',
                generatedAtText: meta && meta.generatedAt
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
                generatedAtText: meta && meta.generatedAt
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
        const selectedArticles = articles.filter((article) => Array.isArray(article.shelfIds)
            ? article.shelfIds.includes(selectedCategory.id)
            : article.categoryId === selectedCategory.id);
        return {
            kind: selectedArticles.length === 0 ? 'empty-category' : 'ready',
            generatedAtText: meta && meta.generatedAt
                ? `${formatDateTime(meta.generatedAt)} 更新`
                : '更新時刻不明',
            navigationItems,
            title: `${selectedCategory.label} の記事一覧`,
            description: `${selectedCategory.label} の legacy category deep link を compatibility route で表示しています。必要に応じて棚・タグ・検索へ戻って探し直せます。`,
            articlesCountText: `${selectedArticles.length} 件`,
            articles: buildArticleViewModels(selectedArticles),
            statusMessage: selectedArticles.length === 0 ? EMPTY_CATEGORY_ARTICLES_MESSAGE : '',
            selectedCategoryLabel: selectedCategory.label,
        };
    }
    function articleHasTag(article, tagLabel) {
        const compareKey = normalizeTagCompareKey(tagLabel);
        if (!compareKey) {
            return false;
        }
        return [...(article.sourceTags || []), ...(article.entryTags || [])].some((candidate) => normalizeTagCompareKey(candidate) === compareKey);
    }
    function buildTagPageViewModel({ tagId, articles, tags, meta, }) {
        const navigationItems = buildTagNavigationItems(tags, {
            selectedTagId: tagId,
            hrefBuilder: buildTagHrefFromTagPage,
        });
        const selectedTag = tags.find((tag) => tag.id === tagId) || null;
        const generatedAtText = meta && meta.generatedAt
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
        const selectedArticles = articles.filter((article) => articleHasTag(article, selectedTag.label));
        return {
            kind: selectedArticles.length === 0 ? 'empty-tag' : 'ready',
            generatedAtText,
            navigationItems,
            title: `${selectedTag.label} の記事一覧`,
            description: `${selectedTag.label} に関連する記事を新着順で表示しています。sourceTags と entryTags の両方を統合した導線です。`,
            articlesCountText: `${selectedArticles.length} 件`,
            articles: buildArticleViewModels(selectedArticles),
            statusMessage: selectedArticles.length === 0 ? EMPTY_TAG_ARTICLES_MESSAGE : '',
            selectedTagLabel: selectedTag.label,
        };
    }
    function buildSearchPageViewModel({ query, articles, searchIndex, meta, }) {
        const generatedAtText = meta && meta.generatedAt
            ? `${formatDateTime(meta.generatedAt)} 更新`
            : '更新時刻不明';
        const normalizedQuery = normalizeSearchCompareText(query);
        const queryValue = normalizeWhitespace(query || '');
        if (normalizedQuery === '') {
            return {
                kind: 'missing-query',
                generatedAtText,
                title: '横断検索で探す',
                description: 'タイトル・媒体名・タグ名から探したい語を入力すると、検索 index から最近の記事へ辿れます。',
                articlesCountText: '0 件',
                articles: [],
                statusMessage: `${MISSING_SEARCH_QUERY_MESSAGE} ${SEARCH_RANKING_HINT}`.trim(),
                queryValue,
            };
        }
        const articleMap = new Map(articles.map((article) => [article.id, article]));
        const matches = searchIndex
            .map((entry) => ({
            entry,
            article: articleMap.get(entry.articleId) || null,
            score: scoreSearchEntry(entry, normalizedQuery),
        }))
            .filter((candidate) => Boolean(candidate.article) && candidate.score > 0)
            .sort((left, right) => {
            if (left.score !== right.score) {
                return right.score - left.score;
            }
            const timeOrder = compareByNewestTime(left.entry.sortAt || left.article.sortAt, right.entry.sortAt || right.article.sortAt);
            if (timeOrder !== 0) {
                return timeOrder;
            }
            const titleOrder = left.article.title.localeCompare(right.article.title, 'en');
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
                description: 'タイトル・媒体名・タグ名を横断検索しましたが、一致する記事は見つかりませんでした。',
                articlesCountText: '0 件',
                articles: [],
                statusMessage: `${EMPTY_SEARCH_RESULTS_MESSAGE} ${SEARCH_RANKING_HINT}`.trim(),
                queryValue,
            };
        }
        return {
            kind: 'ready',
            generatedAtText,
            title: `「${queryValue}」の検索結果`,
            description: `title / sourceName / tags を対象に横断検索し、score 順で記事を表示しています。${SEARCH_RANKING_HINT}`,
            articlesCountText: `${matches.length} 件`,
            articles: buildArticleViewModels(matches.map((candidate) => candidate.article)),
            statusMessage: '',
            queryValue,
        };
    }
    function renderStats(stats) {
        return stats
            .map((stat) => `
          <div class="stat-card">
            <dt>${escapeHtml(stat.label)}</dt>
            <dd>${escapeHtml(stat.value)}</dd>
          </div>
        `)
            .join('');
    }
    function renderChipItems(categories) {
        if (categories.length === 0) {
            return '<p class="placeholder-text">カテゴリはまだありません。</p>';
        }
        return categories.map((category) => renderCategoryChip(category)).join('');
    }
    function renderCategoryChip(category) {
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
    function renderShelfCards(shelves) {
        if (shelves.length === 0) {
            return '<p class="placeholder-text">棚はまだありません。</p>';
        }
        return shelves
            .map((shelf) => `
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
              ${shelf.href
            ? `<a class="article-card__link" href="${escapeHtml(shelf.href)}">棚を開く</a>`
            : '<span class="article-card__link article-card__link--disabled" aria-disabled="true">準備中</span>'}
            </div>
          </article>
        `)
            .join('');
    }
    function renderSourceItems(sources) {
        if (sources.length === 0) {
            return '<p class="placeholder-text">媒体はまだありません。</p>';
        }
        return sources.map((source) => renderSourcePill(source)).join('');
    }
    function renderSourcePill(source) {
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
    function renderArticleItems(articles) {
        return articles
            .map((article) => {
            const safeArticleUrl = article.canOpenExternal === false
                ? null
                : normalizeExternalArticleUrl(article.url);
            const canOpenExternal = Boolean(safeArticleUrl);
            const externalLinkDescription = article.externalLinkDescription ||
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
            const visibleTagsMarkup = article.visibleTags.length > 0
                ? `
                <div class="article-card__tags" aria-label="記事タグ">
                  ${article.visibleTags
                    .map((tag) => `<span class="chip chip--muted">${escapeHtml(tag)}</span>`)
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
            ${article.imageUrl
                ? `<img class="article-card__image" src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy" />`
                : ''}
          </li>
        `;
        })
            .join('');
    }
    function buildShelfHrefFromHome(shelfId) {
        return `./${encodeURIComponent(shelfId)}/`;
    }
    function buildShelfHrefFromShelfPage(shelfId) {
        return `../${encodeURIComponent(shelfId)}/`;
    }
    function buildShelfHrefFromSourcePage(shelfId) {
        return `../${encodeURIComponent(shelfId)}/`;
    }
    function buildCategoryHrefFromHome(categoryId) {
        return `./categories/?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
    }
    function buildCategoryHrefFromCategoryPage(categoryId) {
        return `./?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
    }
    function buildCategoryHrefFromSourcePage(categoryId) {
        return `../categories/?${CATEGORY_QUERY_PARAM}=${encodeURIComponent(categoryId)}`;
    }
    function buildTagHrefFromHome(tagId) {
        return `./tags/?${TAG_QUERY_PARAM}=${encodeURIComponent(tagId)}`;
    }
    function buildTagHrefFromTagPage(tagId) {
        return `./?${TAG_QUERY_PARAM}=${encodeURIComponent(tagId)}`;
    }
    function buildSourceHrefFromHome(sourceId) {
        return `./sources/?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
    }
    function buildSourceHrefFromSourcePage(sourceId) {
        return `./?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
    }
    function buildSourceHrefFromShelfPage(sourceId) {
        return `../sources/?${SOURCE_QUERY_PARAM}=${encodeURIComponent(sourceId)}`;
    }
    function buildSearchHrefFromHome(query) {
        return `./search/?${SEARCH_QUERY_PARAM}=${encodeURIComponent(query)}`;
    }
    function getCategoryIdFromLocation(locationRef = browserScope.location) {
        if (!locationRef || typeof locationRef.search !== 'string') {
            return '';
        }
        const params = new URLSearchParams(locationRef.search);
        return params.get(CATEGORY_QUERY_PARAM) || '';
    }
    function getShelfIdFromDocument(documentRef = browserScope.document) {
        if (!documentRef || !documentRef.body) {
            return '';
        }
        return documentRef.body.dataset.shelfId || '';
    }
    function getSourceIdFromLocation(locationRef = browserScope.location) {
        if (!locationRef || typeof locationRef.search !== 'string') {
            return '';
        }
        const params = new URLSearchParams(locationRef.search);
        return params.get(SOURCE_QUERY_PARAM) || '';
    }
    function getTagIdFromLocation(locationRef = browserScope.location) {
        if (!locationRef || typeof locationRef.search !== 'string') {
            return '';
        }
        const params = new URLSearchParams(locationRef.search);
        return params.get(TAG_QUERY_PARAM) || '';
    }
    function getSearchQueryFromLocation(locationRef = browserScope.location) {
        if (!locationRef || typeof locationRef.search !== 'string') {
            return '';
        }
        const params = new URLSearchParams(locationRef.search);
        return params.get(SEARCH_QUERY_PARAM) || '';
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
    function renderHomePage(documentRef, payload, { articlePage = null, currentPage = 1, } = {}) {
        const viewModel = buildHomePageViewModel({
            ...payload,
            articles: articlePage ? articlePage.articles : payload.articles,
        });
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
            articlesCountElement.textContent = `${articlePage ? articlePage.totalItems : viewModel.articles.length} 件`;
        }
        renderPaginationNav(documentRef, {
            currentPage,
            totalPages: articlePage ? articlePage.totalPages : 1,
        });
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
    function renderShelfPage(documentRef, payload, { shelfId, articlePage = null, featuredArticles = null, relatedSources = null, currentPage = 1, } = {}) {
        const viewModel = buildShelfPageViewModel({
            shelfId: shelfId || '',
            articles: articlePage ? articlePage.articles : payload.articles,
            shelves: payload.shelves,
            sources: relatedSources || payload.sources,
            meta: payload.meta,
        });
        const generatedAtElement = documentRef.getElementById('generated-at');
        const navElement = documentRef.getElementById('shelf-nav');
        const relatedSourcesElement = documentRef.getElementById('related-sources');
        const titleElement = documentRef.getElementById('shelf-page-title');
        const descriptionElement = documentRef.getElementById('shelf-page-description');
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
            relatedSourcesElement.innerHTML = renderSourceItems(relatedSources
                ? buildSourceNavigationItems(relatedSources, {
                    hrefBuilder: buildSourceHrefFromShelfPage,
                })
                : viewModel.relatedSources);
        }
        if (titleElement) {
            titleElement.textContent = viewModel.title;
        }
        if (descriptionElement) {
            descriptionElement.textContent = viewModel.description;
        }
        const renderedFeaturedArticles = featuredArticles
            ? buildArticleViewModels(featuredArticles)
            : viewModel.featuredArticles;
        if (featuredCountElement) {
            featuredCountElement.textContent = `${renderedFeaturedArticles.length} 件`;
        }
        if (featuredListElement) {
            featuredListElement.innerHTML =
                renderedFeaturedArticles.length > 0
                    ? renderArticleItems(renderedFeaturedArticles)
                    : '<li class="placeholder-text">注目記事はまだありません。</li>';
        }
        if (articlesCountElement) {
            articlesCountElement.textContent = `${articlePage ? articlePage.totalItems : viewModel.articles.length} 件`;
        }
        renderPaginationNav(documentRef, {
            currentPage,
            totalPages: articlePage ? articlePage.totalPages : 1,
        });
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
    function renderCategoryPage(documentRef, payload, { categoryId } = {}) {
        const viewModel = buildCategoryPageViewModel({
            categoryId: categoryId || '',
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
    function renderSourcePage(documentRef, payload, { sourceId } = {}) {
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
        const descriptionElement = documentRef.getElementById('source-page-description');
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
            relatedShelvesElement.innerHTML = renderChipItems(viewModel.relatedShelves);
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
    function renderTagPage(documentRef, payload, { tagId, articlePage = null, currentPage = 1, } = {}) {
        const viewModel = buildTagPageViewModel({
            tagId: tagId || '',
            articles: articlePage ? articlePage.articles : payload.articles,
            tags: payload.tags,
            meta: payload.meta,
        });
        const generatedAtElement = documentRef.getElementById('generated-at');
        const navElement = documentRef.getElementById('tag-nav');
        const titleElement = documentRef.getElementById('tag-page-title');
        const descriptionElement = documentRef.getElementById('tag-page-description');
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
            articlesCountElement.textContent = `${articlePage ? articlePage.totalItems : viewModel.articles.length} 件`;
        }
        renderPaginationNav(documentRef, {
            currentPage,
            totalPages: articlePage ? articlePage.totalPages : 1,
            selectedTagId: tagId || '',
        });
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
    function renderSearchPage(documentRef, payload, { query } = {}) {
        const viewModel = buildSearchPageViewModel({
            query: query || '',
            articles: payload.articles,
            searchIndex: payload.searchIndex,
            meta: payload.meta,
        });
        const generatedAtElement = documentRef.getElementById('generated-at');
        const titleElement = documentRef.getElementById('search-page-title');
        const descriptionElement = documentRef.getElementById('search-page-description');
        const articlesCountElement = documentRef.getElementById('articles-count');
        const statusElement = documentRef.getElementById('articles-status');
        const listElement = documentRef.getElementById('articles-list');
        const inputElement = documentRef.getElementById('search-query-input');
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
    async function initHomePage({ basePath = DEFAULT_BASE_PATH, fetchImpl = browserScope.fetch, documentRef = browserScope.document, locationRef = browserScope.location, } = {}) {
        if (!documentRef) {
            return { kind: 'skipped' };
        }
        setStatus(documentRef, {
            kind: 'loading',
            message: '公開 JSON を読み込んでいます…',
        });
        const bootstrapPayload = readBootstrapPayload(documentRef);
        const requestedPage = getPageFromLocation(locationRef);
        if (bootstrapPayload && bootstrapPayload.kind === 'home') {
            const currentPage = Math.min(requestedPage, Math.max(1, bootstrapPayload.articlePage.totalPages || 1));
            const articlePage = currentPage === 1
                ? bootstrapPayload.articlePage
                : await loadArticlePageShard({
                    basePath,
                    routeKind: 'home',
                    page: currentPage,
                    fetchImpl,
                });
            const payload = {
                kind: 'ready',
                articles: articlePage.articles,
                shelves: bootstrapPayload.shelves,
                categories: [],
                sources: bootstrapPayload.sources,
                tags: bootstrapPayload.tags,
                meta: bootstrapPayload.meta,
            };
            renderHomePage(documentRef, payload, { articlePage, currentPage });
            return payload;
        }
        const payload = await loadHomePageData({ basePath, fetchImpl });
        if (payload.kind === 'ready') {
            renderHomePage(documentRef, payload, { currentPage: requestedPage });
            return payload;
        }
        setStatus(documentRef, {
            kind: payload.kind === 'missing-data' ? 'warning' : 'error',
            message: payload.message,
        });
        return payload;
    }
    async function initShelfPage({ basePath = '..', fetchImpl = browserScope.fetch, documentRef = browserScope.document, locationRef = browserScope.location, } = {}) {
        if (!documentRef) {
            return { kind: 'skipped' };
        }
        setStatus(documentRef, {
            kind: 'loading',
            message: '公開 JSON を読み込んでいます…',
        });
        const shelfId = getShelfIdFromDocument(documentRef);
        const requestedPage = getPageFromLocation(locationRef);
        const bootstrapPayload = readBootstrapPayload(documentRef);
        if (bootstrapPayload &&
            bootstrapPayload.kind === 'shelf' &&
            bootstrapPayload.shelfId === shelfId) {
            const currentPage = Math.min(requestedPage, Math.max(1, bootstrapPayload.articlePage.totalPages || 1));
            const articlePage = currentPage === 1
                ? bootstrapPayload.articlePage
                : await loadArticlePageShard({
                    basePath,
                    routeKind: 'shelf',
                    page: currentPage,
                    fetchImpl,
                    shelfId,
                });
            return renderShelfPage(documentRef, {
                kind: 'ready',
                articles: articlePage.articles,
                shelves: bootstrapPayload.shelves,
                categories: [],
                sources: bootstrapPayload.relatedSources,
                tags: [],
                meta: bootstrapPayload.meta,
            }, {
                shelfId,
                articlePage,
                featuredArticles: bootstrapPayload.featuredArticles,
                relatedSources: bootstrapPayload.relatedSources,
                currentPage,
            });
        }
        const payload = await loadHomePageData({ basePath, fetchImpl });
        if (payload.kind === 'ready') {
            return renderShelfPage(documentRef, payload, {
                shelfId,
                currentPage: requestedPage,
            });
        }
        setStatus(documentRef, {
            kind: payload.kind === 'missing-data' ? 'warning' : 'error',
            message: payload.message,
        });
        return payload;
    }
    async function initCategoryPage({ basePath = '..', fetchImpl = browserScope.fetch, documentRef = browserScope.document, locationRef = browserScope.location, } = {}) {
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
    async function initSourcePage({ basePath = '..', fetchImpl = browserScope.fetch, documentRef = browserScope.document, locationRef = browserScope.location, } = {}) {
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
    async function initTagPage({ basePath = '..', fetchImpl = browserScope.fetch, documentRef = browserScope.document, locationRef = browserScope.location, } = {}) {
        if (!documentRef) {
            return { kind: 'skipped' };
        }
        setStatus(documentRef, {
            kind: 'loading',
            message: '公開 JSON を読み込んでいます…',
        });
        const tagId = getTagIdFromLocation(locationRef);
        const requestedPage = getPageFromLocation(locationRef);
        const bootstrapPayload = readBootstrapPayload(documentRef);
        if (bootstrapPayload && bootstrapPayload.kind === 'tag-index') {
            const readyPayload = {
                kind: 'ready',
                articles: [],
                shelves: [],
                categories: [],
                sources: [],
                tags: bootstrapPayload.tags,
                meta: bootstrapPayload.meta,
            };
            const selectedTag = bootstrapPayload.tags.find((tag) => tag.id === tagId) || null;
            if (!tagId || !selectedTag) {
                return renderTagPage(documentRef, readyPayload, {
                    tagId,
                    currentPage: requestedPage,
                });
            }
            const currentPage = Math.min(requestedPage, Math.max(1, Math.ceil(selectedTag.articleCount / DEFAULT_ARTICLE_PAGE_SIZE)));
            const articlePage = await loadArticlePageShard({
                basePath,
                routeKind: 'tag',
                page: currentPage,
                fetchImpl,
                tagId,
            });
            return renderTagPage(documentRef, readyPayload, {
                tagId,
                articlePage,
                currentPage,
            });
        }
        const payload = await loadHomePageData({ basePath, fetchImpl });
        if (payload.kind === 'ready') {
            return renderTagPage(documentRef, payload, {
                tagId,
                currentPage: requestedPage,
            });
        }
        setStatus(documentRef, {
            kind: payload.kind === 'missing-data' ? 'warning' : 'error',
            message: payload.message,
        });
        return payload;
    }
    async function initSearchPage({ basePath = '..', fetchImpl = browserScope.fetch, documentRef = browserScope.document, locationRef = browserScope.location, } = {}) {
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
        PAGE_QUERY_PARAM,
        SEARCH_RANKING_HINT,
        articleHasTag,
        buildPaginationHref,
        buildTagHrefFromHome,
        buildTagHrefFromTagPage,
        buildTagNavigationItems,
        buildTagPageViewModel,
        getTagIdFromLocation,
        getPageFromLocation,
        initTagPage,
        normalizeSearchCompareText,
        readBootstrapPayload,
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
            const pathname = browserScope.location &&
                typeof browserScope.location.pathname === 'string'
                ? browserScope.location.pathname
                : '';
            const pageType = browserScope.document.body?.dataset.feedshelfPage || '';
            const isCategoryPage = /\/categories\/(?:index\.html)?$/u.test(pathname);
            const isSourcePage = /\/sources\/(?:index\.html)?$/u.test(pathname);
            const isTagPage = /\/tags\/(?:index\.html)?$/u.test(pathname);
            const isSearchPage = /\/search\/(?:index\.html)?$/u.test(pathname);
            const initializer = pageType === 'shelf'
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
            initializer().catch((error) => {
                console.error('[feedshelf] failed to initialize page', error);
            });
        });
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
