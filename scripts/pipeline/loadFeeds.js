const fs = require('node:fs/promises');
const path = require('node:path');

const REQUIRED_STRING_FIELDS = [
  'id',
  'name',
  'category',
  'feedUrl',
  'siteUrl',
  'language',
];

function validateFeedDefinition(feed, index) {
  if (feed === null || typeof feed !== 'object' || Array.isArray(feed)) {
    throw new Error(`Feed at index ${index} must be an object.`);
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof feed[field] !== 'string' || feed[field].trim() === '') {
      throw new Error(`Feed at index ${index} is missing required string field: ${field}`);
    }
  }

  if (typeof feed.enabled !== 'boolean') {
    throw new Error(`Feed at index ${index} must have boolean field: enabled`);
  }

  return {
    id: feed.id,
    name: feed.name,
    category: feed.category,
    feedUrl: feed.feedUrl,
    siteUrl: feed.siteUrl,
    language: feed.language,
    enabled: feed.enabled,
  };
}

async function loadFeeds(feedsPath) {
  const absolutePath = path.resolve(feedsPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('data/feeds.json must contain a JSON array.');
  }

  return parsed.map((feed, index) => validateFeedDefinition(feed, index));
}

module.exports = {
  loadFeeds,
  validateFeedDefinition,
};
