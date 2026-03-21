import type {
  ArticleProvenanceEntry,
  ArticleProvenanceMatchedBy,
  CanonicalArticle,
  FuzzyDedupeAcceptEntry,
  FuzzyDedupeAuditRecord,
  FuzzyDedupeHandoffRecord,
  FuzzyDedupeRejectEntry,
} from '../../src/shared/contracts.ts';
import { normalizeUrl } from './normalizeFeed.ts';

type DedupeMatchedBy = Exclude<ArticleProvenanceMatchedBy, 'primary'>;

export interface DedupeArticlesOptions {
  disableFuzzyDedupe?: boolean;
  fuzzyRejectEntries?: FuzzyDedupeRejectEntry[];
  fuzzyAcceptEntries?: FuzzyDedupeAcceptEntry[];
}

export interface DedupeArticlesResult {
  articles: CanonicalArticle[];
  fuzzyDuplicatesCollapsed: number;
  fuzzyAuditRecords: FuzzyDedupeAuditRecord[];
  fuzzyHandoffRecords: FuzzyDedupeHandoffRecord[];
}

interface DedupeMatch {
  key: string | null;
  matchedBy: DedupeMatchedBy | null;
}

interface FuzzyDedupeLookupKey {
  key: string;
  titleCompareKey: string;
}

interface FuzzyDuplicateMatch {
  index: number;
  titleCompareKey: string;
}

const FUZZY_DEDUPE_WINDOW_MS = 72 * 60 * 60 * 1000;
const FUZZY_TITLE_PUNCTUATION_PATTERN =
  /[\(\)\[\]\{\}<>"'`“”‘’«»‹›「」『』【】〔〕（）〈〉《》｢｣:：;；,，.。!！?？\/／\\|｜·•・･_—–-]+/gu;
const ALLOWLISTED_SOURCE_FAMILIES = [
  {
    familyKey: 'qiita',
    sourceNames: [
      'Qiita Popular',
      'Qiita Python Tag',
      'Qiita Rust Tag',
      'Qiita AI Tag',
      'Qiita Linux Tag',
      'Qiita neovim',
      'Qiita archlinux',
      'Qiita LLM',
    ],
  },
  {
    familyKey: 'zenn',
    sourceNames: [
      'Zenn Feed',
      'Zenn Python Topic',
      'Zenn Rust Topic',
      'Zenn AI Topic',
      'Zenn Productivity Weekly Topic',
      'Zenn Neovim',
      'Zenn Linux',
      'Zenn Arch Linux',
      'Zenn LLM',
    ],
  },
  {
    familyKey: 'itmedia',
    sourceNames: ['ITmedia NEWS 新着', 'ITmedia AI+ 新着'],
  },
] as const;
const ALLOWLISTED_SOURCE_FAMILY_BY_SOURCE_NAME = new Map<string, string>(
  ALLOWLISTED_SOURCE_FAMILIES.flatMap(({ familyKey, sourceNames }) =>
    sourceNames.map((sourceName) => [sourceName, familyKey] as const),
  ),
);

function toComparableTime(value: string): number {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? Number.POSITIVE_INFINITY
    : parsed.getTime();
}

function countRichFields(article: CanonicalArticle): number {
  let score = 0;

  if (article.publishedAt) {
    score += 1;
  }

  if (article.author) {
    score += 1;
  }

  if (article.imageUrl) {
    score += 1;
  }

  if (article.summary) {
    score += 1;
  }

  if (Array.isArray(article.entryTags) && article.entryTags.length > 0) {
    score += 1;
  }

  return score;
}

export function compareArticleRichness(
  left: CanonicalArticle,
  right: CanonicalArticle,
): number {
  const leftScore = countRichFields(left);
  const rightScore = countRichFields(right);

  if (leftScore !== rightScore) {
    return leftScore - rightScore;
  }

  const leftSummaryLength = left.summary ? left.summary.length : 0;
  const rightSummaryLength = right.summary ? right.summary.length : 0;
  if (leftSummaryLength !== rightSummaryLength) {
    return leftSummaryLength - rightSummaryLength;
  }

  const leftFetchedAt = toComparableTime(left.fetchedAt);
  const rightFetchedAt = toComparableTime(right.fetchedAt);
  if (leftFetchedAt !== rightFetchedAt) {
    return rightFetchedAt - leftFetchedAt;
  }

  return 0;
}

function pickWinner(
  left: CanonicalArticle,
  right: CanonicalArticle,
): CanonicalArticle {
  return compareArticleRichness(left, right) >= 0 ? left : right;
}

function chooseLongerText(
  left: string | null,
  right: string | null,
): string | null {
  if (!left) {
    return right || null;
  }

  if (!right) {
    return left;
  }

  return right.length > left.length ? right : left;
}

function uniqueUnion(left: string[] = [], right: string[] = []): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of [...left, ...right]) {
    if (typeof value !== 'string' || value === '' || seen.has(value)) {
      continue;
    }
    seen.add(value);
    merged.push(value);
  }

  return merged;
}

function pickEarliestFetchedAt(left: string, right: string): string {
  return toComparableTime(left) <= toComparableTime(right) ? left : right;
}

function resolveDedupeMatch(article: CanonicalArticle): DedupeMatch {
  const normalizedUrl = normalizeUrl(article.url);
  if (normalizedUrl !== null) {
    return {
      key: `url:${normalizedUrl}`,
      matchedBy: 'normalizedUrl',
    };
  }

  if (article.sourceItemId) {
    return {
      key: `feed-item:${article.feedId}:${article.sourceItemId}`,
      matchedBy: 'feedItem',
    };
  }

  return {
    key: null,
    matchedBy: null,
  };
}

export function createTitleCompareKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function createPunctuationFoldedTitleCompareKey(title: string): string {
  return createTitleCompareKey(title)
    .replace(FUZZY_TITLE_PUNCTUATION_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveAllowlistedSourceFamilyKey(sourceName: string): string | null {
  return ALLOWLISTED_SOURCE_FAMILY_BY_SOURCE_NAME.get(sourceName) ?? null;
}

function resolveTitleCompareKeys(title: string): string[] {
  const titleCompareKey = createTitleCompareKey(title);
  if (titleCompareKey === '') {
    return [];
  }

  const titleCompareKeys = [titleCompareKey];
  const punctuationFoldedTitleCompareKey =
    createPunctuationFoldedTitleCompareKey(title);
  if (
    punctuationFoldedTitleCompareKey !== '' &&
    punctuationFoldedTitleCompareKey !== titleCompareKey
  ) {
    titleCompareKeys.push(punctuationFoldedTitleCompareKey);
  }

  return titleCompareKeys;
}

function buildFuzzyLookupKey(
  scopeKey: string,
  language: string,
  titleCompareKey: string,
): string {
  return [scopeKey, language, titleCompareKey].join('\u0000');
}

function appendFuzzyLookupKeys(
  lookupKeys: FuzzyDedupeLookupKey[],
  scopeKey: string,
  language: string,
  titleCompareKeys: string[],
): void {
  for (const titleCompareKey of titleCompareKeys) {
    lookupKeys.push({
      key: buildFuzzyLookupKey(scopeKey, language, titleCompareKey),
      titleCompareKey,
    });
  }
}

function resolveFuzzyDedupeLookupKeys(
  article: CanonicalArticle,
): FuzzyDedupeLookupKey[] {
  if (typeof article.publishedAt !== 'string') {
    return [];
  }

  const publishedAt = toComparableTime(article.publishedAt);
  if (!Number.isFinite(publishedAt)) {
    return [];
  }

  const titleCompareKeys = resolveTitleCompareKeys(article.title);
  if (titleCompareKeys.length === 0) {
    return [];
  }

  const lookupKeys: FuzzyDedupeLookupKey[] = [];
  appendFuzzyLookupKeys(
    lookupKeys,
    `source:${article.sourceName}`,
    article.language,
    titleCompareKeys,
  );

  const sourceFamilyKey = resolveAllowlistedSourceFamilyKey(article.sourceName);
  if (sourceFamilyKey !== null) {
    appendFuzzyLookupKeys(
      lookupKeys,
      `source-family:${sourceFamilyKey}`,
      article.language,
      titleCompareKeys,
    );
  }

  return lookupKeys;
}

function areWithinFuzzyWindow(
  leftPublishedAt: string | null,
  rightPublishedAt: string | null,
): boolean {
  if (
    typeof leftPublishedAt !== 'string' ||
    typeof rightPublishedAt !== 'string'
  ) {
    return false;
  }

  const leftTime = toComparableTime(leftPublishedAt);
  const rightTime = toComparableTime(rightPublishedAt);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return false;
  }

  return Math.abs(leftTime - rightTime) <= FUZZY_DEDUPE_WINDOW_MS;
}

function cloneProvenanceEntry(
  entry: ArticleProvenanceEntry,
): ArticleProvenanceEntry {
  return {
    feedId: entry.feedId,
    firstSeenAt: entry.firstSeenAt,
    lastSeenAt: entry.lastSeenAt,
    sourceItemId: entry.sourceItemId,
    matchedBy: entry.matchedBy,
  };
}

function retagIncomingProvenanceEntry(
  entry: ArticleProvenanceEntry,
  matchedBy: DedupeMatchedBy,
): ArticleProvenanceEntry {
  return {
    ...cloneProvenanceEntry(entry),
    matchedBy: entry.matchedBy === 'primary' ? matchedBy : entry.matchedBy,
  };
}

function pickEarlierTimestamp(left: string, right: string): string {
  return toComparableTime(left) <= toComparableTime(right) ? left : right;
}

function pickLaterTimestamp(left: string, right: string): string {
  return toComparableTime(left) >= toComparableTime(right) ? left : right;
}

function mergeProvenanceEntry(
  existing: ArticleProvenanceEntry,
  incoming: ArticleProvenanceEntry,
): ArticleProvenanceEntry {
  return {
    feedId: existing.feedId,
    firstSeenAt: pickEarlierTimestamp(
      existing.firstSeenAt,
      incoming.firstSeenAt,
    ),
    lastSeenAt: pickLaterTimestamp(existing.lastSeenAt, incoming.lastSeenAt),
    sourceItemId: existing.sourceItemId || incoming.sourceItemId || null,
    matchedBy: existing.matchedBy,
  };
}

function mergeProvenanceEntries({
  winner,
  loser,
  matchedBy,
}: {
  winner: ArticleProvenanceEntry[];
  loser: ArticleProvenanceEntry[];
  matchedBy: DedupeMatchedBy;
}): ArticleProvenanceEntry[] {
  const merged: ArticleProvenanceEntry[] = [];
  const indexByFeedId = new Map<string, number>();

  const appendEntry = (entry: ArticleProvenanceEntry) => {
    const existingIndex = indexByFeedId.get(entry.feedId);
    if (existingIndex === undefined) {
      indexByFeedId.set(entry.feedId, merged.length);
      merged.push(entry);
      return;
    }

    merged[existingIndex] = mergeProvenanceEntry(merged[existingIndex], entry);
  };

  for (const entry of winner) {
    appendEntry(cloneProvenanceEntry(entry));
  }

  for (const entry of loser) {
    appendEntry(retagIncomingProvenanceEntry(entry, matchedBy));
  }

  return merged;
}

function deriveSeenInFeeds(provenance: ArticleProvenanceEntry[]): string[] {
  const seen = new Set<string>();
  const feeds: string[] = [];

  for (const entry of provenance) {
    if (
      typeof entry.feedId !== 'string' ||
      entry.feedId === '' ||
      seen.has(entry.feedId)
    ) {
      continue;
    }
    seen.add(entry.feedId);
    feeds.push(entry.feedId);
  }

  return feeds;
}

function registerExactDedupeKey(
  keyToIndex: Map<string, number>,
  article: CanonicalArticle,
  index: number,
): void {
  const { key } = resolveDedupeMatch(article);
  if (key !== null) {
    keyToIndex.set(key, index);
  }
}

function registerFuzzyDedupeKeys(
  fuzzyKeyToIndexes: Map<string, Set<number>>,
  article: CanonicalArticle,
  index: number,
): void {
  for (const lookupKey of resolveFuzzyDedupeLookupKeys(article)) {
    const existing = fuzzyKeyToIndexes.get(lookupKey.key);
    if (existing) {
      existing.add(index);
      continue;
    }

    fuzzyKeyToIndexes.set(lookupKey.key, new Set([index]));
  }
}

function toPublishedAtDeltaHours(
  leftPublishedAt: string | null,
  rightPublishedAt: string | null,
): number {
  if (
    typeof leftPublishedAt !== 'string' ||
    typeof rightPublishedAt !== 'string'
  ) {
    return 0;
  }

  const leftTime = toComparableTime(leftPublishedAt);
  const rightTime = toComparableTime(rightPublishedAt);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return 0;
  }

  return Number((Math.abs(leftTime - rightTime) / (60 * 60 * 1000)).toFixed(3));
}

function createFuzzyDedupeAuditRecord(
  existing: CanonicalArticle,
  incoming: CanonicalArticle,
  titleCompareKey: string,
): FuzzyDedupeAuditRecord {
  const winner = pickWinner(existing, incoming);

  return {
    winnerArticleId: winner.id,
    incomingArticleId: incoming.id,
    winnerFeedId: winner.feedId,
    incomingFeedId: incoming.feedId,
    titleCompareKey,
    publishedAtDeltaHours: toPublishedAtDeltaHours(
      existing.publishedAt,
      incoming.publishedAt,
    ),
    matchedBy: 'fuzzyTitleDate',
  };
}

function createFuzzyDedupeHandoffRecord(
  existing: CanonicalArticle,
  incoming: CanonicalArticle,
  titleCompareKey: string,
): FuzzyDedupeHandoffRecord {
  const winner = pickWinner(existing, incoming);

  return {
    ...createFuzzyDedupeAuditRecord(existing, incoming, titleCompareKey),
    winnerTitle: winner.title,
    incomingTitle: incoming.title,
    winnerUrl: winner.url,
    incomingUrl: incoming.url,
    winnerSourceName: winner.sourceName,
    incomingSourceName: incoming.sourceName,
  };
}

function createFuzzyArticlePairKey(
  leftArticleId: string,
  rightArticleId: string,
): string {
  return [leftArticleId, rightArticleId].sort().join('\u0000');
}

function createFuzzyRejectEntryKey(entry: FuzzyDedupeRejectEntry): string {
  return `${entry.matchedBy}\u0000${createFuzzyArticlePairKey(
    entry.articleIdPair[0],
    entry.articleIdPair[1],
  )}`;
}

function createFuzzyAcceptEntryKey(entry: FuzzyDedupeAcceptEntry): string {
  return `${entry.matchedBy}\u0000${createFuzzyArticlePairKey(
    entry.articleIdPair[0],
    entry.articleIdPair[1],
  )}`;
}

function createFuzzyCandidateKey(
  existing: CanonicalArticle,
  incoming: CanonicalArticle,
): string {
  return `fuzzyTitleDate\u0000${createFuzzyArticlePairKey(existing.id, incoming.id)}`;
}

function buildFuzzyRejectEntrySet(
  entries: FuzzyDedupeRejectEntry[] | undefined,
): Set<string> {
  const keys = new Set<string>();

  if (!Array.isArray(entries)) {
    return keys;
  }

  for (const entry of entries) {
    keys.add(createFuzzyRejectEntryKey(entry));
  }

  return keys;
}

function buildFuzzyAcceptEntrySet(
  entries: FuzzyDedupeAcceptEntry[] | undefined,
): Set<string> {
  const keys = new Set<string>();

  if (!Array.isArray(entries)) {
    return keys;
  }

  for (const entry of entries) {
    keys.add(createFuzzyAcceptEntryKey(entry));
  }

  return keys;
}

function isFuzzyMergeRejected(
  fuzzyRejectEntryKeys: Set<string>,
  existing: CanonicalArticle,
  incoming: CanonicalArticle,
): boolean {
  if (fuzzyRejectEntryKeys.size === 0) {
    return false;
  }

  return fuzzyRejectEntryKeys.has(createFuzzyCandidateKey(existing, incoming));
}

function isFuzzyMergeAccepted(
  fuzzyAcceptEntryKeys: Set<string>,
  existing: CanonicalArticle,
  incoming: CanonicalArticle,
): boolean {
  if (fuzzyAcceptEntryKeys.size === 0) {
    return false;
  }

  return fuzzyAcceptEntryKeys.has(createFuzzyCandidateKey(existing, incoming));
}

function findFuzzyDuplicateMatch(
  fuzzyKeyToIndexes: Map<string, Set<number>>,
  dedupedArticles: CanonicalArticle[],
  article: CanonicalArticle,
): FuzzyDuplicateMatch | null {
  for (const lookupKey of resolveFuzzyDedupeLookupKeys(article)) {
    const candidateIndexes = fuzzyKeyToIndexes.get(lookupKey.key);
    if (!candidateIndexes) {
      continue;
    }

    let bestIndex: number | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const index of candidateIndexes) {
      const candidate = dedupedArticles[index];
      if (!candidate) {
        continue;
      }

      if (!areWithinFuzzyWindow(candidate.publishedAt, article.publishedAt)) {
        continue;
      }

      const delta = Math.abs(
        toComparableTime(candidate.publishedAt || '') -
          toComparableTime(article.publishedAt || ''),
      );
      if (delta < bestDelta) {
        bestIndex = index;
        bestDelta = delta;
      }
    }

    if (bestIndex !== null) {
      return {
        index: bestIndex,
        titleCompareKey: lookupKey.titleCompareKey,
      };
    }
  }

  return null;
}

export function getDedupeKey(article: CanonicalArticle): string | null {
  return resolveDedupeMatch(article).key;
}

export function mergeDuplicateArticles(
  left: CanonicalArticle,
  right: CanonicalArticle,
  matchedBy?: DedupeMatchedBy,
): CanonicalArticle {
  const dedupeMatchedBy = matchedBy || resolveDedupeMatch(left).matchedBy;
  if (dedupeMatchedBy === null) {
    return pickWinner(left, right);
  }

  const winner = pickWinner(left, right);
  const loser = winner === left ? right : left;
  const provenance = mergeProvenanceEntries({
    winner: winner.provenance,
    loser: loser.provenance,
    matchedBy: dedupeMatchedBy,
  });

  return {
    ...winner,
    id: winner.id,
    title: winner.title,
    url: winner.url,
    publishedAt: winner.publishedAt || loser.publishedAt || null,
    fetchedAt: pickEarliestFetchedAt(left.fetchedAt, right.fetchedAt),
    summary: chooseLongerText(winner.summary, loser.summary),
    author: winner.author || loser.author || null,
    imageUrl: winner.imageUrl || loser.imageUrl || null,
    shelfIds: uniqueUnion(winner.shelfIds, loser.shelfIds),
    sourceTags: uniqueUnion(winner.sourceTags, loser.sourceTags),
    entryTags: uniqueUnion(winner.entryTags, loser.entryTags),
    sourceItemId: winner.sourceItemId || loser.sourceItemId || null,
    provenance,
    seenInFeeds: deriveSeenInFeeds(provenance),
  };
}

export function dedupeArticlesWithSummary(
  articles: CanonicalArticle[],
  options: DedupeArticlesOptions = {},
): DedupeArticlesResult {
  const dedupedArticles: CanonicalArticle[] = [];
  const keyToIndex = new Map<string, number>();
  const fuzzyKeyToIndexes = new Map<string, Set<number>>();
  const disableFuzzyDedupe = options.disableFuzzyDedupe === true;
  const fuzzyRejectEntryKeys = buildFuzzyRejectEntrySet(
    options.fuzzyRejectEntries,
  );
  const fuzzyAcceptEntryKeys = buildFuzzyAcceptEntrySet(
    options.fuzzyAcceptEntries,
  );
  const fuzzyAuditRecords: FuzzyDedupeAuditRecord[] = [];
  const fuzzyHandoffRecords: FuzzyDedupeHandoffRecord[] = [];
  let fuzzyDuplicatesCollapsed = 0;

  for (const article of articles) {
    const dedupeMatch = resolveDedupeMatch(article);
    if (dedupeMatch.key !== null) {
      const existingIndex = keyToIndex.get(dedupeMatch.key);
      if (existingIndex !== undefined) {
        const mergedArticle = mergeDuplicateArticles(
          dedupedArticles[existingIndex],
          article,
          dedupeMatch.matchedBy || undefined,
        );
        dedupedArticles[existingIndex] = mergedArticle;
        registerExactDedupeKey(keyToIndex, article, existingIndex);
        registerExactDedupeKey(keyToIndex, mergedArticle, existingIndex);
        if (!disableFuzzyDedupe) {
          registerFuzzyDedupeKeys(
            fuzzyKeyToIndexes,
            mergedArticle,
            existingIndex,
          );
        }
        continue;
      }
    }

    if (!disableFuzzyDedupe) {
      const fuzzyDuplicateMatch = findFuzzyDuplicateMatch(
        fuzzyKeyToIndexes,
        dedupedArticles,
        article,
      );
      if (fuzzyDuplicateMatch !== null) {
        const { index: fuzzyDuplicateIndex, titleCompareKey } =
          fuzzyDuplicateMatch;
        const existingArticle = dedupedArticles[fuzzyDuplicateIndex];
        if (
          isFuzzyMergeRejected(fuzzyRejectEntryKeys, existingArticle, article)
        ) {
          dedupedArticles.push(article);
          const rejectedIndex = dedupedArticles.length - 1;
          registerExactDedupeKey(keyToIndex, article, rejectedIndex);
          registerFuzzyDedupeKeys(fuzzyKeyToIndexes, article, rejectedIndex);
          continue;
        }
        const mergedArticle = mergeDuplicateArticles(
          existingArticle,
          article,
          'fuzzyTitleDate',
        );
        const isAccepted = isFuzzyMergeAccepted(
          fuzzyAcceptEntryKeys,
          existingArticle,
          article,
        );
        dedupedArticles[fuzzyDuplicateIndex] = mergedArticle;
        if (!isAccepted) {
          fuzzyAuditRecords.push(
            createFuzzyDedupeAuditRecord(
              existingArticle,
              article,
              titleCompareKey,
            ),
          );
          fuzzyHandoffRecords.push(
            createFuzzyDedupeHandoffRecord(
              existingArticle,
              article,
              titleCompareKey,
            ),
          );
        }
        fuzzyDuplicatesCollapsed += 1;
        registerExactDedupeKey(keyToIndex, article, fuzzyDuplicateIndex);
        registerExactDedupeKey(keyToIndex, mergedArticle, fuzzyDuplicateIndex);
        registerFuzzyDedupeKeys(
          fuzzyKeyToIndexes,
          mergedArticle,
          fuzzyDuplicateIndex,
        );
        continue;
      }
    }

    dedupedArticles.push(article);
    const nextIndex = dedupedArticles.length - 1;
    registerExactDedupeKey(keyToIndex, article, nextIndex);
    if (!disableFuzzyDedupe) {
      registerFuzzyDedupeKeys(fuzzyKeyToIndexes, article, nextIndex);
    }
  }

  return {
    articles: dedupedArticles,
    fuzzyDuplicatesCollapsed,
    fuzzyAuditRecords,
    fuzzyHandoffRecords,
  };
}

export function dedupeArticles(
  articles: CanonicalArticle[],
  options: DedupeArticlesOptions = {},
): CanonicalArticle[] {
  return dedupeArticlesWithSummary(articles, options).articles;
}
