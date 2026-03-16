const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

test('responsive article grid and stable typography stay aligned with docs and PLAN', () => {
  const styles = read('public/assets/styles.css');
  const traceability = read('docs/TRACEABILITY.md');
  const plan = read('PLAN.md');

  assert.match(
    styles,
    /\.article-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 1180px\)\s*\{[\s\S]*\.article-list\s*\{[\s\S]*repeat\(3, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 980px\)\s*\{[\s\S]*\.article-list\s*\{[\s\S]*repeat\(2, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 760px\)\s*\{[\s\S]*\.article-list\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
  );
  assert.match(
    styles,
    /\.article-card__title\s*\{[\s\S]*font-size:\s*1\.08rem;/,
  );
  assert.doesNotMatch(
    styles,
    /\.article-card__title\s*\{[\s\S]*font-size:\s*clamp\(/,
  );
  assert.match(
    styles,
    /\.article-card__title a,[\s\S]*-webkit-line-clamp:\s*3;/,
  );
  assert.match(
    styles,
    /\.article-card__summary\s*\{[\s\S]*-webkit-line-clamp:\s*4;/,
  );

  assert.match(traceability, /FS-145/);
  assert.match(traceability, /public\/assets\/styles\.css/);
  assert.match(traceability, /tests\/web-layout\.test\.ts/);
  assert.match(plan, /\[x\] `FS-UX-21`/);
  assert.match(plan, /\[ \] `FS-QA-11`/);
});
