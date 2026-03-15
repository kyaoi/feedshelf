import path from 'node:path';

import type {
  FeedDefinition,
  FeedDocumentInput,
  FeedFetchFailure,
  PipelineLogger,
  UpdatePipelineSummary,
} from '../../src/shared/contracts.ts';
import { loadFeeds } from './loadFeeds.ts';
import { normalizeFeedDocument } from './normalizeFeed.ts';
import { runPipeline } from './run.ts';

export interface UpdatePipelineArgs {
  feedsPath: string;
  shelvesPath: string;
  outputDir: string;
  dryRun: boolean;
}

export interface RunUpdatePipelineOptions extends UpdatePipelineArgs {
  logger?: PipelineLogger;
  fetchImpl?: typeof fetch;
  generatedAt?: string;
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
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
    logger.log(`[update] fetching ${feed.id} ${feed.feedUrl}`);

    try {
      const document = await fetchFeedDocument(feed, {
        fetchImpl,
        fetchedAt: generatedAt,
      });
      feedDocuments.push(document);
    } catch (error) {
      const message = formatFeedFailure(error);
      failedFetches.push({
        feedId: feed.id,
        feedUrl: feed.feedUrl,
        stage: 'fetch',
        message,
      });
      logger.log(`[update] fetch-failed ${feed.id} ${message}`);
    }
  }

  return {
    feeds,
    enabledFeeds,
    feedDocuments,
    failedFetches,
  };
}

export async function runUpdatePipeline(
  options: RunUpdatePipelineOptions,
): Promise<UpdatePipelineSummary> {
  const logger: PipelineLogger = options.logger || console;
  const generatedAt = new Date(options.generatedAt || Date.now()).toISOString();
  const {
    feeds,
    enabledFeeds,
    feedDocuments,
    failedFetches: fetchFailures,
  } = await fetchEnabledFeedDocuments({
    feedsPath: options.feedsPath,
    logger,
    fetchImpl: options.fetchImpl,
    generatedAt,
  });

  const { publishableFeedDocuments, failedFetches: validationFailures } =
    validateFetchedFeedDocuments({
      feeds,
      feedDocuments,
      logger,
    });
  const failedFetches = [...fetchFailures, ...validationFailures];

  const publishDecision = shouldPublishFromFetchedDocuments({
    enabledFeeds,
    feedDocuments: publishableFeedDocuments,
  });

  if (!publishDecision.ok) {
    logger.log(`[update] publish-skipped ${publishDecision.reason}`);
    throw new Error(publishDecision.reason);
  }

  const pipelineSummary = await runPipeline({
    feedsPath: options.feedsPath,
    shelvesPath: options.shelvesPath,
    outputDir: options.outputDir,
    dryRun: options.dryRun,
    feedDocuments: publishableFeedDocuments,
    generatedAt,
    logger,
  });

  const summary: UpdatePipelineSummary = {
    ...pipelineSummary,
    attemptedFeeds: enabledFeeds.length,
    fetchedDocuments: publishableFeedDocuments.length,
    failedFeeds: failedFetches.length,
    failedFetches,
  };

  logger.log(
    `[update] fetchedDocuments=${summary.fetchedDocuments} failedFeeds=${summary.failedFeeds}`,
  );
  if (summary.failedFeeds > 0) {
    const failedFeedIds = summary.failedFetches
      .map((failure) => failure.feedId)
      .join(', ');
    logger.log(
      `[update] partial-failure: continuing with fetched feeds only (${failedFeedIds})`,
    );
  }
  logger.log('[update] FS-OPS-03 partial failure policy applied');

  return summary;
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
