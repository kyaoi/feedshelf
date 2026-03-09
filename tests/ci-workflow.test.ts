const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readWorkflow(): string {
  return fs.readFileSync(
    path.resolve(__dirname, '..', '.github/workflows/ci.yml'),
    'utf8',
  );
}

test('CI workflow keeps routine quality checks separate from update and deploy flow', () => {
  const workflow = readWorkflow();

  assert.match(workflow, /^name: CI/m);
  assert.match(workflow, /push:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.match(workflow, /quality-gate:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /corepack enable/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm run ci/);

  assert.doesNotMatch(workflow, /actions\/configure-pages@v5/);
  assert.doesNotMatch(workflow, /pnpm run pipeline:update/);
  assert.doesNotMatch(workflow, /actions\/upload-pages-artifact@v4/);
  assert.doesNotMatch(workflow, /actions\/deploy-pages@v4/);
});
