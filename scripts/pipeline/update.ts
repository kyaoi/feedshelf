import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  ArticleProvenanceEntry,
  ArticleProvenanceMatchedBy,
  CanonicalArticle,
  FeedDefinition,
  FeedDocumentInput,
  FeedFetchFailure,
  PipelineLogger,
  PublicArticleSummary,
  UpdatePipelineSummary,
  UpdateSourceState,
  UpdateState,
} from '../../src/shared/contracts.ts';
import { dedupeArticlesWithSummary } from './dedupeArticles.ts';
import { loadFeeds } from './loadFeeds.ts';
import {
  applyCanonicalUrlPrecisionLayer,
  normalizeFeedDocument,
} from './normalizeFeed.ts';
import { runPipeline } from './run.ts';

const DEFAULT_SAFETY_WINDOW_HOURS = 72;
const PROVENANCE_MATCHED_BY_VALUES = new Set<ArticleProvenanceMatchedBy>([
  'primary',
  'normalizedUrl',
  'feedItem',
  'fuzzyTitleDate',
]);

function normalizeProvenanceEntries(
  value: unknown,
  fallbackFeedId?: string,
): ArticleProvenanceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: ArticleProvenanceEntry[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as Partial<ArticleProvenanceEntry>;
    const feedId =
      typeof candidate.feedId === 'string' && candidate.feedId !== ''
        ? candidate.feedId
        : fallbackFeedId;
    const firstSeenAt =
      typeof candidate.firstSeenAt === 'string' ? candidate.firstSeenAt : null;
    const lastSeenAt =
      typeof candidate.lastSeenAt === 'string' ? candidate.lastSeenAt : null;
    const matchedBy =
      typeof candidate.matchedBy === 'string' &&
      PROVENANCE_MATCHED_BY_VALUES.has(
        candidate.matchedBy as ArticleProvenanceMatchedBy,
      )
        ? (candidate.matchedBy as ArticleProvenanceMatchedBy)
        : null;

    if (
      typeof feedId !== 'string' ||
      feedId === '' ||
      firstSeenAt === null ||
      lastSeenAt === null ||
      matchedBy === null
    ) {
      continue;
    }

    normalized.push({
      feedId,
      firstSeenAt,
      lastSeenAt,
      sourceItemId:
        typeof candidate.sourceItemId === 'string'
          ? candidate.sourceItemId
          : null,
      matchedBy,
    });
  }

  return normalized;
}

function normalizeSourceState(
  fallbackFeedId: string,
  value: unknown,
): UpdateSourceState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<UpdateSourceState>;
  const feedId =
    typeof candidate.feedId === 'string' && candidate.feedId !== ''
      ? candidate.feedId
      : fallbackFeedId;
  const lastSuccessfulFetchAt =
    typeof candidate.lastSuccessfulFetchAt === 'string'
      ? candidate.lastSuccessfulFetchAt
      : null;

  if (lastSuccessfulFetchAt === null) {
    return null;
  }

  return {
    feedId,
    checkpointArticleId:
      typeof candidate.checkpointArticleId === 'string'
        ? candidate.checkpointArticleId
        : null,
    checkpointSortAt:
      typeof candidate.checkpointSortAt === 'string'
        ? candidate.checkpointSortAt
        : null,
    lastSuccessfulFetchAt,
    provenance: normalizeProvenanceEntries(candidate.provenance, feedId),
  };
}

function cloneProvenanceEntries(
  provenance: ArticleProvenanceEntry[],
): ArticleProvenanceEntry[] {
  return provenance.map((entry) => ({
    feedId: entry.feedId,
    firstSeenAt: entry.firstSeenAt,
    lastSeenAt: entry.lastSeenAt,
    sourceItemId: entry.sourceItemId,
    matchedBy: entry.matchedBy,
  }));
}

export interface UpdatePipelineArgs {
  feedsPath: string;
  shelvesPath: string;
  outputDir: string;
  dryRun: boolean;
  disableFuzzyDedupe: boolean;
}

export interface RunUpdatePipelineOptions
  extends Omit<UpdatePipelineArgs, 'disableFuzzyDedupe'> {
  disableFuzzyDedupe?: boolean;
  logger?: PipelineLogger;
  fetchImpl?: typeof fetch;
  generatedAt?: string;
  statePath?: string;
  safetyWindowHours?: number;
}

export interface FeedFetchOptions {
  fetchImpl?: typeof fetch;
  fetchedAt?: string;
}

export function parseUpdateArgs(argv: string[]): UpdatePipelineArgs {
  const args: UpdatePipelineArgs = {
    feedsPath: path.resolve(process.cwd(), 'data/feeds.json'),
    shelvesPath: path.resolve(process.cwd(), 'data/shelves.yaml'),
    outputDir: path.resolve(process.cwd(), 'public/data'),
    dryRun: false,
    disableFuzzyDedupe: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--feeds') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--feeds requires a path argument.');
      }
      args.feedsPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--shelves') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--shelves requires a path argument.');
      }
      args.shelvesPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--output-dir') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--output-dir requires a path argument.');
      }
      args.outputDir = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--disable-fuzzy-dedupe') {
      args.disableFuzzyDedupe = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export function resolveUpdateStatePath({
  outputDir,
  statePath,
}: {
  outputDir: string;
  statePath?: string;
}): string {
  return statePath
    ? path.resolve(process.cwd(), statePath)
    : path.join(outputDir, 'update-state.json');
}

export function selectEnabledFeeds(feeds: FeedDefinition[]): FeedDefinition[] {
  return feeds.filter((feed) => feed.enabled);
}

function resolveFetchImplementation(fetchImpl?: typeof fetch): typeof fetch {
  const candidate = fetchImpl || globalThis.fetch;
  if (typeof candidate !== 'function') {
    throw new Error('Fetch API is not available in this environment.');
  }
  return candidate;
}

export async function fetchFeedDocument(
  feed: FeedDefinition,
  options: FeedFetchOptions = {},
): Promise<FeedDocumentInput> {
  const fetcher = resolveFetchImplementation(options.fetchImpl);
  const fetchedAt = new Date(options.fetchedAt || Date.now()).toISOString();
  const response = await fetcher(feed.feedUrl, {
    headers: {
      accept:
        'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
      'user-agent': 'FeedShelf/0.1 (+https://github.com/kyaoi/feedshelf)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${feed.feedUrl}`);
  }

  return {
    feedId: feed.id,
    xml: await response.text(),
    fetchedAt,
  };
}

export function shouldPublishFromFetchedDocuments({
  enabledFeeds,
  feedDocuments,
}: {
  enabledFeeds: FeedDefinition[];
  feedDocuments: FeedDocumentInput[];
}): { ok: true } | { ok: false; reason: string } {
  if (enabledFeeds.length === 0) {
    return {
      ok: false,
      reason: 'No enabled feeds are configured.',
    };
  }

  if (feedDocuments.length === 0) {
    return {
      ok: false,
      reason: 'No feed documents were publishable after fetch and validation.',
    };
  }

  return { ok: true };
}

function formatFeedFailure(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: string }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return 'Unknown feed processing error';
}

interface ValidateFetchedFeedDocumentsResult {
  publishableFeedDocuments: FeedDocumentInput[];
  failedFetches: FeedFetchFailure[];
}

export function validateFetchedFeedDocuments({
  feeds,
  feedDocuments,
  logger = console,
}: {
  feeds: FeedDefinition[];
  feedDocuments: FeedDocumentInput[];
  logger?: PipelineLogger;
}): ValidateFetchedFeedDocumentsResult {
  const feedMap = new Map<string, FeedDefinition>(
    feeds.map((feed) => [feed.id, feed]),
  );
  const publishableFeedDocuments: FeedDocumentInput[] = [];
  const failedFetches: FeedFetchFailure[] = [];

  for (const document of feedDocuments) {
    const feed = feedMap.get(document.feedId);

    if (!feed) {
      const message = `Unknown feedId in feedDocuments: ${document.feedId}`;
      failedFetches.push({
        feedId: document.feedId,
        feedUrl: '(unknown)',
        stage: 'validate',
        message,
      });
      logger.log(`[update] source-failed ${document.feedId} ${message}`);
      continue;
    }

    try {
      normalizeFeedDocument({
        feed,
        xml: document.xml,
        fetchedAt: document.fetchedAt,
      });
      publishableFeedDocuments.push(document);
    } catch (error) {
      const message = formatFeedFailure(error);
      failedFetches.push({
        feedId: feed.id,
        feedUrl: feed.feedUrl,
        stage: 'validate',
        message,
      });
      logger.log(`[update] source-failed ${feed.id} ${message}`);
    }
  }

  return {
    publishableFeedDocuments,
    failedFetches,
  };
}

interface FetchEnabledFeedDocumentsResult {
  feeds: FeedDefinition[];
  enabledFeeds: FeedDefinition[];
  feedDocuments: FeedDocumentInput[];
  failedFetches: FeedFetchFailure[];
}

export async function fetchEnabledFeedDocuments({
  feedsPath,
  logger = console,
  fetchImpl,
  generatedAt,
}: {
  feedsPath: string;
  logger?: PipelineLogger;
  fetchImpl?: typeof fetch;
  generatedAt?: string;
}): Promise<FetchEnabledFeedDocumentsResult> {
  const feeds = await loadFeeds(feedsPath);
  const enabledFeeds = selectEnabledFeeds(feeds);
  const feedDocuments: FeedDocumentInput[] = [];
  const failedFetches: FeedFetchFailure[] = [];

  logger.log(`[update] feeds=${feeds.length} enabled=${enabledFeeds.length}`);

  for (const feed of enabledFeeds) {
    try {
      const document = await fetchFeedDocument(feed, {
        fetchImpl,
        fetchedAt: generatedAt,
      });
      feedDocuments.push(document);
      logger.log(`[update] source-ok ${feed.id}`);
    } catch (error) {
      const message = formatFeedFailure(error);
      failedFetches.push({
        feedId: feed.id,
        feedUrl: feed.feedUrl,
        stage: 'fetch',
        message,
      });
      logger.log(`[update] source-failed ${feed.id} ${message}`);
    }
  }

  return {
    feeds,
    enabledFeeds,
    feedDocuments,
    failedFetches,
  };
}

export async function loadUpdateState(
  statePath: string,
): Promise<UpdateState | null> {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<UpdateState>;
    if (
      parsed.version !== 1 ||
      typeof parsed.sources !== 'object' ||
      !parsed.sources
    ) {
      return null;
    }
    const normalizedSources: Record<string, UpdateSourceState> = {};

    for (const [feedId, sourceState] of Object.entries(parsed.sources)) {
      const normalizedState = normalizeSourceState(feedId, sourceState);
      if (normalizedState) {
        normalizedSources[feedId] = normalizedState;
      }
    }

    return {
      version: 1,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date(0).toISOString(),
      safetyWindowHours:
        typeof parsed.safetyWindowHours === 'number' &&
        parsed.safetyWindowHours > 0
          ? parsed.safetyWindowHours
          : DEFAULT_SAFETY_WINDOW_HOURS,
      sources: normalizedSources,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function loadRetainedPublicArticles(
  outputDir: string,
): Promise<PublicArticleSummary[]> {
  try {
    const raw = await fs.readFile(
      path.join(outputDir, 'articles.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PublicArticleSummary[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function subtractHours(isoTimestamp: string, hours: number): number {
  return new Date(isoTimestamp).getTime() - hours * 60 * 60 * 1000;
}

function articleSortTimestamp(article: CanonicalArticle): number {
  return new Date(article.publishedAt || article.fetchedAt).getTime();
}

export function filterFreshArticlesByCheckpoint({
  articles,
  checkpoint,
  safetyWindowHours,
}: {
  articles: CanonicalArticle[];
  checkpoint: UpdateSourceState | null;
  safetyWindowHours: number;
}): CanonicalArticle[] {
  if (!checkpoint || !checkpoint.checkpointSortAt) {
    return articles;
  }

  const threshold = subtractHours(
    checkpoint.checkpointSortAt,
    safetyWindowHours,
  );
  return articles.filter(
    (article) => articleSortTimestamp(article) >= threshold,
  );
}

export function buildNextUpdateState({
  previousState,
  freshArticles,
  generatedAt,
  safetyWindowHours,
}: {
  previousState: UpdateState | null;
  freshArticles: CanonicalArticle[];
  generatedAt: string;
  safetyWindowHours: number;
}): UpdateState {
  const nextSources: Record<string, UpdateSourceState> = Object.fromEntries(
    Object.entries(previousState?.sources || {}).map(
      ([feedId, sourceState]) => [
        feedId,
        {
          ...sourceState,
          provenance: cloneProvenanceEntries(sourceState.provenance || []),
        },
      ],
    ),
  );
  const freshByFeed = new Map<
    string,
    Array<{ article: CanonicalArticle; provenance: ArticleProvenanceEntry }>
  >();

  for (const article of freshArticles) {
    const provenanceEntries =
      Array.isArray(article.provenance) && article.provenance.length > 0
        ? article.provenance
        : [
            {
              feedId: article.feedId,
              firstSeenAt: article.fetchedAt,
              lastSeenAt: article.fetchedAt,
              sourceItemId: article.sourceItemId,
              matchedBy: 'primary' as const,
            },
          ];

    for (const provenance of provenanceEntries) {
      const existing = freshByFeed.get(provenance.feedId) || [];
      existing.push({ article, provenance });
      freshByFeed.set(provenance.feedId, existing);
    }
  }

  for (const [feedId, feedArticles] of freshByFeed.entries()) {
    const latest = [...feedArticles].sort((left, right) => {
      const timeOrder =
        articleSortTimestamp(right.article) -
        articleSortTimestamp(left.article);
      if (timeOrder !== 0) {
        return timeOrder;
      }

      const seenOrder =
        new Date(right.provenance.lastSeenAt).getTime() -
        new Date(left.provenance.lastSeenAt).getTime();
      if (seenOrder !== 0) {
        return seenOrder;
      }

      return right.article.id.localeCompare(left.article.id, 'en');
    })[0];

    nextSources[feedId] = {
      feedId,
      checkpointArticleId: latest?.article.id || null,
      checkpointSortAt: latest
        ? new Date(
            latest.article.publishedAt || latest.article.fetchedAt,
          ).toISOString()
        : null,
      lastSuccessfulFetchAt: generatedAt,
      provenance: latest
        ? cloneProvenanceEntries(latest.article.provenance)
        : [],
    };
  }

  return {
    version: 1,
    updatedAt: generatedAt,
    safetyWindowHours,
    sources: nextSources,
  };
}

export async function writeUpdateState({
  statePath,
  state,
}: {
  statePath: string;
  state: UpdateState;
}): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

export async function runUpdatePipeline(
  options: RunUpdatePipelineOptions,
): Promise<UpdatePipelineSummary> {
  const logger = options.logger || console;
  const generatedAt = new Date(options.generatedAt || Date.now()).toISOString();
  const statePath = resolveUpdateStatePath({
    outputDir: options.outputDir,
    statePath: options.statePath,
  });
  const safetyWindowHours =
    options.safetyWindowHours || DEFAULT_SAFETY_WINDOW_HOURS;
  const previousState = await loadUpdateState(statePath);
  const retainedArticles = await loadRetainedPublicArticles(options.outputDir);
  const fetched = await fetchEnabledFeedDocuments({
    feedsPath: options.feedsPath,
    logger,
    fetchImpl: options.fetchImpl,
    generatedAt,
  });
  const validated = validateFetchedFeedDocuments({
    feeds: fetched.feeds,
    feedDocuments: fetched.feedDocuments,
    logger,
  });
  const publishDecision = shouldPublishFromFetchedDocuments({
    enabledFeeds: fetched.enabledFeeds,
    feedDocuments: validated.publishableFeedDocuments,
  });

  if (!publishDecision.ok) {
    throw new Error(publishDecision.reason);
  }

  const feedMap = new Map(fetched.feeds.map((feed) => [feed.id, feed]));
  const filteredFreshArticles: CanonicalArticle[] = [];

  for (const document of validated.publishableFeedDocuments) {
    const feed = feedMap.get(document.feedId);
    if (!feed) {
      continue;
    }
    const normalizedArticles = normalizeFeedDocument({
      feed,
      xml: document.xml,
      fetchedAt: document.fetchedAt,
    });
    const freshArticles = filterFreshArticlesByCheckpoint({
      articles: normalizedArticles,
      checkpoint: previousState?.sources[feed.id] || null,
      safetyWindowHours,
    });
    filteredFreshArticles.push(...freshArticles);
  }

  const canonicalizedFreshArticles = await applyCanonicalUrlPrecisionLayer({
    articles: filteredFreshArticles,
    fetchImpl: options.fetchImpl || globalThis.fetch,
  });
  const dedupeResult = dedupeArticlesWithSummary(canonicalizedFreshArticles, {
    disableFuzzyDedupe: options.disableFuzzyDedupe,
  });
  const dedupedFreshArticles = dedupeResult.articles;
  const summary = await runPipeline({
    feedsPath: options.feedsPath,
    shelvesPath: options.shelvesPath,
    outputDir: options.outputDir,
    dryRun: options.dryRun,
    generatedAt,
    normalizedArticles: canonicalizedFreshArticles,
    retainedArticles,
    logger,
    disableFuzzyDedupe: options.disableFuzzyDedupe,
  });

  if (options.disableFuzzyDedupe) {
    logger.log('[update] fuzzy dedupe disabled; exact dedupe only.');
  }

  if (!options.dryRun) {
    await writeUpdateState({
      statePath,
      state: buildNextUpdateState({
        previousState,
        freshArticles: dedupedFreshArticles,
        generatedAt: summary.generatedAt,
        safetyWindowHours,
      }),
    });
  }

  return {
    ...summary,
    attemptedFeeds: fetched.enabledFeeds.length,
    fetchedDocuments: validated.publishableFeedDocuments.length,
    failedFeeds: fetched.failedFetches.length + validated.failedFetches.length,
    failedFetches: [...fetched.failedFetches, ...validated.failedFetches],
  };
}

export async function main(
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const args = parseUpdateArgs(argv);
  await runUpdatePipeline(args);
}

function isDirectExecution(): boolean {
  return (
    typeof process.argv[1] === 'string' &&
    path.resolve(process.argv[1]) ===
      path.resolve(process.cwd(), 'scripts/pipeline/update.ts')
  );
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    console.error('[update] failed', error);
    process.exit(1);
  });
}
