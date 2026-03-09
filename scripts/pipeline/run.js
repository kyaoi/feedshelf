const runtime = require('./run.ts');

if (require.main === module) {
  runtime.main().catch((error) => {
    console.error('[pipeline] failed', error);
    process.exit(1);
  });
}

module.exports = runtime;
