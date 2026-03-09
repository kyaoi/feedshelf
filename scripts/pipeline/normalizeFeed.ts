import crypto from 'node:crypto';

import type { CanonicalArticle, FeedDefinition } from '../../src/shared/contracts.ts';

const TRACKING_QUERY_PREFIXES = ['utm_'];
const TRACKING_QUERY_KEYS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid']);
const RSS_ITEM_PATTERN = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
const ATOM_ENTRY_PATTERN = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;

interface CreateArticleOptions {
  feed: FeedDefinition;
  fetchedAt?: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  publishedAt: string | null;
  author: string | null;
  imageUrl: string | null;
  sourceItemId: string | null;
}

interface ArticleIdentityInput {
  feedId: string;
  url: string;
  sourceItemId: string | null;
  title: string;
  publishedAt: string | null;
}

export function collectMatches(pattern: RegExp, value: string): string[] {
  const matches: string[] = [];
  let match = pattern.exec(value);

  while (match) {
    const captured = match[1];
    if (typeof captured === 'string') {
      matches.push(captured);
    }
    match = pattern.exec(value);
  }

  pattern.lastIndex = 0;
  return matches;
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_match: string, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match: string, codePoint: string) => String.fromCodePoint(Number.parseInt(codePoint, 10)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function toDisplayText(value: string): string | null {
  const decoded = decodeEntities(value);
  const stripped = stripTags(decoded);
  const normalized = normalizeWhitespace(stripped).replace(/\s+([.,!?;:])/g, '$1');
  return normalized === '' ? null : normalized;
}

function escapeTagName(tagName: string): string {
  return tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTagText(block: string, tagNames: string[]): string | null {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${escapeTagName(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTagName(tagName)}>`, 'i');
    const match = block.match(pattern);
    if (!match) {
      continue;
    }

    const captured = match[1];
    if (typeof captured !== 'string') {
      continue;
    }

    const text = toDisplayText(captured);
    if (text !== null) {
      return text;
    }
  }

  return null;
}

function extractRawTagText(block: string, tagNames: string[]): string | null {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${escapeTagName(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTagName(tagName)}>`, 'i');
    const match = block.match(pattern);
    if (!match) {
      continue;
    }

    const captured = match[1];
    if (typeof captured !== 'string') {
      continue;
    }

    const text = normalizeWhitespace(decodeEntities(captured));
    if (text !== '') {
      return text;
    }
  }

  return null;
}

function parseAttributes(fragment: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /(\S+)=("([^"]*)"|'([^']*)')/g;
  let match = attributePattern.exec(fragment);

  while (match) {
    const key = match[1];
    if (typeof key === 'string') {
      attributes[key] = decodeEntities(match[3] || match[4] || '');
    }
    match = attributePattern.exec(fragment);
  }

  return attributes;
}

function extractAtomLink(block: string): string | null {
  const linkPattern = /<link\b([^>]*)\/?>(?:<\/link>)?/gi;
  let fallback: string | null = null;
  let match = linkPattern.exec(block);

  while (match) {
    const captured = match[1];
    if (typeof captured !== 'string') {
      continue;
    }

    const attributes = parseAttributes(captured);
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

function extractImageUrl(block: string): string | null {
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

    const captured = match[1];
    if (typeof captured !== 'string') {
      continue;
    }

    const attributes = parseAttributes(captured);
    const candidate = typeof attributes.url === 'string' ? attributes.url.trim() : '';
    if (candidate !== '') {
      return candidate;
    }
  }

  return null;
}

function normalizePublishedAt(value: string | null): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeFetchedAt(value?: string): string {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid fetchedAt: ${value}`);
  }

  return parsed.toISOString();
}

export function normalizeUrl(urlValue: string | null | undefined): string | null {
  if (typeof urlValue !== 'string') {
    return null;
  }

  const trimmed = urlValue.trim();
  if (trimmed === '') {
    return null;
  }

  let parsed: URL;
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

  const nextParams: Array<[string, string]> = [];
  for (const [key, value] of parsed.searchParams) {
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

function hashId(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function normalizeTitleForComparison(value: string): string {
  return normalizeWhitespace(value || '').toLowerCase();
}

export function buildArticleId({ feedId, url, sourceItemId, title, publishedAt }: ArticleIdentityInput): string {
  const normalizedUrl = normalizeUrl(url);
  if (normalizedUrl !== null) {
    return hashId(`url:${normalizedUrl}`);
  }

  if (sourceItemId !== null) {
    return hashId(`feed:${feedId}|item:${sourceItemId}`);
  }

  return hashId(`fallback:${feedId}|${normalizeTitleForComparison(title)}|${publishedAt || ''}`);
}

function createArticle({ feed, fetchedAt, title, url, summary, publishedAt, author, imageUrl, sourceItemId }: CreateArticleOptions): CanonicalArticle | null {
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
    fetchedAt: normalizeFetchedAt(fetchedAt),
    author,
    imageUrl,
    tags: [],
    sourceItemId,
    seenInFeeds: [feed.id],
  };
}

function normalizeRssItem(feed: FeedDefinition, itemXml: string, fetchedAt?: string): CanonicalArticle | null {
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

function normalizeAtomEntry(feed: FeedDefinition, entryXml: string, fetchedAt?: string): CanonicalArticle | null {
  const title = extractTagText(entryXml, ['title']);
  const url = extractAtomLink(entryXml);
  const authorBlock = entryXml.match(/<author\b[^>]*>([\s\S]*?)<\/author>/i);
  const authorBlockContent = authorBlock?.[1];
  const author = typeof authorBlockContent === 'string'
    ? (extractTagText(authorBlockContent, ['name']) || toDisplayText(authorBlockContent))
    : null;

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

export function normalizeFeedDocument({ feed, xml, fetchedAt }: { feed: FeedDefinition; xml: string; fetchedAt?: string }): CanonicalArticle[] {
  if (!feed || typeof feed !== 'object') {
    throw new Error('normalizeFeedDocument requires a feed definition.');
  }

  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error(`Feed ${feed.id} returned an empty document.`);
  }

  const trimmed = xml.trim();

  if (/<rss\b/i.test(trimmed)) {
    return collectMatches(RSS_ITEM_PATTERN, trimmed)
      .map((itemXml) => normalizeRssItem(feed, itemXml, fetchedAt))
      .filter((article): article is CanonicalArticle => article !== null);
  }

  if (/<feed\b/i.test(trimmed)) {
    return collectMatches(ATOM_ENTRY_PATTERN, trimmed)
      .map((entryXml) => normalizeAtomEntry(feed, entryXml, fetchedAt))
      .filter((article): article is CanonicalArticle => article !== null);
  }

  throw new Error(`Feed ${feed.id} is neither RSS nor Atom.`);
}
