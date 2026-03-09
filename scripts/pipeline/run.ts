import path from 'node:path';

import type {
  FeedDefinition,
  PipelineArgs,
  PipelineLogger,
  PipelineSummary,
  RunPipelineOptions,
} from '../../src/shared/contracts.ts';
import { buildPublicExports, writePublicExports } from './buildPublicExports.ts';
import { dedupeArticles } from './dedupeArticles.ts';
import { loadFeeds } from './loadFeeds.ts';
import { normalizeFeedDocument } from './normalizeFeed.ts';

export function parseArgs(argv: string[]): PipelineArgs {
  const args: PipelineArgs = {
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

export async function runPipeline(options: RunPipelineOptions = {}): Promise<PipelineSummary> {
  const feedsPath = options.feedsPath || path.resolve(process.cwd(), 'data/feeds.json');
  const outputDir = options.outputDir || path.resolve(process.cwd(), 'public/data');
  const logger: PipelineLogger = options.logger || console;
  const feeds = await loadFeeds(feedsPath);
  const enabledFeeds = feeds.filter((feed) => feed.enabled);
  const feedDocuments = Array.isArray(options.feedDocuments) ? options.feedDocuments : [];
  const feedMap = new Map<string, FeedDefinition>(feeds.map((feed) => [feed.id, feed]));
  const articles = [];

  for (const document of feedDocuments) {
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

  const dedupedArticles = dedupeArticles(articles);
  const publicExports = buildPublicExports({
    articles: dedupedArticles,
    feeds,
    generatedAt: options.generatedAt || new Date().toISOString(),
  });

  if (!options.dryRun) {
    await writePublicExports({
      outputDir,
      publicExports,
    });
  }

  const summary: PipelineSummary = {
    feedsPath,
    outputDir,
    generatedAt: publicExports.meta.generatedAt,
    totalFeeds: feeds.length,
    enabledFeeds: enabledFeeds.length,
    normalizedArticles: articles.length,
    dedupedArticles: dedupedArticles.length,
    duplicatesCollapsed: articles.length - dedupedArticles.length,
    publicArticles: publicExports.meta.articleCount,
    publicCategories: publicExports.meta.categoryCount,
    publicSources: publicExports.meta.sourceCount,
  };

  logger.log(
    `[pipeline] feeds=${summary.totalFeeds} enabled=${summary.enabledFeeds} feedsPath=${path.relative(process.cwd(), feedsPath) || 'data/feeds.json'}`,
  );

  if (articles.length > 0) {
    logger.log(`[pipeline] normalizedArticles=${articles.length}`);
    logger.log(`[pipeline] dedupedArticles=${dedupedArticles.length} duplicatesCollapsed=${summary.duplicatesCollapsed}`);
  }

  logger.log(
    `[pipeline] publicArticles=${summary.publicArticles} publicCategories=${summary.publicCategories} publicSources=${summary.publicSources} outputDir=${path.relative(process.cwd(), outputDir) || 'public/data'}`,
  );

  if (options.dryRun) {
    logger.log('[pipeline] dry-run: public JSON was generated in-memory and not written to disk.');
  }

  logger.log('[pipeline] FS-PIPE-04 public JSON ready');

  return summary;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  await runPipeline(args);
}
