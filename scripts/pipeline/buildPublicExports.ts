import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  CanonicalArticle,
  FeedDefinition,
  PublicArticleSummary,
  PublicCategorySummary,
  PublicExports,
  PublicMeta,
  PublicSourceSummary,
} from '../../src/shared/contracts.ts';

function toIsoTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return parsed.toISOString();
}

function toComparableTime(value: string): number {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
}

function compareByNewestTime(left: string, right: string): number {
  const leftTime = toComparableTime(left);
  const rightTime = toComparableTime(right);

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return 0;
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

function buildCategoryRegistry(articles: CanonicalArticle[]): Map<string, string> {
  const categories = new Map<string, string>();

  for (const article of articles) {
    const label = article.category;
    const id = slugifyCategoryLabel(label);
    const existing = categories.get(id);

    if (existing && existing !== label) {
      throw new Error(`Category slug collision: ${existing} vs ${label} -> ${id}`);
    }

    categories.set(id, label);
  }

  return categories;
}

function selectSortAt(article: CanonicalArticle): string {
  return article.publishedAt || article.fetchedAt;
}

function comparePublicArticles(left: PublicArticleSummary, right: PublicArticleSummary): number {
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

function buildPublicArticles(articles: CanonicalArticle[]): PublicArticleSummary[] {
  return articles
    .map((article) => ({
      id: article.id,
      title: article.title,
      url: article.url,
      summary: article.summary,
      publishedAt: article.publishedAt,
      sortAt: selectSortAt(article),
      sourceId: article.feedId,
      sourceName: article.sourceName,
      categoryId: slugifyCategoryLabel(article.category),
      categoryLabel: article.category,
      imageUrl: article.imageUrl,
    }))
    .sort(comparePublicArticles);
}

function buildCategories(
  publicArticles: PublicArticleSummary[],
  categoryRegistry: Map<string, string>,
): PublicCategorySummary[] {
  const stats = new Map<string, PublicCategorySummary>();

  for (const article of publicArticles) {
    const existing = stats.get(article.categoryId) || {
      id: article.categoryId,
      label: categoryRegistry.get(article.categoryId) || article.categoryLabel,
      articleCount: 0,
      latestSortAt: article.sortAt,
    };

    existing.articleCount += 1;
    if (compareByNewestTime(article.sortAt, existing.latestSortAt) < 0) {
      existing.latestSortAt = article.sortAt;
    }

    stats.set(article.categoryId, existing);
  }

  return Array.from(stats.values()).sort((left, right) => {
    const timeOrder = compareByNewestTime(left.latestSortAt, right.latestSortAt);
    if (timeOrder !== 0) {
      return timeOrder;
    }

    return left.label.localeCompare(right.label, 'en');
  });
}

function buildSources(
  publicArticles: PublicArticleSummary[],
  feeds: FeedDefinition[],
  categoryRegistry: Map<string, string>,
): PublicSourceSummary[] {
  const feedMap = new Map<string, FeedDefinition>(feeds.map((feed) => [feed.id, feed]));
  const stats = new Map<string, PublicSourceSummary>();

  for (const article of publicArticles) {
    const feed = feedMap.get(article.sourceId);
    if (!feed) {
      throw new Error(`Unknown sourceId for public export: ${article.sourceId}`);
    }

    const categoryId = slugifyCategoryLabel(feed.category);
    const existing = stats.get(article.sourceId) || {
      id: feed.id,
      name: feed.name,
      siteUrl: feed.siteUrl,
      language: feed.language,
      categoryId,
      categoryLabel: categoryRegistry.get(categoryId) || feed.category,
      articleCount: 0,
      latestSortAt: article.sortAt,
    };

    existing.articleCount += 1;
    if (compareByNewestTime(article.sortAt, existing.latestSortAt) < 0) {
      existing.latestSortAt = article.sortAt;
    }

    stats.set(article.sourceId, existing);
  }

  return Array.from(stats.values()).sort((left, right) => {
    const timeOrder = compareByNewestTime(left.latestSortAt, right.latestSortAt);
    if (timeOrder !== 0) {
      return timeOrder;
    }

    return left.id.localeCompare(right.id, 'en');
  });
}

export function buildPublicExports({
  articles,
  feeds,
  generatedAt,
}: {
  articles: CanonicalArticle[];
  feeds: FeedDefinition[];
  generatedAt?: string;
}): PublicExports {
  const categoryRegistry = buildCategoryRegistry(articles);
  const publicArticles = buildPublicArticles(articles);
  const categories = buildCategories(publicArticles, categoryRegistry);
  const sources = buildSources(publicArticles, feeds, categoryRegistry);
  const meta: PublicMeta = {
    generatedAt: toIsoTimestamp(generatedAt || new Date().toISOString()),
    articleCount: publicArticles.length,
    sourceCount: sources.length,
    categoryCount: categories.length,
  };

  return {
    articles: publicArticles,
    categories,
    sources,
    meta,
  };
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writePublicExports({
  outputDir,
  publicExports,
}: {
  outputDir: string;
  publicExports: PublicExports;
}): Promise<void> {
  const resolvedOutputDir = path.resolve(outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  await Promise.all([
    writeJsonFile(path.join(resolvedOutputDir, 'articles.json'), publicExports.articles),
    writeJsonFile(path.join(resolvedOutputDir, 'categories.json'), publicExports.categories),
    writeJsonFile(path.join(resolvedOutputDir, 'sources.json'), publicExports.sources),
    writeJsonFile(path.join(resolvedOutputDir, 'meta.json'), publicExports.meta),
  ]);
}
