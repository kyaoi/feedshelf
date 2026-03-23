export type FuzzySourceFamilyKey = 'itmedia' | 'qiita' | 'zenn';
export type FuzzyRegistrableDomainKey =
  | 'itmedia.co.jp'
  | 'qiita.com'
  | 'zenn.dev';
export type FuzzyDedupeScopeKind =
  | 'source'
  | 'sourceFamily'
  | 'registrableDomain';

export interface FeedDefinition {
  id: string;
  name: string;
  feedUrl: string;
  siteUrl: string;
  language: string;
  enabled: boolean;
  shelfIds: string[];
  tags?: string[];
  fuzzySourceFamilyKey?: FuzzySourceFamilyKey;
  fuzzyRegistrableDomainKey?: FuzzyRegistrableDomainKey;
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

export type ArticleProvenanceMatchedBy =
  | 'primary'
  | 'normalizedUrl'
  | 'feedItem'
  | 'fuzzyTitleDate';

export interface ArticleProvenanceEntry {
  feedId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sourceItemId: string | null;
  matchedBy: ArticleProvenanceMatchedBy;
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
  provenance: ArticleProvenanceEntry[];
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
  alsoSeenInSourceIds?: string[];
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

export interface UpdateSourceState {
  feedId: string;
  checkpointArticleId: string | null;
  checkpointSortAt: string | null;
  lastSuccessfulFetchAt: string;
  provenance: ArticleProvenanceEntry[];
}

export interface UpdateState {
  version: 1;
  updatedAt: string;
  safetyWindowHours: number;
  sources: Record<string, UpdateSourceState>;
}

export interface PublicArticlePageShard {
  routeKind: 'home' | 'shelf' | 'tag';
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  generatedAt: string;
  articles: PublicArticleSummary[];
  shelfId?: string;
  tagId?: string;
  tagLabel?: string;
}

export interface HomePageBootstrapPayload {
  kind: 'home';
  generatedAt: string;
  meta: PublicMeta;
  shelves: PublicShelfSummary[];
  tags: PublicTagSummary[];
  sources: PublicSourceSummary[];
  articlePage: PublicArticlePageShard;
}

export interface ShelfPageBootstrapPayload {
  kind: 'shelf';
  generatedAt: string;
  meta: PublicMeta;
  shelfId: string;
  shelf: PublicShelfSummary | null;
  shelves: PublicShelfSummary[];
  relatedSources: PublicSourceSummary[];
  featuredArticles: PublicArticleSummary[];
  articlePage: PublicArticlePageShard;
}

export interface TagIndexBootstrapPayload {
  kind: 'tag-index';
  generatedAt: string;
  meta: PublicMeta;
  tags: PublicTagSummary[];
}

export type PublicBootstrapPayload =
  | HomePageBootstrapPayload
  | ShelfPageBootstrapPayload
  | TagIndexBootstrapPayload;

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
  disableFuzzyDedupe: boolean;
  fuzzyAuditPath: string | null;
  fuzzyHandoffPath: string | null;
  fuzzyRejectPath: string | null;
  fuzzyAcceptPath: string | null;
  fuzzyReviewStatePath: string | null;
  fuzzyReviewHtmlPath: string | null;
}

export interface FuzzyDedupeAuditRecord {
  winnerArticleId: string;
  incomingArticleId: string;
  winnerFeedId: string;
  incomingFeedId: string;
  titleCompareKey: string;
  publishedAtDeltaHours: number;
  matchedBy: 'fuzzyTitleDate';
  scopeKind?: FuzzyDedupeScopeKind;
}

export interface FuzzyDedupeHandoffRecord extends FuzzyDedupeAuditRecord {
  winnerTitle: string;
  incomingTitle: string;
  winnerUrl: string;
  incomingUrl: string;
  winnerSourceName: string;
  incomingSourceName: string;
}

export interface FuzzyDedupeRejectEntry {
  articleIdPair: [string, string];
  matchedBy: 'fuzzyTitleDate';
  winnerTitle?: string;
  incomingTitle?: string;
  note?: string;
}

export interface FuzzyDedupeAcceptEntry {
  articleIdPair: [string, string];
  matchedBy: 'fuzzyTitleDate';
  winnerTitle?: string;
  incomingTitle?: string;
  note?: string;
}

export interface FuzzyDedupeReviewState {
  accepted: FuzzyDedupeAcceptEntry[];
  rejected: FuzzyDedupeRejectEntry[];
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
  fuzzyDuplicatesCollapsed: number;
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
  stage: 'fetch' | 'validate';
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
  normalizedArticles?: CanonicalArticle[];
  retainedArticles?: PublicArticleSummary[];
  logger?: PipelineLogger;
  fetchImpl?: typeof fetch;
  disableFuzzyDedupe?: boolean;
  fuzzyAuditPath?: string;
  fuzzyHandoffPath?: string;
  fuzzyRejectPath?: string;
  fuzzyAcceptPath?: string;
  fuzzyReviewStatePath?: string;
  fuzzyReviewHtmlPath?: string;
  fuzzyRejectEntries?: FuzzyDedupeRejectEntry[];
  fuzzyAcceptEntries?: FuzzyDedupeAcceptEntry[];
}
