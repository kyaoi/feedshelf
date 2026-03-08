const { normalizeUrl } = require('./normalizeFeed');

function toComparableTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function countRichFields(article) {
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

  if (Array.isArray(article.tags) && article.tags.length > 0) {
    score += 1;
  }

  return score;
}

function compareArticleRichness(left, right) {
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

function pickWinner(left, right) {
  return compareArticleRichness(left, right) >= 0 ? left : right;
}

function chooseLongerText(left, right) {
  if (!left) {
    return right || null;
  }

  if (!right) {
    return left;
  }

  return right.length > left.length ? right : left;
}

function uniqueUnion(left = [], right = []) {
  const seen = new Set();
  const merged = [];

  for (const value of [...left, ...right]) {
    if (typeof value !== 'string' || value === '' || seen.has(value)) {
      continue;
    }
    seen.add(value);
    merged.push(value);
  }

  return merged;
}

function pickEarliestFetchedAt(left, right) {
  return toComparableTime(left) <= toComparableTime(right) ? left : right;
}

function getDedupeKey(article) {
  const normalizedUrl = normalizeUrl(article.url);
  if (normalizedUrl !== null) {
    return `url:${normalizedUrl}`;
  }

  if (article.sourceItemId) {
    return `feed-item:${article.feedId}:${article.sourceItemId}`;
  }

  return null;
}

function mergeDuplicateArticles(left, right) {
  const winner = pickWinner(left, right);
  const loser = winner === left ? right : left;

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
    tags: uniqueUnion(winner.tags, loser.tags),
    sourceItemId: winner.sourceItemId || loser.sourceItemId || null,
    seenInFeeds: uniqueUnion(winner.seenInFeeds, loser.seenInFeeds),
  };
}

function dedupeArticles(articles) {
  const dedupedArticles = [];
  const keyToIndex = new Map();

  for (const article of articles) {
    const dedupeKey = getDedupeKey(article);
    if (dedupeKey === null) {
      dedupedArticles.push(article);
      continue;
    }

    const existingIndex = keyToIndex.get(dedupeKey);
    if (existingIndex === undefined) {
      keyToIndex.set(dedupeKey, dedupedArticles.length);
      dedupedArticles.push(article);
      continue;
    }

    dedupedArticles[existingIndex] = mergeDuplicateArticles(dedupedArticles[existingIndex], article);
  }

  return dedupedArticles;
}

module.exports = {
  compareArticleRichness,
  dedupeArticles,
  getDedupeKey,
  mergeDuplicateArticles,
};
