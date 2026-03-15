import fs from 'node:fs/promises';
import path from 'node:path';

import type { FeedDefinition } from '../../src/shared/contracts.ts';

const REQUIRED_STRING_FIELDS = [
  'id',
  'name',
  'feedUrl',
  'siteUrl',
  'language',
] as const;

type FeedDefinitionRecord = Record<string, unknown>;

function isFeedDefinitionRecord(value: unknown): value is FeedDefinitionRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateFeedDefinition(
  feed: unknown,
  index: number,
  seenIds: Set<string>,
): FeedDefinition {
  if (!isFeedDefinitionRecord(feed)) {
    throw new Error(`Feed at index ${index} must be an object.`);
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    const candidate = feed[field];
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      throw new Error(
        `Feed at index ${index} is missing required string field: ${field}`,
      );
    }
  }

  if (seenIds.has(feed.id as string)) {
    throw new Error(`Duplicate feed id: ${feed.id as string}`);
  }

  if (typeof feed.enabled !== 'boolean') {
    throw new Error(`Feed at index ${index} must have boolean field: enabled`);
  }

  if (!Array.isArray(feed.shelfIds) || feed.shelfIds.length === 0) {
    throw new Error(
      `Feed at index ${index} must have non-empty array field: shelfIds`,
    );
  }

  const shelfIds = feed.shelfIds.map((shelfId, shelfIndex) => {
    if (typeof shelfId !== 'string' || shelfId.trim() === '') {
      throw new Error(
        `Feed at index ${index} has invalid shelfIds[${shelfIndex}] value.`,
      );
    }

    return shelfId;
  });

  const tags = Array.isArray(feed.tags)
    ? feed.tags.map((tag, tagIndex) => {
        if (typeof tag !== 'string' || tag.trim() === '') {
          throw new Error(
            `Feed at index ${index} has invalid tags[${tagIndex}] value.`,
          );
        }

        return tag;
      })
    : [];

  seenIds.add(feed.id as string);

  return {
    id: feed.id as string,
    name: feed.name as string,
    feedUrl: feed.feedUrl as string,
    siteUrl: feed.siteUrl as string,
    language: feed.language as string,
    enabled: feed.enabled,
    shelfIds,
    tags,
  };
}

export async function loadFeeds(feedsPath: string): Promise<FeedDefinition[]> {
  const absolutePath = path.resolve(feedsPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('data/feeds.json must contain a JSON array.');
  }

  const seenIds = new Set<string>();
  return parsed.map((feed, index) =>
    validateFeedDefinition(feed, index, seenIds),
  );
}
