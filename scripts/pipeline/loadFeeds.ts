import fs from 'node:fs/promises';
import path from 'node:path';

import type { FeedDefinition } from '../../src/shared/contracts.ts';

const REQUIRED_STRING_FIELDS = [
  'id',
  'name',
  'category',
  'feedUrl',
  'siteUrl',
  'language',
] as const;

type FeedDefinitionRecord = Record<string, unknown>;

function isFeedDefinitionRecord(value: unknown): value is FeedDefinitionRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateFeedDefinition(feed: unknown, index: number): FeedDefinition {
  if (!isFeedDefinitionRecord(feed)) {
    throw new Error(`Feed at index ${index} must be an object.`);
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    const candidate = feed[field];
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      throw new Error(`Feed at index ${index} is missing required string field: ${field}`);
    }
  }

  if (typeof feed.enabled !== 'boolean') {
    throw new Error(`Feed at index ${index} must have boolean field: enabled`);
  }

  return {
    id: feed.id as string,
    name: feed.name as string,
    category: feed.category as string,
    feedUrl: feed.feedUrl as string,
    siteUrl: feed.siteUrl as string,
    language: feed.language as string,
    enabled: feed.enabled,
  };
}

export async function loadFeeds(feedsPath: string): Promise<FeedDefinition[]> {
  const absolutePath = path.resolve(feedsPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('data/feeds.json must contain a JSON array.');
  }

  return parsed.map((feed, index) => validateFeedDefinition(feed, index));
}
