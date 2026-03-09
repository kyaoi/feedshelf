export interface FeedDefinition {
  id: string;
  name: string;
  category: string;
  feedUrl: string;
  siteUrl: string;
  language: string;
  enabled: boolean;
}

export interface CanonicalArticle {
  id: string;
  feedId: string;
  sourceName: string;
  category: string;
  language: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  author: string | null;
  imageUrl: string | null;
  tags: string[];
  sourceItemId: string | null;
  seenInFeeds: string[];
}

export interface PublicArticleSummary {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  sortAt: string;
  sourceId: string;
  sourceName: string;
  categoryId: string;
  categoryLabel: string;
  imageUrl: string | null;
}

export interface PublicCategorySummary {
  id: string;
  label: string;
  articleCount: number;
  latestSortAt: string;
}

export interface PublicSourceSummary {
  id: string;
  name: string;
  siteUrl: string;
  language: string;
  categoryId: string;
  categoryLabel: string;
  articleCount: number;
  latestSortAt: string;
}

export interface PublicMeta {
  generatedAt: string;
  articleCount: number;
  sourceCount: number;
  categoryCount: number;
}

export interface PublicExports {
  articles: PublicArticleSummary[];
  categories: PublicCategorySummary[];
  sources: PublicSourceSummary[];
  meta: PublicMeta;
}

export interface FeedDocumentInput {
  feedId: string;
  xml: string;
  fetchedAt?: string;
}

export interface PipelineArgs {
  feedsPath: string;
  outputDir: string;
  dryRun: boolean;
}

export interface PipelineSummary {
  feedsPath: string;
  outputDir: string;
  generatedAt: string;
  totalFeeds: number;
  enabledFeeds: number;
  normalizedArticles: number;
  dedupedArticles: number;
  duplicatesCollapsed: number;
  publicArticles: number;
  publicCategories: number;
  publicSources: number;
}

export interface PipelineLogger {
  log(message: string): void;
}

export interface RunPipelineOptions {
  feedsPath?: string;
  outputDir?: string;
  generatedAt?: string;
  dryRun?: boolean;
  feedDocuments?: FeedDocumentInput[];
  logger?: PipelineLogger;
}
