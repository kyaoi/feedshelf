import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  CanonicalArticle,
  FeedDefinition,
  FuzzyDedupeAcceptEntry,
  FuzzyDedupeAuditRecord,
  FuzzyDedupeHandoffRecord,
  FuzzyDedupeRejectEntry,
  FuzzyDedupeReviewState,
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
    fuzzyRejectPath: null,
    fuzzyAcceptPath: null,
    fuzzyReviewStatePath: null,
    fuzzyReviewHtmlPath: null,
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

    if (arg === '--fuzzy-reject-file') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--fuzzy-reject-file requires a path argument.');
      }
      args.fuzzyRejectPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--fuzzy-accept-file') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--fuzzy-accept-file requires a path argument.');
      }
      args.fuzzyAcceptPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--fuzzy-review-state-file') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--fuzzy-review-state-file requires a path argument.');
      }
      args.fuzzyReviewStatePath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--fuzzy-review-html-file') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--fuzzy-review-html-file requires a path argument.');
      }
      args.fuzzyReviewHtmlPath = path.resolve(process.cwd(), nextValue);
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

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type FuzzyReviewStatus = 'accepted' | 'rejected' | 'unreviewed';

function renderFuzzyReviewStatusBadge(status: FuzzyReviewStatus): string {
  return `<span class="status-badge status-badge--${status}">${escapeHtml(status)}</span>`;
}

function renderOptionalText(value: string | undefined): string {
  return typeof value === 'string' && value !== ''
    ? escapeHtml(value)
    : '<span class="muted">(none)</span>';
}

function renderOptionalLink(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function renderOptionalScopeKind(scopeKind: string | undefined): string {
  return typeof scopeKind === 'string' && scopeKind !== ''
    ? `<span class="meta-pill">scopeKind=${escapeHtml(scopeKind)}</span>`
    : '';
}

function renderArticleIdPair(articleIdPair: [string, string]): string {
  return `${escapeHtml(articleIdPair[0])} ↔ ${escapeHtml(articleIdPair[1])}`;
}

function buildFuzzyReviewStatusLookup(
  entries: { articleIdPair: [string, string]; matchedBy: 'fuzzyTitleDate' }[],
): Set<string> {
  return new Set(
    entries.map((entry) =>
      createFuzzyEntryMapKey({
        articleIdPair: canonicalizeArticleIdPair(entry.articleIdPair),
        matchedBy: entry.matchedBy,
      }),
    ),
  );
}

function resolveFuzzyReviewStatus({
  record,
  acceptedKeys,
  rejectedKeys,
}: {
  record: FuzzyDedupeHandoffRecord;
  acceptedKeys: Set<string>;
  rejectedKeys: Set<string>;
}): FuzzyReviewStatus {
  const key = createFuzzyEntryMapKey({
    articleIdPair: canonicalizeArticleIdPair([
      record.winnerArticleId,
      record.incomingArticleId,
    ]),
    matchedBy: record.matchedBy,
  });

  if (rejectedKeys.has(key)) {
    return 'rejected';
  }
  if (acceptedKeys.has(key)) {
    return 'accepted';
  }
  return 'unreviewed';
}

function renderFuzzyReviewCurrentRunSection({
  handoffRecords,
  acceptedKeys,
  rejectedKeys,
}: {
  handoffRecords: FuzzyDedupeHandoffRecord[];
  acceptedKeys: Set<string>;
  rejectedKeys: Set<string>;
}): string {
  if (handoffRecords.length === 0) {
    return `
      <section>
        <h2>Current-run fuzzy candidates</h2>
        <p class="empty-state">No current-run fuzzy handoff records.</p>
      </section>`;
  }

  return `
    <section>
      <h2>Current-run fuzzy candidates</h2>
      <div class="card-grid">
        ${handoffRecords
          .map((record) => {
            const status = resolveFuzzyReviewStatus({
              record,
              acceptedKeys,
              rejectedKeys,
            });
            return `
              <article class="review-card">
                <div class="review-card__header">
                  <div>
                    <h3>${renderFuzzyReviewStatusBadge(status)} ${escapeHtml(record.winnerTitle)} ↔ ${escapeHtml(record.incomingTitle)}</h3>
                    <p class="muted">${renderArticleIdPair([record.winnerArticleId, record.incomingArticleId])}</p>
                  </div>
                  <div class="meta-pills">
                    <span class="meta-pill">matchedBy=${escapeHtml(record.matchedBy)}</span>
                    ${renderOptionalScopeKind(record.scopeKind)}
                    <span class="meta-pill">Δ=${escapeHtml(record.publishedAtDeltaHours)}h</span>
                  </div>
                </div>
                <dl class="detail-list">
                  <div>
                    <dt>Winner</dt>
                    <dd>${renderOptionalLink(record.winnerUrl, record.winnerTitle)}</dd>
                  </div>
                  <div>
                    <dt>Incoming</dt>
                    <dd>${renderOptionalLink(record.incomingUrl, record.incomingTitle)}</dd>
                  </div>
                  <div>
                    <dt>Winner source</dt>
                    <dd>${escapeHtml(record.winnerSourceName)}</dd>
                  </div>
                  <div>
                    <dt>Incoming source</dt>
                    <dd>${escapeHtml(record.incomingSourceName)}</dd>
                  </div>
                </dl>
              </article>`;
          })
          .join('')}
      </div>
    </section>`;
}

function renderFuzzyReviewStateSection({
  title,
  status,
  entries,
}: {
  title: string;
  status: Exclude<FuzzyReviewStatus, 'unreviewed'>;
  entries: FuzzyDedupeAcceptEntry[] | FuzzyDedupeRejectEntry[];
}): string {
  if (entries.length === 0) {
    return `
      <section>
        <h2>${escapeHtml(title)}</h2>
        <p class="empty-state">No ${escapeHtml(status)} review-state entries.</p>
      </section>`;
  }

  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <div class="card-grid">
        ${entries
          .map(
            (entry) => `
              <article class="review-card review-card--compact">
                <div class="review-card__header">
                  <div>
                    <h3>${renderFuzzyReviewStatusBadge(status)} ${renderArticleIdPair(entry.articleIdPair)}</h3>
                    <p class="muted">matchedBy=${escapeHtml(entry.matchedBy)}</p>
                  </div>
                </div>
                <dl class="detail-list">
                  <div>
                    <dt>Winner title</dt>
                    <dd>${renderOptionalText(entry.winnerTitle)}</dd>
                  </div>
                  <div>
                    <dt>Incoming title</dt>
                    <dd>${renderOptionalText(entry.incomingTitle)}</dd>
                  </div>
                  <div>
                    <dt>Note</dt>
                    <dd>${renderOptionalText(entry.note)}</dd>
                  </div>
                </dl>
              </article>`,
          )
          .join('')}
      </div>
    </section>`;
}

function buildFuzzyReviewHtml({
  generatedAt,
  handoffRecords,
  reviewState,
}: {
  generatedAt: string;
  handoffRecords: FuzzyDedupeHandoffRecord[];
  reviewState: FuzzyDedupeReviewState;
}): string {
  const acceptedKeys = buildFuzzyReviewStatusLookup(reviewState.accepted);
  const rejectedKeys = buildFuzzyReviewStatusLookup(reviewState.rejected);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FeedShelf fuzzy review</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }
      body {
        margin: 0;
        background: #0f172a;
        color: #e2e8f0;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      a {
        color: inherit;
      }
      h1, h2, h3, p {
        margin-top: 0;
      }
      .lead {
        color: #cbd5e1;
        margin-bottom: 24px;
      }
      .summary-grid,
      .card-grid {
        display: grid;
        gap: 16px;
      }
      .summary-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        margin-bottom: 24px;
      }
      .summary-card,
      .review-card {
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.78);
        padding: 16px;
      }
      .summary-card strong {
        display: block;
        font-size: 1.35rem;
        margin-bottom: 4px;
      }
      .review-card__header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .meta-pills {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .meta-pill,
      .status-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 2px 10px;
        font-size: 0.8rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
      }
      .status-badge--accepted {
        background: rgba(34, 197, 94, 0.16);
      }
      .status-badge--rejected {
        background: rgba(248, 113, 113, 0.16);
      }
      .status-badge--unreviewed {
        background: rgba(250, 204, 21, 0.16);
      }
      .detail-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin: 0;
      }
      .detail-list div {
        min-width: 0;
      }
      .detail-list dt {
        color: #94a3b8;
        font-size: 0.85rem;
        margin-bottom: 4px;
      }
      .detail-list dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .muted,
      .empty-state {
        color: #94a3b8;
      }
      section + section {
        margin-top: 28px;
      }
      @media (max-width: 640px) {
        main {
          padding-inline: 14px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>FeedShelf fuzzy review</h1>
        <p class="lead">Read-only internal artifact for reviewing current-run fuzzy handoff evidence and explicit review state.</p>
      </header>
      <section>
        <div class="summary-grid">
          <article class="summary-card">
            <strong>${escapeHtml(generatedAt)}</strong>
            <span>Generated at</span>
          </article>
          <article class="summary-card">
            <strong>${escapeHtml(handoffRecords.length)}</strong>
            <span>Current-run candidates</span>
          </article>
          <article class="summary-card">
            <strong>${escapeHtml(reviewState.accepted.length)}</strong>
            <span>Accepted review-state entries</span>
          </article>
          <article class="summary-card">
            <strong>${escapeHtml(reviewState.rejected.length)}</strong>
            <span>Rejected review-state entries</span>
          </article>
        </div>
      </section>
      ${renderFuzzyReviewCurrentRunSection({
        handoffRecords,
        acceptedKeys,
        rejectedKeys,
      })}
      ${renderFuzzyReviewStateSection({
        title: 'Accepted review-state entries',
        status: 'accepted',
        entries: reviewState.accepted,
      })}
      ${renderFuzzyReviewStateSection({
        title: 'Rejected review-state entries',
        status: 'rejected',
        entries: reviewState.rejected,
      })}
    </main>
  </body>
</html>
`;
}

async function writeFuzzyReviewHtmlFile({
  fuzzyReviewHtmlPath,
  generatedAt,
  logger,
  handoffRecords,
  reviewState,
}: {
  fuzzyReviewHtmlPath: string;
  generatedAt: string;
  logger: PipelineLogger;
  handoffRecords: FuzzyDedupeHandoffRecord[];
  reviewState: FuzzyDedupeReviewState;
}): Promise<void> {
  await fs.mkdir(path.dirname(fuzzyReviewHtmlPath), { recursive: true });
  await fs.writeFile(
    fuzzyReviewHtmlPath,
    buildFuzzyReviewHtml({
      generatedAt,
      handoffRecords,
      reviewState,
    }),
  );
  logger.log(
    `[pipeline] fuzzy review html currentRun=${handoffRecords.length} accepted=${reviewState.accepted.length} rejected=${reviewState.rejected.length} path=${path.relative(process.cwd(), fuzzyReviewHtmlPath) || fuzzyReviewHtmlPath}`,
  );
}

function normalizeFuzzyRejectEntry(
  value: unknown,
): FuzzyDedupeRejectEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    articleIdPair?: unknown;
    matchedBy?: unknown;
    winnerTitle?: unknown;
    incomingTitle?: unknown;
    note?: unknown;
  };

  if (candidate.matchedBy !== 'fuzzyTitleDate') {
    return null;
  }

  if (
    !Array.isArray(candidate.articleIdPair) ||
    candidate.articleIdPair.length !== 2
  ) {
    return null;
  }

  const left = candidate.articleIdPair[0];
  const right = candidate.articleIdPair[1];
  if (
    typeof left !== 'string' ||
    left === '' ||
    typeof right !== 'string' ||
    right === ''
  ) {
    return null;
  }

  return {
    articleIdPair: [left, right],
    matchedBy: 'fuzzyTitleDate',
    ...(typeof candidate.winnerTitle === 'string'
      ? { winnerTitle: candidate.winnerTitle }
      : {}),
    ...(typeof candidate.incomingTitle === 'string'
      ? { incomingTitle: candidate.incomingTitle }
      : {}),
    ...(typeof candidate.note === 'string' ? { note: candidate.note } : {}),
  };
}

export async function loadFuzzyRejectEntries(
  fuzzyRejectPath?: string,
): Promise<FuzzyDedupeRejectEntry[]> {
  if (typeof fuzzyRejectPath !== 'string') {
    return [];
  }

  const raw = JSON.parse(await fs.readFile(fuzzyRejectPath, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error('--fuzzy-reject-file must point to a JSON array.');
  }

  return raw
    .map((entry) => normalizeFuzzyRejectEntry(entry))
    .filter((entry): entry is FuzzyDedupeRejectEntry => entry !== null);
}

function normalizeFuzzyAcceptEntry(
  value: unknown,
): FuzzyDedupeAcceptEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    articleIdPair?: unknown;
    matchedBy?: unknown;
    winnerTitle?: unknown;
    incomingTitle?: unknown;
    note?: unknown;
  };

  if (candidate.matchedBy !== 'fuzzyTitleDate') {
    return null;
  }

  if (
    !Array.isArray(candidate.articleIdPair) ||
    candidate.articleIdPair.length !== 2
  ) {
    return null;
  }

  const left = candidate.articleIdPair[0];
  const right = candidate.articleIdPair[1];
  if (
    typeof left !== 'string' ||
    left === '' ||
    typeof right !== 'string' ||
    right === ''
  ) {
    return null;
  }

  return {
    articleIdPair: [left, right],
    matchedBy: 'fuzzyTitleDate',
    ...(typeof candidate.winnerTitle === 'string'
      ? { winnerTitle: candidate.winnerTitle }
      : {}),
    ...(typeof candidate.incomingTitle === 'string'
      ? { incomingTitle: candidate.incomingTitle }
      : {}),
    ...(typeof candidate.note === 'string' ? { note: candidate.note } : {}),
  };
}

export async function loadFuzzyAcceptEntries(
  fuzzyAcceptPath?: string,
): Promise<FuzzyDedupeAcceptEntry[]> {
  if (typeof fuzzyAcceptPath !== 'string') {
    return [];
  }

  const raw = JSON.parse(await fs.readFile(fuzzyAcceptPath, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error('--fuzzy-accept-file must point to a JSON array.');
  }

  return raw
    .map((entry) => normalizeFuzzyAcceptEntry(entry))
    .filter((entry): entry is FuzzyDedupeAcceptEntry => entry !== null);
}

function createFuzzyEntryMapKey({
  articleIdPair,
  matchedBy,
}: {
  articleIdPair: [string, string];
  matchedBy: 'fuzzyTitleDate';
}): string {
  return `${matchedBy}\u0000${articleIdPair[0]}\u0000${articleIdPair[1]}`;
}

function canonicalizeArticleIdPair(
  articleIdPair: [string, string],
): [string, string] {
  return [...articleIdPair].sort() as [string, string];
}

function mergeOptionalHumanFields<
  T extends { winnerTitle?: string; incomingTitle?: string; note?: string },
>(existing: T, incoming: T): T {
  return {
    ...existing,
    ...(existing.winnerTitle
      ? {}
      : incoming.winnerTitle
        ? { winnerTitle: incoming.winnerTitle }
        : {}),
    ...(existing.incomingTitle
      ? {}
      : incoming.incomingTitle
        ? { incomingTitle: incoming.incomingTitle }
        : {}),
    ...(existing.note ? {} : incoming.note ? { note: incoming.note } : {}),
  };
}

function canonicalizeFuzzyRejectEntry(
  entry: FuzzyDedupeRejectEntry,
): FuzzyDedupeRejectEntry {
  return {
    articleIdPair: canonicalizeArticleIdPair(entry.articleIdPair),
    matchedBy: 'fuzzyTitleDate',
    ...(typeof entry.winnerTitle === 'string'
      ? { winnerTitle: entry.winnerTitle }
      : {}),
    ...(typeof entry.incomingTitle === 'string'
      ? { incomingTitle: entry.incomingTitle }
      : {}),
    ...(typeof entry.note === 'string' ? { note: entry.note } : {}),
  };
}

function canonicalizeFuzzyAcceptEntry(
  entry: FuzzyDedupeAcceptEntry,
): FuzzyDedupeAcceptEntry {
  return {
    articleIdPair: canonicalizeArticleIdPair(entry.articleIdPair),
    matchedBy: 'fuzzyTitleDate',
    ...(typeof entry.winnerTitle === 'string'
      ? { winnerTitle: entry.winnerTitle }
      : {}),
    ...(typeof entry.incomingTitle === 'string'
      ? { incomingTitle: entry.incomingTitle }
      : {}),
    ...(typeof entry.note === 'string' ? { note: entry.note } : {}),
  };
}

function buildCanonicalFuzzyRejectEntries(
  entries: FuzzyDedupeRejectEntry[] = [],
): FuzzyDedupeRejectEntry[] {
  const merged = new Map<string, FuzzyDedupeRejectEntry>();

  for (const entry of entries) {
    const canonicalEntry = canonicalizeFuzzyRejectEntry(entry);
    const key = createFuzzyEntryMapKey(canonicalEntry);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, mergeOptionalHumanFields(existing, canonicalEntry));
      continue;
    }
    merged.set(key, canonicalEntry);
  }

  return [...merged.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, 'en'))
    .map(([, entry]) => entry);
}

function buildCanonicalFuzzyAcceptEntries({
  entries = [],
  rejectedEntries = [],
}: {
  entries?: FuzzyDedupeAcceptEntry[];
  rejectedEntries?: FuzzyDedupeRejectEntry[];
}): FuzzyDedupeAcceptEntry[] {
  const rejectedKeys = new Set(
    buildCanonicalFuzzyRejectEntries(rejectedEntries).map((entry) =>
      createFuzzyEntryMapKey(entry),
    ),
  );
  const merged = new Map<string, FuzzyDedupeAcceptEntry>();

  for (const entry of entries) {
    const canonicalEntry = canonicalizeFuzzyAcceptEntry(entry);
    const key = createFuzzyEntryMapKey(canonicalEntry);
    if (rejectedKeys.has(key)) {
      continue;
    }
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, mergeOptionalHumanFields(existing, canonicalEntry));
      continue;
    }
    merged.set(key, canonicalEntry);
  }

  return [...merged.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, 'en'))
    .map(([, entry]) => entry);
}

export function buildFuzzyReviewState({
  fuzzyRejectEntries = [],
  fuzzyAcceptEntries = [],
}: {
  fuzzyRejectEntries?: FuzzyDedupeRejectEntry[];
  fuzzyAcceptEntries?: FuzzyDedupeAcceptEntry[];
}): FuzzyDedupeReviewState {
  const rejected = buildCanonicalFuzzyRejectEntries(fuzzyRejectEntries);
  const accepted = buildCanonicalFuzzyAcceptEntries({
    entries: fuzzyAcceptEntries,
    rejectedEntries: rejected,
  });

  return {
    accepted,
    rejected,
  };
}

async function writeFuzzyReviewStateFile({
  fuzzyReviewStatePath,
  logger,
  state,
}: {
  fuzzyReviewStatePath: string;
  logger: PipelineLogger;
  state: FuzzyDedupeReviewState;
}): Promise<void> {
  await fs.mkdir(path.dirname(fuzzyReviewStatePath), { recursive: true });
  await fs.writeFile(
    fuzzyReviewStatePath,
    `${JSON.stringify(state, null, 2)}\n`,
  );
  logger.log(
    `[pipeline] fuzzy review-state accepted=${state.accepted.length} rejected=${state.rejected.length} path=${path.relative(process.cwd(), fuzzyReviewStatePath) || fuzzyReviewStatePath}`,
  );
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
  const generatedAt = new Date(options.generatedAt || Date.now()).toISOString();
  const fuzzyRejectEntries = Array.isArray(options.fuzzyRejectEntries)
    ? options.fuzzyRejectEntries
    : await loadFuzzyRejectEntries(options.fuzzyRejectPath);
  const fuzzyAcceptEntries = Array.isArray(options.fuzzyAcceptEntries)
    ? options.fuzzyAcceptEntries
    : await loadFuzzyAcceptEntries(options.fuzzyAcceptPath);
  const fuzzyReviewState = buildFuzzyReviewState({
    fuzzyRejectEntries,
    fuzzyAcceptEntries,
  });
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
    fuzzyRejectEntries,
    fuzzyAcceptEntries,
    feeds,
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
  if (typeof options.fuzzyReviewStatePath === 'string') {
    await writeFuzzyReviewStateFile({
      fuzzyReviewStatePath: path.resolve(
        process.cwd(),
        options.fuzzyReviewStatePath,
      ),
      logger,
      state: fuzzyReviewState,
    });
  }
  if (typeof options.fuzzyReviewHtmlPath === 'string') {
    await writeFuzzyReviewHtmlFile({
      fuzzyReviewHtmlPath: path.resolve(
        process.cwd(),
        options.fuzzyReviewHtmlPath,
      ),
      generatedAt,
      logger,
      handoffRecords: dedupeResult.fuzzyHandoffRecords,
      reviewState: fuzzyReviewState,
    });
  }
  const dedupedArticles = dedupeResult.articles;
  const freshPublicExports = buildPublicExports({
    articles: dedupedArticles,
    feeds,
    shelves,
    generatedAt,
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
    generatedAt: generatedAt,
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
    fuzzyRejectPath: args.fuzzyRejectPath ?? undefined,
    fuzzyAcceptPath: args.fuzzyAcceptPath ?? undefined,
    fuzzyReviewStatePath: args.fuzzyReviewStatePath ?? undefined,
    fuzzyReviewHtmlPath: args.fuzzyReviewHtmlPath ?? undefined,
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
