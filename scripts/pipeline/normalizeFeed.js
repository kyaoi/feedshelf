const crypto = require('node:crypto');

const TRACKING_QUERY_PREFIXES = ['utm_'];
const TRACKING_QUERY_KEYS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid']);
const RSS_ITEM_PATTERN = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
const ATOM_ENTRY_PATTERN = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;

function collectMatches(pattern, value) {
  const matches = [];
  let match = pattern.exec(value);

  while (match) {
    matches.push(match[1]);
    match = pattern.exec(value);
  }

  pattern.lastIndex = 0;
  return matches;
}

function decodeEntities(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)));
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTags(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function toDisplayText(value) {
  const decoded = decodeEntities(value);
  const stripped = stripTags(decoded);
  const normalized = normalizeWhitespace(stripped).replace(/\s+([.,!?;:])/g, '$1');
  return normalized === '' ? null : normalized;
}

function escapeTagName(tagName) {
  return tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTagText(block, tagNames) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${escapeTagName(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTagName(tagName)}>`, 'i');
    const match = block.match(pattern);
    if (!match) {
      continue;
    }

    const text = toDisplayText(match[1]);
    if (text !== null) {
      return text;
    }
  }

  return null;
}

function extractRawTagText(block, tagNames) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${escapeTagName(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTagName(tagName)}>`, 'i');
    const match = block.match(pattern);
    if (!match) {
      continue;
    }

    const text = normalizeWhitespace(decodeEntities(match[1]));
    if (text !== '') {
      return text;
    }
  }

  return null;
}

function parseAttributes(fragment) {
  const attributes = {};
  const attributePattern = /(\S+)=("([^"]*)"|'([^']*)')/g;
  let match = attributePattern.exec(fragment);

  while (match) {
    attributes[match[1]] = decodeEntities(match[3] || match[4] || '');
    match = attributePattern.exec(fragment);
  }

  return attributes;
}

function extractAtomLink(block) {
  const linkPattern = /<link\b([^>]*)\/?>(?:<\/link>)?/gi;
  let fallback = null;
  let match = linkPattern.exec(block);

  while (match) {
    const attributes = parseAttributes(match[1]);
    const href = typeof attributes.href === 'string' ? attributes.href.trim() : '';
    if (href === '') {
      match = linkPattern.exec(block);
      continue;
    }

    const rel = (attributes.rel || 'alternate').toLowerCase();
    if (rel === 'alternate') {
      return href;
    }

    if (fallback === null) {
      fallback = href;
    }

    match = linkPattern.exec(block);
  }

  return fallback;
}

function extractImageUrl(block) {
  const patterns = [
    /<media:content\b([^>]*)\/?>(?:<\/media:content>)?/i,
    /<media:thumbnail\b([^>]*)\/?>(?:<\/media:thumbnail>)?/i,
    /<enclosure\b([^>]*)\/?>(?:<\/enclosure>)?/i,
  ];

  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (!match) {
      continue;
    }

    const attributes = parseAttributes(match[1]);
    const candidate = typeof attributes.url === 'string' ? attributes.url.trim() : '';
    if (candidate !== '') {
      return candidate;
    }
  }

  return null;
}

function normalizePublishedAt(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeFetchedAt(value) {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid fetchedAt: ${value}`);
  }

  return parsed.toISOString();
}

function normalizeUrl(urlValue) {
  if (typeof urlValue !== 'string') {
    return null;
  }

  const trimmed = urlValue.trim();
  if (trimmed === '') {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';

  if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
    parsed.port = '';
  }

  const nextParams = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    if (TRACKING_QUERY_KEYS.has(lowerKey) || TRACKING_QUERY_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) {
      continue;
    }
    nextParams.push([key, value]);
  }

  nextParams.sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) {
      return leftValue.localeCompare(rightValue);
    }
    return leftKey.localeCompare(rightKey);
  });

  parsed.search = '';
  for (const [key, value] of nextParams) {
    parsed.searchParams.append(key, value);
  }

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
  }

  return parsed.toString();
}

function hashId(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function normalizeTitleForComparison(value) {
  return normalizeWhitespace(value || '').toLowerCase();
}

function buildArticleId({ feedId, url, sourceItemId, title, publishedAt }) {
  const normalizedUrl = normalizeUrl(url);
  if (normalizedUrl !== null) {
    return hashId(`url:${normalizedUrl}`);
  }

  if (sourceItemId !== null) {
    return hashId(`feed:${feedId}|item:${sourceItemId}`);
  }

  return hashId(`fallback:${feedId}|${normalizeTitleForComparison(title)}|${publishedAt || ''}`);
}

function createArticle({ feed, fetchedAt, title, url, summary, publishedAt, author, imageUrl, sourceItemId }) {
  if (title === null || url === null) {
    return null;
  }

  return {
    id: buildArticleId({
      feedId: feed.id,
      url,
      sourceItemId,
      title,
      publishedAt,
    }),
    feedId: feed.id,
    sourceName: feed.name,
    category: feed.category,
    language: feed.language,
    title,
    url,
    summary,
    publishedAt,
    fetchedAt,
    author,
    imageUrl,
    tags: [],
    sourceItemId,
    seenInFeeds: [feed.id],
  };
}

function normalizeRssItem(feed, itemXml, fetchedAt) {
  const title = extractTagText(itemXml, ['title']);
  const url = extractRawTagText(itemXml, ['link']);

  return createArticle({
    feed,
    fetchedAt,
    title,
    url,
    summary: extractTagText(itemXml, ['description', 'summary', 'content:encoded', 'content']),
    publishedAt: normalizePublishedAt(extractRawTagText(itemXml, ['pubDate', 'dc:date'])),
    author: extractTagText(itemXml, ['author', 'dc:creator']),
    imageUrl: extractImageUrl(itemXml),
    sourceItemId: extractRawTagText(itemXml, ['guid']),
  });
}

function normalizeAtomEntry(feed, entryXml, fetchedAt) {
  const title = extractTagText(entryXml, ['title']);
  const url = extractAtomLink(entryXml);
  const authorBlock = entryXml.match(/<author\b[^>]*>([\s\S]*?)<\/author>/i);
  const author = authorBlock ? (extractTagText(authorBlock[1], ['name']) || toDisplayText(authorBlock[1])) : null;

  return createArticle({
    feed,
    fetchedAt,
    title,
    url,
    summary: extractTagText(entryXml, ['summary', 'content', 'description']),
    publishedAt: normalizePublishedAt(extractRawTagText(entryXml, ['published', 'updated', 'dc:date'])),
    author,
    imageUrl: extractImageUrl(entryXml),
    sourceItemId: extractRawTagText(entryXml, ['id']),
  });
}

function normalizeFeedDocument({ feed, xml, fetchedAt }) {
  if (!feed || typeof feed !== 'object') {
    throw new Error('normalizeFeedDocument requires a feed definition.');
  }

  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error(`Feed ${feed.id} returned an empty document.`);
  }

  const normalizedFetchedAt = normalizeFetchedAt(fetchedAt);
  const trimmed = xml.trim();

  if (/<rss\b/i.test(trimmed)) {
    return collectMatches(RSS_ITEM_PATTERN, trimmed)
      .map((itemXml) => normalizeRssItem(feed, itemXml, normalizedFetchedAt))
      .filter(Boolean);
  }

  if (/<feed\b/i.test(trimmed)) {
    return collectMatches(ATOM_ENTRY_PATTERN, trimmed)
      .map((entryXml) => normalizeAtomEntry(feed, entryXml, normalizedFetchedAt))
      .filter(Boolean);
  }

  throw new Error(`Feed ${feed.id} is neither RSS nor Atom.`);
}

module.exports = {
  buildArticleId,
  normalizeFeedDocument,
  normalizeUrl,
};
