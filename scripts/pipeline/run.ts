import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  CanonicalArticle,
  FeedDefinition,
  FuzzyDedupeAuditRecord,
  FuzzyDedupeHandoffRecord,
  PipelineArgs,
  PipelineLogger,
  PipelineSummary,
  RunPipelineOptions,
  ShelvesDocument,
} from '../../src/shared/contracts.ts';
import {
  buildPublicExports,
  buildPublicExportsFromPublicArticles,
  mergePublicArticleSummaries,
  writePublicExports,
} from './buildPublicExports.ts';
import { dedupeArticlesWithSummary } from './dedupeArticles.ts';
import { loadFeeds } from './loadFeeds.ts';
import { loadShelves } from './loadShelves.ts';
import {
  applyCanonicalUrlPrecisionLayer,
  normalizeFeedDocument,
} from './normalizeFeed.ts';

function validateFeedShelfReferences(
  feeds: FeedDefinition[],
  shelves: ShelvesDocument,
): void {
  const shelfIds = new Set(shelves.shelves.map((shelf) => shelf.id));

  for (const feed of feeds) {
    for (const shelfId of feed.shelfIds) {
      if (!shelfIds.has(shelfId)) {
        throw new Error(
          `Unknown shelfId referenced by feed ${feed.id}: ${shelfId}`,
        );
      }
    }
  }
}

export function parseArgs(argv: string[]): PipelineArgs {
  const args: PipelineArgs = {
    feedsPath: path.resolve(process.cwd(), 'data/feeds.json'),
    shelvesPath: path.resolve(process.cwd(), 'data/shelves.yaml'),
    outputDir: path.resolve(process.cwd(), 'public/data'),
    dryRun: false,
    disableFuzzyDedupe: false,
    fuzzyAuditPath: null,
    fuzzyHandoffPath: null,
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

    if (arg === '--fuzzy-audit-file') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--fuzzy-audit-file requires a path argument.');
      }
      args.fuzzyAuditPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--fuzzy-handoff-file') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--fuzzy-handoff-file requires a path argument.');
      }
      args.fuzzyHandoffPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function writeJsonArtifact({
  artifactPath,
  logger,
  records,
  label,
}: {
  artifactPath: string;
  logger: PipelineLogger;
  records: readonly unknown[];
  label: string;
}): Promise<void> {
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(records, null, 2)}\n`);
  logger.log(
    `[pipeline] ${label}=${records.length} path=${path.relative(process.cwd(), artifactPath) || artifactPath}`,
  );
}

async function writeFuzzyAuditFile({
  fuzzyAuditPath,
  logger,
  records,
}: {
  fuzzyAuditPath: string;
  logger: PipelineLogger;
  records: FuzzyDedupeAuditRecord[];
}): Promise<void> {
  await writeJsonArtifact({
    artifactPath: fuzzyAuditPath,
    logger,
    records,
    label: 'fuzzy audit records',
  });
}

async function writeFuzzyHandoffFile({
  fuzzyHandoffPath,
  logger,
  records,
}: {
  fuzzyHandoffPath: string;
  logger: PipelineLogger;
  records: FuzzyDedupeHandoffRecord[];
}): Promise<void> {
  await writeJsonArtifact({
    artifactPath: fuzzyHandoffPath,
    logger,
    records,
    label: 'fuzzy handoff records',
  });
}

async function normalizeFeedDocumentsToArticles({
  feedDocuments,
  feeds,
  fetchImpl,
}: {
  feedDocuments: RunPipelineOptions['feedDocuments'];
  feeds: FeedDefinition[];
  fetchImpl?: typeof fetch;
}): Promise<CanonicalArticle[]> {
  const documents = Array.isArray(feedDocuments) ? feedDocuments : [];
  const feedMap = new Map<string, FeedDefinition>(
    feeds.map((feed) => [feed.id, feed]),
  );
  const articles: CanonicalArticle[] = [];

  for (const document of documents) {
    const feed = feedMap.get(document.feedId);
    if (!feed) {
      throw new Error(`Unknown feedId in feedDocuments: ${document.feedId}`);
    }

    articles.push(
      ...normalizeFeedDocument({
        feed,
        xml: document.xml,
        fetchedAt: document.fetchedAt,
      }),
    );
  }

  return applyCanonicalUrlPrecisionLayer({
    articles,
    fetchImpl,
  });
}

export async function runPipeline(
  options: RunPipelineOptions = {},
): Promise<PipelineSummary> {
  const feedsPath =
    options.feedsPath || path.resolve(process.cwd(), 'data/feeds.json');
  const shelvesPath =
    options.shelvesPath || path.resolve(process.cwd(), 'data/shelves.yaml');
  const outputDir =
    options.outputDir || path.resolve(process.cwd(), 'public/data');
  const logger: PipelineLogger = options.logger || console;
  const feeds = await loadFeeds(feedsPath);
  const shelves = await loadShelves(shelvesPath);
  validateFeedShelfReferences(feeds, shelves);

  const enabledFeeds = feeds.filter((feed) => feed.enabled);
  const normalizedArticles = Array.isArray(options.normalizedArticles)
    ? options.normalizedArticles
    : await normalizeFeedDocumentsToArticles({
        feedDocuments: options.feedDocuments,
        feeds,
        fetchImpl: options.fetchImpl,
      });
  const dedupeResult = dedupeArticlesWithSummary(normalizedArticles, {
    disableFuzzyDedupe: options.disableFuzzyDedupe,
  });
  if (typeof options.fuzzyAuditPath === 'string') {
    await writeFuzzyAuditFile({
      fuzzyAuditPath: path.resolve(process.cwd(), options.fuzzyAuditPath),
      logger,
      records: dedupeResult.fuzzyAuditRecords,
    });
  }
  if (typeof options.fuzzyHandoffPath === 'string') {
    await writeFuzzyHandoffFile({
      fuzzyHandoffPath: path.resolve(process.cwd(), options.fuzzyHandoffPath),
      logger,
      records: dedupeResult.fuzzyHandoffRecords,
    });
  }
  const dedupedArticles = dedupeResult.articles;
  const freshPublicExports = buildPublicExports({
    articles: dedupedArticles,
    feeds,
    shelves,
    generatedAt: options.generatedAt || new Date().toISOString(),
  });
  const retainedArticles = Array.isArray(options.retainedArticles)
    ? options.retainedArticles
    : [];
  const mergedArticles = mergePublicArticleSummaries({
    retainedArticles,
    freshArticles: freshPublicExports.articles,
  });
  const publicExports = buildPublicExportsFromPublicArticles({
    articles: mergedArticles,
    feeds,
    shelves,
    generatedAt: freshPublicExports.meta.generatedAt,
  });

  if (!options.dryRun) {
    await writePublicExports({
      outputDir,
      publicExports,
      shelvesDocument: shelves,
    });
  }

  const summary: PipelineSummary = {
    feedsPath,
    shelvesPath,
    outputDir,
    generatedAt: publicExports.meta.generatedAt,
    totalFeeds: feeds.length,
    enabledFeeds: enabledFeeds.length,
    normalizedArticles: normalizedArticles.length,
    dedupedArticles: dedupedArticles.length,
    duplicatesCollapsed: normalizedArticles.length - dedupedArticles.length,
    fuzzyDuplicatesCollapsed: dedupeResult.fuzzyDuplicatesCollapsed,
    publicArticles: publicExports.meta.articleCount,
    publicShelves: publicExports.meta.shelfCount,
    publicCategories: publicExports.meta.categoryCount,
    publicSources: publicExports.meta.sourceCount,
    publicTags: publicExports.meta.tagCount,
    publicSearchIndex: publicExports.meta.searchIndexCount,
  };

  logger.log(
    `[pipeline] feeds=${summary.totalFeeds} enabled=${summary.enabledFeeds} feedsPath=${path.relative(process.cwd(), feedsPath) || 'data/feeds.json'} shelvesPath=${path.relative(process.cwd(), shelvesPath) || 'data/shelves.yaml'}`,
  );

  if (normalizedArticles.length > 0) {
    logger.log(`[pipeline] normalizedArticles=${normalizedArticles.length}`);
    logger.log(
      `[pipeline] dedupedArticles=${dedupedArticles.length} duplicatesCollapsed=${summary.duplicatesCollapsed} fuzzyDuplicatesCollapsed=${summary.fuzzyDuplicatesCollapsed}`,
    );
  }

  if (options.disableFuzzyDedupe) {
    logger.log('[pipeline] fuzzy dedupe disabled; exact dedupe only.');
  }

  logger.log(
    `[pipeline] publicArticles=${summary.publicArticles} publicShelves=${summary.publicShelves} publicCategories=${summary.publicCategories} publicSources=${summary.publicSources} publicTags=${summary.publicTags} publicSearchIndex=${summary.publicSearchIndex} outputDir=${path.relative(process.cwd(), outputDir) || 'public/data'}`,
  );

  if (options.dryRun) {
    logger.log(
      '[pipeline] dry-run: public JSON was generated in-memory and not written to disk.',
    );
  }

  logger.log('[pipeline] FS-PIPE-05 public JSON and page shards ready');

  return summary;
}

export async function main(
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const args = parseArgs(argv);
  await runPipeline({
    ...args,
    fuzzyAuditPath: args.fuzzyAuditPath ?? undefined,
    fuzzyHandoffPath: args.fuzzyHandoffPath ?? undefined,
  });
}

function isDirectExecution(): boolean {
  return (
    typeof process.argv[1] === 'string' &&
    path.resolve(process.argv[1]) ===
      path.resolve(process.cwd(), 'scripts/pipeline/run.ts')
  );
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    console.error('[pipeline] failed', error);
    process.exit(1);
  });
}
