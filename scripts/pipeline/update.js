const runtime = require('./update.ts');

if (require.main === module) {
  runtime.main().catch((error) => {
    console.error('[update] failed', error);
    process.exit(1);
  });
}

module.exports = runtime;
