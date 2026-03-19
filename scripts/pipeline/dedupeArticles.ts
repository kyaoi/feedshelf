import type {
  ArticleProvenanceEntry,
  ArticleProvenanceMatchedBy,
  CanonicalArticle,
} from '../../src/shared/contracts.ts';
import { normalizeUrl } from './normalizeFeed.ts';

type DedupeMatchedBy = Exclude<ArticleProvenanceMatchedBy, 'primary'>;

interface DedupeMatch {
  key: string | null;
  matchedBy: DedupeMatchedBy | null;
}

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

export function dedupeArticles(
  articles: CanonicalArticle[],
): CanonicalArticle[] {
  const dedupedArticles: CanonicalArticle[] = [];
  const keyToIndex = new Map<string, number>();

  for (const article of articles) {
    const dedupeMatch = resolveDedupeMatch(article);
    if (dedupeMatch.key === null) {
      dedupedArticles.push(article);
      continue;
    }

    const existingIndex = keyToIndex.get(dedupeMatch.key);
    if (existingIndex === undefined) {
      keyToIndex.set(dedupeMatch.key, dedupedArticles.length);
      dedupedArticles.push(article);
      continue;
    }

    dedupedArticles[existingIndex] = mergeDuplicateArticles(
      dedupedArticles[existingIndex],
      article,
      dedupeMatch.matchedBy || undefined,
    );
  }

  return dedupedArticles;
}
