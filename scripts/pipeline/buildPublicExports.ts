import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  CanonicalArticle,
  FeedDefinition,
  PublicArticleSummary,
  PublicCategorySummary,
  PublicExports,
  PublicMeta,
  PublicSearchIndexEntry,
  PublicShelfSummary,
  PublicSourceSummary,
  PublicTagSummary,
  ShelfDefinition,
  ShelvesDocument,
} from '../../src/shared/contracts.ts';

const SHELF_ROUTE_PAGE_MARKER = 'data-feedshelf-page="shelf"';

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

function uniqueTags(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeWhitespace(value.normalize('NFKC'));
    if (normalized === '') {
      continue;
    }

    const compareKey = normalized.toLocaleLowerCase('en-US');
    if (seen.has(compareKey)) {
      continue;
    }

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
  if (timeOrder !== 0) {
    return timeOrder;
  }

  const titleOrder = left.title.localeCompare(right.title, 'en');
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return left.id.localeCompare(right.id, 'en');
}

function buildPublicArticles(
  articles: CanonicalArticle[],
  feeds: FeedDefinition[],
): PublicArticleSummary[] {
  const feedMap = new Map<string, FeedDefinition>(
    feeds.map((feed) => [feed.id, feed]),
  );

  return articles
    .map((article) => {
      const feed = feedMap.get(article.feedId);
      if (!feed) {
        throw new Error(`Unknown feed for article export: ${article.feedId}`);
      }

      return {
        id: article.id,
        title: article.title,
        url: article.url,
        summary: article.summary,
        publishedAt: article.publishedAt,
        sortAt: selectSortAt(article),
        sourceId: article.feedId,
        sourceName: article.sourceName,
        shelfIds: [...article.shelfIds],
        imageUrl: article.imageUrl,
        sourceTags: uniqueTags(article.sourceTags || feed.tags || []),
        entryTags: uniqueTags(article.entryTags || []),
      };
    })
    .sort(comparePublicArticles);
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
      if (left.count !== right.count) {
        return right.count - left.count;
      }

      const freshnessOrder = compareByNewestTime(
        left.latestSortAt,
        right.latestSortAt,
      );
      if (freshnessOrder !== 0) {
        return freshnessOrder;
      }

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
      if (freshnessOrder !== 0) {
        return freshnessOrder;
      }

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
      if (left.articleCount !== right.articleCount) {
        return right.articleCount - left.articleCount;
      }

      const freshnessOrder = compareByNewestTime(
        left.latestSortAt,
        right.latestSortAt,
      );
      if (freshnessOrder !== 0) {
        return freshnessOrder;
      }

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
  const normalizedGeneratedAt = toIsoTimestamp(generatedAt);
  const publicArticles = buildPublicArticles(articles, feeds);
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

function renderShelfRouteHtml(shelf: ShelfDefinition): string {
  const title = `${shelf.title} | FeedShelf`;
  const description = `${shelf.description} FeedShelf の shelf-first route から、注目記事・新着・関連媒体を辿れます。`;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta
      name="description"
      content="${description}"
    />
    <link rel="stylesheet" href="../assets/styles.css" />
    <script defer src="../assets/app.js"></script>
  </head>
  <body data-feedshelf-page="shelf" data-shelf-id="${shelf.id}">
    <header class="hero hero--compact">
      <div class="container hero__inner">
        <a class="back-link" href="../">← トップへ戻る</a>
        <p class="eyebrow">FeedShelf / Shelf</p>
        <h1 id="shelf-page-title">${shelf.title} 棚</h1>
        <p id="shelf-page-description" class="lead">
          ${shelf.description}
        </p>
      </div>
    </header>

    <main class="container layout">
      <section class="panel" aria-labelledby="shelf-nav-title">
        <div class="panel__heading">
          <div>
            <p class="panel__eyebrow">Shelves</p>
            <h2 id="shelf-nav-title">棚一覧</h2>
          </div>
          <p id="generated-at" class="muted">読み込み中…</p>
        </div>
        <div id="shelf-nav" class="chip-list" aria-live="polite">
          <p class="placeholder-text">読み込み中…</p>
        </div>
      </section>

      <section class="panel" aria-labelledby="featured-title">
        <div class="panel__heading">
          <div>
            <p class="panel__eyebrow">Featured</p>
            <h2 id="featured-title">注目記事</h2>
          </div>
          <p id="featured-count" class="muted">読み込み中…</p>
        </div>
        <ol id="featured-list" class="article-list" aria-live="polite">
          <li class="placeholder-text">読み込み中…</li>
        </ol>
      </section>

      <section class="panel" aria-labelledby="related-sources-title">
        <div class="panel__heading">
          <div>
            <p class="panel__eyebrow">Sources</p>
            <h2 id="related-sources-title">関連する媒体</h2>
          </div>
          <p class="muted">この棚に属する媒体から source detail へ移動できます。</p>
        </div>
        <div id="related-sources" class="chip-list" aria-live="polite">
          <p class="placeholder-text">読み込み中…</p>
        </div>
      </section>

      <section class="panel" aria-labelledby="articles-title">
        <div class="panel__heading">
          <div>
            <p class="panel__eyebrow">Recent</p>
            <h2 id="articles-title">この棚の新着記事</h2>
          </div>
          <p id="articles-count" class="muted">読み込み中…</p>
        </div>

        <div id="articles-status" class="status status--loading" aria-live="polite">
          公開 JSON を読み込んでいます…
        </div>
        <ol id="articles-list" class="article-list" hidden></ol>
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
      if (!entry.isDirectory() || activeShelfIds.has(entry.name)) {
        return;
      }

      const indexPath = path.join(siteDir, entry.name, 'index.html');
      let html = '';

      try {
        html = await fs.readFile(indexPath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return;
        }

        throw error;
      }

      if (!html.includes(SHELF_ROUTE_PAGE_MARKER)) {
        return;
      }

      await fs.rm(path.join(siteDir, entry.name), {
        recursive: true,
        force: true,
      });
    }),
  );
}

async function writeShelfRouteShells({
  siteDir,
  shelves,
}: {
  siteDir: string;
  shelves: ShelfDefinition[];
}): Promise<void> {
  const activeShelfIds = new Set(shelves.map((shelf) => shelf.id));
  await pruneStaleShelfRouteShells({ siteDir, activeShelfIds });

  await Promise.all(
    shelves.map(async (shelf) => {
      const shelfDir = path.join(siteDir, shelf.id);
      await fs.mkdir(shelfDir, { recursive: true });
      await fs.writeFile(
        path.join(shelfDir, 'index.html'),
        renderShelfRouteHtml(shelf),
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
      siteDir,
      shelves: shelvesDocument.shelves,
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
