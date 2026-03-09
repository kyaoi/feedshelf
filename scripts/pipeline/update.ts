import path from 'node:path';

import type {
  FeedDefinition,
  FeedDocumentInput,
  PipelineLogger,
  PipelineSummary,
} from '../../src/shared/contracts.ts';
import { loadFeeds } from './loadFeeds.ts';
import { runPipeline } from './run.ts';

export interface UpdatePipelineArgs {
  feedsPath: string;
  outputDir: string;
  dryRun: boolean;
}

export interface FetchFeedDocumentOptions {
  fetchedAt?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface RunUpdatePipelineOptions extends UpdatePipelineArgs {
  generatedAt?: string;
  logger?: PipelineLogger;
  fetchImpl?: typeof fetch;
}

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const FEED_ACCEPT_HEADER = 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1';
const FEED_USER_AGENT = 'FeedShelf/0.1 (+https://github.com/kyaoi/feedshelf)';

export function parseUpdateArgs(argv: string[]): UpdatePipelineArgs {
  const args: UpdatePipelineArgs = {
    feedsPath: path.resolve(process.cwd(), 'data/feeds.json'),
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

export async function fetchFeedDocument(
  feed: FeedDefinition,
  options: FetchFeedDocumentOptions = {},
): Promise<FeedDocumentInput> {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchFeedDocument requires a fetch implementation.');
  }

  const response = await fetchImpl(feed.feedUrl, {
    headers: {
      accept: FEED_ACCEPT_HEADER,
      'user-agent': FEED_USER_AGENT,
    },
    signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Feed ${feed.id} fetch failed: ${response.status} ${response.statusText}`.trim());
  }

  const xml = await response.text();
  if (xml.trim() === '') {
    throw new Error(`Feed ${feed.id} returned an empty document.`);
  }

  return {
    feedId: feed.id,
    xml,
    fetchedAt: new Date(options.fetchedAt || Date.now()).toISOString(),
  };
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
}): Promise<{ feeds: FeedDefinition[]; enabledFeeds: FeedDefinition[]; feedDocuments: FeedDocumentInput[] }> {
  const feeds = await loadFeeds(feedsPath);
  const enabledFeeds = selectEnabledFeeds(feeds);
  const feedDocuments: FeedDocumentInput[] = [];

  logger.log(`[update] feeds=${feeds.length} enabled=${enabledFeeds.length}`);

  for (const feed of enabledFeeds) {
    logger.log(`[update] fetching ${feed.id} ${feed.feedUrl}`);
    const document = await fetchFeedDocument(feed, {
      fetchImpl,
      fetchedAt: generatedAt,
    });
    feedDocuments.push(document);
  }

  return {
    feeds,
    enabledFeeds,
    feedDocuments,
  };
}

export async function runUpdatePipeline(options: RunUpdatePipelineOptions): Promise<PipelineSummary> {
  const logger: PipelineLogger = options.logger || console;
  const generatedAt = new Date(options.generatedAt || Date.now()).toISOString();
  const { feedDocuments } = await fetchEnabledFeedDocuments({
    feedsPath: options.feedsPath,
    logger,
    fetchImpl: options.fetchImpl,
    generatedAt,
  });

  const summary = await runPipeline({
    feedsPath: options.feedsPath,
    outputDir: options.outputDir,
    dryRun: options.dryRun,
    feedDocuments,
    generatedAt,
    logger,
  });

  logger.log(`[update] fetchedDocuments=${feedDocuments.length}`);
  logger.log('[update] FS-OPS-01 workflow-ready public data prepared');

  return summary;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseUpdateArgs(argv);
  await runUpdatePipeline(args);
}
