const path = require('node:path');
const { loadFeeds } = require('./loadFeeds');

function parseArgs(argv) {
  const args = {
    feedsPath: path.resolve(process.cwd(), 'data/feeds.json'),
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

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function runPipeline(options = {}) {
  const feedsPath = options.feedsPath || path.resolve(process.cwd(), 'data/feeds.json');
  const logger = options.logger || console;
  const feeds = await loadFeeds(feedsPath);
  const enabledFeeds = feeds.filter((feed) => feed.enabled);
  const summary = {
    feedsPath,
    totalFeeds: feeds.length,
    enabledFeeds: enabledFeeds.length,
  };

  logger.log(
    `[pipeline] feeds=${summary.totalFeeds} enabled=${summary.enabledFeeds} feedsPath=${path.relative(process.cwd(), feedsPath) || 'data/feeds.json'}`,
  );

  if (options.dryRun) {
    logger.log('[pipeline] dry-run: fetch/normalize/export steps are not implemented yet.');
  }

  logger.log('[pipeline] FS-PIPE-01 entrypoint ready');

  return summary;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  await runPipeline(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[pipeline] failed', error);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  runPipeline,
};
