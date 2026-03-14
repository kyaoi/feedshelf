export interface FeedDefinition {
  id: string;
  name: string;
  feedUrl: string;
  siteUrl: string;
  language: string;
  enabled: boolean;
  shelfIds: string[];
  tags?: string[];
}

export interface ShelfDefinition {
  id: string;
  title: string;
  description: string;
}

export interface ShelvesDocument {
  site: {
    title: string;
    description: string;
    intro: string;
  };
  shelves: ShelfDefinition[];
}

export interface CanonicalArticle {
  id: string;
  feedId: string;
  sourceName: string;
  language: string;
  shelfIds: string[];
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  author: string | null;
  imageUrl: string | null;
  sourceTags: string[];
  entryTags: string[];
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
  shelfIds: string[];
  imageUrl: string | null;
  sourceTags: string[];
  entryTags: string[];
}

export interface PublicShelfSummary {
  id: string;
  title: string;
  description: string;
  articleCount: number;
  sourceCount: number;
  latestSortAt: string;
  sampleTags?: string[];
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
  shelfIds: string[];
  articleCount: number;
  latestSortAt: string;
  tags: string[];
}

export interface PublicTagSummary {
  id: string;
  label: string;
  articleCount: number;
  sourceCount: number;
  latestSortAt: string;
}

export interface PublicSearchIndexEntry {
  articleId: string;
  sortAt: string;
  shelfIds: string[];
  title: string;
  sourceName: string;
  sourceTags: string[];
  entryTags: string[];
  titleText: string;
  sourceText: string;
  tagText: string;
  searchText: string;
}

export interface PublicMeta {
  generatedAt: string;
  articleCount: number;
  sourceCount: number;
  shelfCount: number;
  categoryCount: number;
  tagCount: number;
  searchIndexCount: number;
}

export interface PublicExports {
  articles: PublicArticleSummary[];
  shelves: PublicShelfSummary[];
  categories: PublicCategorySummary[];
  sources: PublicSourceSummary[];
  tags: PublicTagSummary[];
  searchIndex: PublicSearchIndexEntry[];
  meta: PublicMeta;
}

export interface FeedDocumentInput {
  feedId: string;
  xml: string;
  fetchedAt?: string;
}

export interface PipelineArgs {
  feedsPath: string;
  shelvesPath: string;
  outputDir: string;
  dryRun: boolean;
}

export interface PipelineSummary {
  feedsPath: string;
  shelvesPath: string;
  outputDir: string;
  generatedAt: string;
  totalFeeds: number;
  enabledFeeds: number;
  normalizedArticles: number;
  dedupedArticles: number;
  duplicatesCollapsed: number;
  publicArticles: number;
  publicShelves: number;
  publicCategories: number;
  publicSources: number;
  publicTags: number;
  publicSearchIndex: number;
}

export interface FeedFetchFailure {
  feedId: string;
  feedUrl: string;
  message: string;
}

export interface UpdatePipelineSummary extends PipelineSummary {
  attemptedFeeds: number;
  fetchedDocuments: number;
  failedFeeds: number;
  failedFetches: FeedFetchFailure[];
}

export interface PipelineLogger {
  log(message: string): void;
}

export interface RunPipelineOptions {
  feedsPath?: string;
  shelvesPath?: string;
  outputDir?: string;
  generatedAt?: string;
  dryRun?: boolean;
  feedDocuments?: FeedDocumentInput[];
  logger?: PipelineLogger;
}
