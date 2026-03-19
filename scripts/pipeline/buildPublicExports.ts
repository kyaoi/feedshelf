import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  CanonicalArticle,
  FeedDefinition,
  HomePageBootstrapPayload,
  PublicArticlePageShard,
  PublicArticleSummary,
  PublicBootstrapPayload,
  PublicCategorySummary,
  PublicExports,
  PublicMeta,
  PublicSearchIndexEntry,
  PublicShelfSummary,
  PublicSourceSummary,
  PublicTagSummary,
  ShelfDefinition,
  ShelfPageBootstrapPayload,
  ShelvesDocument,
  TagIndexBootstrapPayload,
} from '../../src/shared/contracts.ts';

const SHELF_ROUTE_PAGE_MARKER = 'data-feedshelf-page="shelf"';
const BOOTSTRAP_SCRIPT_ID = 'feedshelf-bootstrap';
const DEFAULT_PAGE_SIZE = 24;

function toIsoTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return parsed.toISOString();
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uniqueTags(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = normalizeWhitespace(value.normalize('NFKC'));
    if (normalized === '') continue;
    const compareKey = normalized.toLocaleLowerCase('en-US');
    if (seen.has(compareKey)) continue;
    seen.add(compareKey);
    result.push(normalized);
  }
  return result;
}

export function normalizeTagCompareKey(label: string): string {
  return normalizeWhitespace(String(label).normalize('NFKC')).toLocaleLowerCase(
    'en-US',
  );
}

export function normalizeSearchCompareText(value: string): string {
  return normalizeWhitespace(String(value).normalize('NFKC')).toLocaleLowerCase(
    'en-US',
  );
}

export function buildTagId(label: string): string {
  const compareKey = normalizeTagCompareKey(label);
  if (compareKey === '') {
    throw new Error('Unable to build tag id from empty label.');
  }
  return `tag-${crypto
    .createHash('sha256')
    .update(compareKey)
    .digest('hex')
    .slice(0, 12)}`;
}

export function slugifyCategoryLabel(label: string): string {
  const normalized = String(label)
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\s/_.]+/gu, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (normalized === '') {
    throw new Error(`Unable to build category slug: ${label}`);
  }

  return normalized;
}

function selectSortAt(article: CanonicalArticle): string {
  return article.publishedAt || article.fetchedAt;
}

function comparePublicArticles(
  left: PublicArticleSummary,
  right: PublicArticleSummary,
): number {
  const timeOrder = compareByNewestTime(left.sortAt, right.sortAt);
  if (timeOrder !== 0) return timeOrder;
  const titleOrder = left.title.localeCompare(right.title, 'en');
  if (titleOrder !== 0) return titleOrder;
  return left.id.localeCompare(right.id, 'en');
}

function sortPublicArticles(
  articles: PublicArticleSummary[],
): PublicArticleSummary[] {
  return [...articles].sort(comparePublicArticles);
}

function sortAlsoSeenInSourceIds(
  sourceIds: string[],
  feedOrder: Map<string, number>,
): string[] {
  return [...sourceIds].sort((left, right) => {
    const leftOrder = feedOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = feedOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.localeCompare(right, 'en');
  });
}

function deriveAlsoSeenInSourceIds(
  article: CanonicalArticle,
  feedOrder: Map<string, number>,
): string[] {
  const candidates = new Set<string>();

  for (const provenance of article.provenance || []) {
    if (
      typeof provenance.feedId !== 'string' ||
      provenance.feedId === '' ||
      provenance.feedId === article.feedId
    ) {
      continue;
    }
    candidates.add(provenance.feedId);
  }

  return sortAlsoSeenInSourceIds(Array.from(candidates), feedOrder);
}

function buildPublicArticles(
  articles: CanonicalArticle[],
  feeds: FeedDefinition[],
): PublicArticleSummary[] {
  const feedMap = new Map<string, FeedDefinition>(
    feeds.map((feed) => [feed.id, feed]),
  );
  const feedOrder = new Map<string, number>(
    feeds.map((feed, index) => [feed.id, index]),
  );
  return sortPublicArticles(
    articles.map((article) => {
      const feed = feedMap.get(article.feedId);
      if (!feed) {
        throw new Error(`Unknown feed for article export: ${article.feedId}`);
      }
      const alsoSeenInSourceIds = deriveAlsoSeenInSourceIds(article, feedOrder);
      return {
        id: article.id,
        title: article.title,
        url: article.url,
        summary: article.summary,
        publishedAt: article.publishedAt,
        sortAt: selectSortAt(article),
        sourceId: article.feedId,
        sourceName: article.sourceName,
        ...(alsoSeenInSourceIds.length > 0 ? { alsoSeenInSourceIds } : {}),
        shelfIds: [...article.shelfIds],
        imageUrl: article.imageUrl,
        sourceTags: uniqueTags(article.sourceTags || feed.tags || []),
        entryTags: uniqueTags(article.entryTags || []),
      };
    }),
  );
}

function collectSampleTags(articles: PublicArticleSummary[]): string[] {
  const stats = new Map<
    string,
    { label: string; count: number; latestSortAt: string }
  >();
  for (const article of articles) {
    for (const label of uniqueTags([
      ...(article.sourceTags || []),
      ...(article.entryTags || []),
    ])) {
      const compareKey = normalizeTagCompareKey(label);
      const existing = stats.get(compareKey) || {
        label,
        count: 0,
        latestSortAt: article.sortAt,
      };
      existing.count += 1;
      if (compareByNewestTime(article.sortAt, existing.latestSortAt) < 0) {
        existing.latestSortAt = article.sortAt;
      }
      stats.set(compareKey, existing);
    }
  }
  return Array.from(stats.values())
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      const freshnessOrder = compareByNewestTime(
        left.latestSortAt,
        right.latestSortAt,
      );
      if (freshnessOrder !== 0) return freshnessOrder;
      return left.label.localeCompare(right.label, 'en');
    })
    .slice(0, 3)
    .map((entry) => entry.label);
}

function buildSources(
  publicArticles: PublicArticleSummary[],
  feeds: FeedDefinition[],
): PublicSourceSummary[] {
  return feeds
    .filter((feed) => feed.enabled)
    .map((feed) => {
      const relatedArticles = publicArticles.filter(
        (article) => article.sourceId === feed.id,
      );
      const latestSortAt = relatedArticles[0]?.sortAt || '';
      return {
        id: feed.id,
        name: feed.name,
        siteUrl: feed.siteUrl,
        language: feed.language,
        shelfIds: [...feed.shelfIds],
        articleCount: relatedArticles.length,
        latestSortAt,
        tags: uniqueTags(feed.tags || []),
      };
    })
    .sort((left, right) => {
      const freshnessOrder = compareByNewestTime(
        left.latestSortAt,
        right.latestSortAt,
      );
      if (freshnessOrder !== 0) return freshnessOrder;
      return left.name.localeCompare(right.name, 'en');
    });
}

function buildShelves(
  publicArticles: PublicArticleSummary[],
  sources: PublicSourceSummary[],
  shelvesDocument: ShelvesDocument,
): PublicShelfSummary[] {
  return shelvesDocument.shelves.map((shelf) => {
    const relatedArticles = publicArticles.filter((article) =>
      article.shelfIds.includes(shelf.id),
    );
    const relatedSources = sources.filter((source) =>
      source.shelfIds.includes(shelf.id),
    );
    const latestSortAt =
      relatedArticles[0]?.sortAt || relatedSources[0]?.latestSortAt || '';
    const sampleTags = collectSampleTags(relatedArticles);
    return {
      id: shelf.id,
      title: shelf.title,
      description: shelf.description,
      articleCount: relatedArticles.length,
      sourceCount: relatedSources.length,
      latestSortAt,
      ...(sampleTags.length > 0 ? { sampleTags } : {}),
    };
  });
}

function buildCategories(
  shelves: PublicShelfSummary[],
): PublicCategorySummary[] {
  return shelves.map((shelf) => ({
    id: shelf.id,
    label: shelf.title,
    articleCount: shelf.articleCount,
    latestSortAt: shelf.latestSortAt,
  }));
}

function buildTags(publicArticles: PublicArticleSummary[]): PublicTagSummary[] {
  const stats = new Map<
    string,
    {
      id: string;
      label: string;
      articleIds: Set<string>;
      sourceIds: Set<string>;
      latestSortAt: string;
    }
  >();
  for (const article of publicArticles) {
    const labels = uniqueTags([
      ...(article.sourceTags || []),
      ...(article.entryTags || []),
    ]);
    for (const label of labels) {
      const compareKey = normalizeTagCompareKey(label);
      const existing = stats.get(compareKey) || {
        id: buildTagId(label),
        label,
        articleIds: new Set<string>(),
        sourceIds: new Set<string>(),
        latestSortAt: article.sortAt,
      };
      existing.articleIds.add(article.id);
      existing.sourceIds.add(article.sourceId);
      if (compareByNewestTime(article.sortAt, existing.latestSortAt) < 0) {
        existing.latestSortAt = article.sortAt;
      }
      stats.set(compareKey, existing);
    }
  }
  return Array.from(stats.values())
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      articleCount: entry.articleIds.size,
      sourceCount: entry.sourceIds.size,
      latestSortAt: entry.latestSortAt,
    }))
    .sort((left, right) => {
      if (left.articleCount !== right.articleCount)
        return right.articleCount - left.articleCount;
      const freshnessOrder = compareByNewestTime(
        left.latestSortAt,
        right.latestSortAt,
      );
      if (freshnessOrder !== 0) return freshnessOrder;
      return left.label.localeCompare(right.label, 'en');
    });
}

function buildSearchIndex(
  publicArticles: PublicArticleSummary[],
): PublicSearchIndexEntry[] {
  return publicArticles.map((article) => {
    const sourceTags = uniqueTags(article.sourceTags || []);
    const entryTags = uniqueTags(article.entryTags || []);
    const tagLabels = uniqueTags([...sourceTags, ...entryTags]);
    const titleText = normalizeSearchCompareText(article.title);
    const sourceText = normalizeSearchCompareText(article.sourceName);
    const tagText = normalizeSearchCompareText(tagLabels.join(' '));
    return {
      articleId: article.id,
      sortAt: article.sortAt,
      shelfIds: [...article.shelfIds],
      title: article.title,
      sourceName: article.sourceName,
      sourceTags,
      entryTags,
      titleText,
      sourceText,
      tagText,
      searchText: normalizeSearchCompareText(
        [article.title, article.sourceName, ...tagLabels].join(' '),
      ),
    };
  });
}

function chooseLongerText(
  left: string | null,
  right: string | null,
): string | null {
  if (!left) return right || null;
  if (!right) return left;
  return right.length > left.length ? right : left;
}

function uniqueStringUnion(
  left: string[] = [],
  right: string[] = [],
): string[] {
  return uniqueTags([...left, ...right]);
}

function mergePublicArticleSummary(
  retained: PublicArticleSummary,
  fresh: PublicArticleSummary,
): PublicArticleSummary {
  const winner = comparePublicArticles(fresh, retained) <= 0 ? fresh : retained;
  const loser = winner === fresh ? retained : fresh;
  const alsoSeenInSourceIds = uniqueTags([
    ...(winner.alsoSeenInSourceIds || []),
    ...(loser.alsoSeenInSourceIds || []),
  ]).filter((sourceId) => sourceId !== winner.sourceId);
  return {
    ...winner,
    title: winner.title || loser.title,
    url: winner.url || loser.url,
    summary: chooseLongerText(winner.summary, loser.summary),
    publishedAt: winner.publishedAt || loser.publishedAt || null,
    sortAt:
      compareByNewestTime(winner.sortAt, loser.sortAt) <= 0
        ? winner.sortAt
        : loser.sortAt,
    sourceName: winner.sourceName || loser.sourceName,
    ...(alsoSeenInSourceIds.length > 0 ? { alsoSeenInSourceIds } : {}),
    shelfIds: uniqueStringUnion(winner.shelfIds, loser.shelfIds),
    imageUrl: winner.imageUrl || loser.imageUrl || null,
    sourceTags: uniqueStringUnion(winner.sourceTags, loser.sourceTags),
    entryTags: uniqueStringUnion(winner.entryTags, loser.entryTags),
  };
}

export function mergePublicArticleSummaries({
  retainedArticles,
  freshArticles,
}: {
  retainedArticles: PublicArticleSummary[];
  freshArticles: PublicArticleSummary[];
}): PublicArticleSummary[] {
  const merged = new Map<string, PublicArticleSummary>();
  for (const article of retainedArticles) merged.set(article.id, article);
  for (const article of freshArticles) {
    const existing = merged.get(article.id);
    merged.set(
      article.id,
      existing ? mergePublicArticleSummary(existing, article) : article,
    );
  }
  return sortPublicArticles(Array.from(merged.values()));
}

export function buildPublicExportsFromPublicArticles({
  articles,
  feeds,
  shelves,
  generatedAt,
}: {
  articles: PublicArticleSummary[];
  feeds: FeedDefinition[];
  shelves: ShelvesDocument;
  generatedAt: string;
}): PublicExports {
  const normalizedGeneratedAt = toIsoTimestamp(generatedAt);
  const publicArticles = sortPublicArticles(articles);
  const publicSources = buildSources(publicArticles, feeds);
  const publicShelves = buildShelves(publicArticles, publicSources, shelves);
  const publicCategories = buildCategories(publicShelves);
  const publicTags = buildTags(publicArticles);
  const publicSearchIndex = buildSearchIndex(publicArticles);
  const meta: PublicMeta = {
    generatedAt: normalizedGeneratedAt,
    articleCount: publicArticles.length,
    sourceCount: publicSources.length,
    shelfCount: publicShelves.length,
    categoryCount: publicCategories.length,
    tagCount: publicTags.length,
    searchIndexCount: publicSearchIndex.length,
  };
  return {
    articles: publicArticles,
    shelves: publicShelves,
    categories: publicCategories,
    sources: publicSources,
    tags: publicTags,
    searchIndex: publicSearchIndex,
    meta,
  };
}

export function buildPublicExports({
  articles,
  feeds,
  shelves,
  generatedAt,
}: {
  articles: CanonicalArticle[];
  feeds: FeedDefinition[];
  shelves: ShelvesDocument;
  generatedAt: string;
}): PublicExports {
  return buildPublicExportsFromPublicArticles({
    articles: buildPublicArticles(articles, feeds),
    feeds,
    shelves,
    generatedAt,
  });
}

function renderShelfRouteHtml(shelf: ShelfDefinition): string {
  const title = escapeHtml(`${shelf.title} | FeedShelf`);
  const description = escapeHtml(
    `${shelf.description} FeedShelf の shelf-first route から、注目記事・新着・関連媒体を辿れます。`,
  );
  const shelfTitle = escapeHtml(`${shelf.title} 棚`);
  const shelfDescription = escapeHtml(shelf.description);
  const shelfId = escapeHtml(shelf.id);
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="stylesheet" href="../assets/styles.css" />
    <script defer src="../assets/app.js"></script>
  </head>
  <body data-feedshelf-page="shelf" data-shelf-id="${shelfId}">
    <header class="hero hero--compact">
      <div class="container">
        <div class="hero-card">
          <div class="hero__main">
            <a class="back-link" href="../">← トップへ戻る</a>
            <p class="eyebrow">FeedShelf / Shelf</p>
            <h1 id="shelf-page-title">${shelfTitle}</h1>
            <p id="shelf-page-description" class="lead">${shelfDescription}</p>
          </div>
          <aside class="hero__aside">
            <div class="hero-surface">
              <p class="panel__eyebrow">Navigate</p>
              <h2>探索を広げる</h2>
              <div class="hero-badge-list">
                <a class="hero-badge" href="#featured-title">注目記事へ</a>
                <a class="hero-badge" href="#related-sources-title">関連する媒体へ</a>
                <a class="hero-badge" href="#articles-title">新着記事へ</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </header>
    <main class="container layout">
      <div class="section-grid section-grid--detail-top">
        <section class="panel" aria-labelledby="shelf-nav-title">
          <div class="panel__heading"><div><p class="panel__eyebrow">Shelves</p><h2 id="shelf-nav-title">棚一覧</h2></div><p id="generated-at" class="muted">読み込み中…</p></div>
          <div id="shelf-nav" class="chip-list" aria-live="polite"><p class="placeholder-text">読み込み中…</p></div>
        </section>
        <section class="panel" aria-labelledby="related-sources-title">
          <div class="panel__heading"><div><p class="panel__eyebrow">Sources</p><h2 id="related-sources-title">関連する媒体</h2></div><p class="muted">この棚に属する媒体から source detail へ移動できます。</p></div>
          <div id="related-sources" class="chip-list" aria-live="polite"><p class="placeholder-text">読み込み中…</p></div>
        </section>
      </div>
      <section class="panel" aria-labelledby="featured-title">
        <div class="panel__heading"><div><p class="panel__eyebrow">Featured</p><h2 id="featured-title">注目記事</h2></div><p id="featured-count" class="muted">読み込み中…</p></div>
        <ol id="featured-list" class="article-list" aria-live="polite"><li class="placeholder-text">読み込み中…</li></ol>
      </section>
      <section class="panel" aria-labelledby="articles-title">
        <div class="panel__heading"><div><p class="panel__eyebrow">Recent</p><h2 id="articles-title">この棚の新着記事</h2></div><p id="articles-count" class="muted">読み込み中…</p></div>
        <div id="articles-status" class="status status--loading" aria-live="polite">公開 JSON を読み込んでいます…</div>
        <ol id="articles-list" class="article-list" hidden></ol>
        <nav id="articles-pagination" class="page-nav" hidden aria-label="記事ページ"></nav>
      </section>
    </main>
  </body>
</html>
`;
}

async function pruneStaleShelfRouteShells({
  siteDir,
  activeShelfIds,
}: {
  siteDir: string;
  activeShelfIds: Set<string>;
}): Promise<void> {
  const entries = await fs.readdir(siteDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory() || activeShelfIds.has(entry.name)) return;
      const indexPath = path.join(siteDir, entry.name, 'index.html');
      let html = '';
      try {
        html = await fs.readFile(indexPath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      if (!html.includes(SHELF_ROUTE_PAGE_MARKER)) return;
      await fs.rm(path.join(siteDir, entry.name), {
        recursive: true,
        force: true,
      });
    }),
  );
}

function buildArticlePageShard({
  routeKind,
  articles,
  page,
  generatedAt,
  pageSize = DEFAULT_PAGE_SIZE,
  shelfId,
  tagId,
  tagLabel,
}: {
  routeKind: 'home' | 'shelf' | 'tag';
  articles: PublicArticleSummary[];
  page: number;
  generatedAt: string;
  pageSize?: number;
  shelfId?: string;
  tagId?: string;
  tagLabel?: string;
}): PublicArticlePageShard {
  const totalItems = articles.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    routeKind,
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    generatedAt,
    articles: articles.slice(start, start + pageSize),
    ...(shelfId ? { shelfId } : {}),
    ...(tagId ? { tagId } : {}),
    ...(tagLabel ? { tagLabel } : {}),
  };
}

function buildHomeBootstrapPayload(
  publicExports: PublicExports,
): HomePageBootstrapPayload {
  return {
    kind: 'home',
    generatedAt: publicExports.meta.generatedAt,
    meta: publicExports.meta,
    shelves: publicExports.shelves,
    tags: publicExports.tags.slice(0, 24),
    sources: publicExports.sources.slice(0, 18),
    articlePage: buildArticlePageShard({
      routeKind: 'home',
      articles: publicExports.articles,
      page: 1,
      generatedAt: publicExports.meta.generatedAt,
    }),
  };
}

function buildShelfBootstrapPayload({
  publicExports,
  shelfId,
}: {
  publicExports: PublicExports;
  shelfId: string;
}): ShelfPageBootstrapPayload {
  const shelf =
    publicExports.shelves.find((entry) => entry.id === shelfId) || null;
  const shelfArticles = publicExports.articles.filter((article) =>
    article.shelfIds.includes(shelfId),
  );
  const relatedSources = publicExports.sources.filter((source) =>
    source.shelfIds.includes(shelfId),
  );
  return {
    kind: 'shelf',
    generatedAt: publicExports.meta.generatedAt,
    meta: publicExports.meta,
    shelfId,
    shelf,
    shelves: publicExports.shelves,
    relatedSources,
    featuredArticles: shelfArticles.slice(0, 3),
    articlePage: buildArticlePageShard({
      routeKind: 'shelf',
      articles: shelfArticles,
      page: 1,
      generatedAt: publicExports.meta.generatedAt,
      shelfId,
    }),
  };
}

function buildTagIndexBootstrapPayload(
  publicExports: PublicExports,
): TagIndexBootstrapPayload {
  return {
    kind: 'tag-index',
    generatedAt: publicExports.meta.generatedAt,
    meta: publicExports.meta,
    tags: publicExports.tags,
  };
}

function injectBootstrapPayload(
  html: string,
  payload: PublicBootstrapPayload,
): string {
  const json = JSON.stringify(payload).replace(/</g, '\u003c');
  const sanitizedHtml = html.replace(
    new RegExp(
      `\\s*<script id="${BOOTSTRAP_SCRIPT_ID}" type="application/json">[\\s\\S]*?</script>`,
      'u',
    ),
    '',
  );
  return sanitizedHtml.replace(
    '</body>',
    `  <script id="${BOOTSTRAP_SCRIPT_ID}" type="application/json">${json}</script>
  </body>`,
  );
}

async function readTemplate(relativePath: string): Promise<string> {
  return fs.readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

async function writeJsonFile(
  filePath: string,
  payload: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

async function writeHomePageShards({
  outputDir,
  publicExports,
  siteDir,
}: {
  outputDir: string;
  publicExports: PublicExports;
  siteDir: string;
}): Promise<void> {
  const pageDir = path.join(outputDir, 'pages', 'home');
  await fs.rm(pageDir, { recursive: true, force: true });
  const totalPages = Math.max(
    1,
    Math.ceil(publicExports.articles.length / DEFAULT_PAGE_SIZE),
  );
  await Promise.all(
    Array.from({ length: totalPages }, (_, index) =>
      writeJsonFile(
        path.join(pageDir, `page-${index + 1}.json`),
        buildArticlePageShard({
          routeKind: 'home',
          articles: publicExports.articles,
          page: index + 1,
          generatedAt: publicExports.meta.generatedAt,
        }),
      ),
    ),
  );
  const homeTemplate = await readTemplate('public/index.html');
  const homeHtml = injectBootstrapPayload(
    homeTemplate,
    buildHomeBootstrapPayload(publicExports),
  );
  await fs.writeFile(path.join(siteDir, 'index.html'), homeHtml);
}

async function writeTagPageArtifacts({
  outputDir,
  publicExports,
  siteDir,
}: {
  outputDir: string;
  publicExports: PublicExports;
  siteDir: string;
}): Promise<void> {
  const pageRoot = path.join(outputDir, 'pages', 'tags');
  await fs.rm(pageRoot, { recursive: true, force: true });
  await Promise.all(
    publicExports.tags.map(async (tag) => {
      const tagArticles = publicExports.articles.filter((article) =>
        uniqueTags([
          ...(article.sourceTags || []),
          ...(article.entryTags || []),
        ]).some((label) => buildTagId(label) === tag.id),
      );
      const totalPages = Math.max(
        1,
        Math.ceil(tagArticles.length / DEFAULT_PAGE_SIZE),
      );
      await Promise.all(
        Array.from({ length: totalPages }, (_, index) =>
          writeJsonFile(
            path.join(pageRoot, tag.id, `page-${index + 1}.json`),
            buildArticlePageShard({
              routeKind: 'tag',
              articles: tagArticles,
              page: index + 1,
              generatedAt: publicExports.meta.generatedAt,
              tagId: tag.id,
              tagLabel: tag.label,
            }),
          ),
        ),
      );
    }),
  );
  const tagsTemplate = await readTemplate('public/tags/index.html');
  const tagsHtml = injectBootstrapPayload(
    tagsTemplate,
    buildTagIndexBootstrapPayload(publicExports),
  );
  await fs.mkdir(path.join(siteDir, 'tags'), { recursive: true });
  await fs.writeFile(path.join(siteDir, 'tags', 'index.html'), tagsHtml);
}

async function writeShelfRouteShells({
  outputDir,
  siteDir,
  publicExports,
  shelves,
}: {
  outputDir: string;
  siteDir: string;
  publicExports: PublicExports;
  shelves: ShelfDefinition[];
}): Promise<void> {
  const activeShelfIds = new Set(shelves.map((shelf) => shelf.id));
  await pruneStaleShelfRouteShells({ siteDir, activeShelfIds });
  const pageRoot = path.join(outputDir, 'pages', 'shelves');
  await fs.rm(pageRoot, { recursive: true, force: true });
  await Promise.all(
    shelves.map(async (shelf) => {
      const shelfDir = path.join(siteDir, shelf.id);
      const shelfArticles = publicExports.articles.filter((article) =>
        article.shelfIds.includes(shelf.id),
      );
      const totalPages = Math.max(
        1,
        Math.ceil(shelfArticles.length / DEFAULT_PAGE_SIZE),
      );
      await Promise.all(
        Array.from({ length: totalPages }, (_, index) =>
          writeJsonFile(
            path.join(pageRoot, shelf.id, `page-${index + 1}.json`),
            buildArticlePageShard({
              routeKind: 'shelf',
              articles: shelfArticles,
              page: index + 1,
              generatedAt: publicExports.meta.generatedAt,
              shelfId: shelf.id,
            }),
          ),
        ),
      );
      await fs.mkdir(shelfDir, { recursive: true });
      await fs.writeFile(
        path.join(shelfDir, 'index.html'),
        injectBootstrapPayload(
          renderShelfRouteHtml(shelf),
          buildShelfBootstrapPayload({ publicExports, shelfId: shelf.id }),
        ),
      );
    }),
  );
}

export async function writePublicExports({
  outputDir,
  publicExports,
  shelvesDocument,
}: {
  outputDir: string;
  publicExports: PublicExports;
  shelvesDocument: ShelvesDocument;
}): Promise<void> {
  const absoluteOutputDir = path.resolve(outputDir);
  const siteDir = path.dirname(absoluteOutputDir);
  await fs.mkdir(absoluteOutputDir, { recursive: true });
  await Promise.all([
    writeShelfRouteShells({
      outputDir: absoluteOutputDir,
      siteDir,
      publicExports,
      shelves: shelvesDocument.shelves,
    }),
    writeHomePageShards({
      outputDir: absoluteOutputDir,
      publicExports,
      siteDir,
    }),
    writeTagPageArtifacts({
      outputDir: absoluteOutputDir,
      publicExports,
      siteDir,
    }),
    fs.writeFile(
      path.join(absoluteOutputDir, 'articles.json'),
      JSON.stringify(publicExports.articles, null, 2),
    ),
    fs.writeFile(
      path.join(absoluteOutputDir, 'shelves.json'),
      JSON.stringify(publicExports.shelves, null, 2),
    ),
    fs.writeFile(
      path.join(absoluteOutputDir, 'categories.json'),
      JSON.stringify(publicExports.categories, null, 2),
    ),
    fs.writeFile(
      path.join(absoluteOutputDir, 'sources.json'),
      JSON.stringify(publicExports.sources, null, 2),
    ),
    fs.writeFile(
      path.join(absoluteOutputDir, 'tags.json'),
      JSON.stringify(publicExports.tags, null, 2),
    ),
    fs.writeFile(
      path.join(absoluteOutputDir, 'search-index.json'),
      JSON.stringify(publicExports.searchIndex, null, 2),
    ),
    fs.writeFile(
      path.join(absoluteOutputDir, 'meta.json'),
      JSON.stringify(publicExports.meta, null, 2),
    ),
  ]);
}
