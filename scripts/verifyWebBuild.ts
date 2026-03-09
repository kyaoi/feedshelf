const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'feedshelf-web-build-'),
  );

  try {
    const tscCommand = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
    execFileSync(tscCommand, ['-p', 'tsconfig.web.json', '--outDir', tempDir], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    const expectedPath = path.join(rootDir, 'public/assets/app.js');
    const actualPath = path.join(tempDir, 'app.js');
    const [expected, actual] = await Promise.all([
      fs.readFile(expectedPath, 'utf8'),
      fs.readFile(actualPath, 'utf8'),
    ]);

    if (expected !== actual) {
      throw new Error(
        'public/assets/app.js is out of date. Run `pnpm run build:web-ui` and commit the regenerated asset.',
      );
    }

    console.log('[verify:web-ui] OK');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error('[verify:web-ui] failed', error);
  process.exit(1);
});
