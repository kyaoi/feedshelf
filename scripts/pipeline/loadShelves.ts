import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  ShelfDefinition,
  ShelvesDocument,
} from '../../src/shared/contracts.ts';

const RESERVED_SHELF_IDS = new Set([
  'tags',
  'search',
  'sources',
  'categories',
  'assets',
  'data',
  'index',
]);
const ASCII_KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseKeyValueLine(line: string): { key: string; value: string } {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex <= 0) {
    throw new Error(`Invalid YAML line: ${line}`);
  }

  return {
    key: line.slice(0, separatorIndex).trim(),
    value: stripQuotes(line.slice(separatorIndex + 1).trim()),
  };
}

export function parseShelvesDocument(raw: string): ShelvesDocument {
  const lines = raw
    .split(/\r?\n/u)
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));

  const site: Record<string, string> = {};
  const shelves: ShelfDefinition[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === 'site:') {
      index += 1;
      while (index < lines.length && /^\s{2}\S/u.test(lines[index])) {
        const { key, value } = parseKeyValueLine(lines[index].trim());
        site[key] = value;
        index += 1;
      }
      continue;
    }

    if (trimmed === 'shelves:') {
      index += 1;
      while (index < lines.length && /^\s{2}-\s/u.test(lines[index])) {
        const firstLine = lines[index].trim().replace(/^-\s*/u, '');
        const entry: Record<string, string> = {};
        if (firstLine !== '') {
          const { key, value } = parseKeyValueLine(firstLine);
          entry[key] = value;
        }
        index += 1;

        while (index < lines.length && /^\s{4}\S/u.test(lines[index])) {
          const { key, value } = parseKeyValueLine(lines[index].trim());
          entry[key] = value;
          index += 1;
        }

        shelves.push({
          id: entry.id || '',
          title: entry.title || '',
          description: entry.description || '',
        });
      }
      continue;
    }

    throw new Error(`Unsupported shelves.yaml structure near: ${line.trim()}`);
  }

  return {
    site: {
      title: site.title || '',
      description: site.description || '',
      intro: site.intro || '',
    },
    shelves,
  };
}

function validateSiteField(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`shelves.yaml site.${field} is required.`);
  }

  return value;
}

function validateShelfDefinition(
  shelf: ShelfDefinition,
  index: number,
  seenIds: Set<string>,
): ShelfDefinition {
  if (typeof shelf.id !== 'string' || shelf.id.trim() === '') {
    throw new Error(`Shelf at index ${index} is missing required field: id`);
  }

  if (!ASCII_KEBAB_CASE_PATTERN.test(shelf.id)) {
    throw new Error(
      `Shelf at index ${index} has invalid id: ${shelf.id}. Expected ASCII kebab-case.`,
    );
  }

  if (RESERVED_SHELF_IDS.has(shelf.id)) {
    throw new Error(`Shelf id is reserved and cannot be used: ${shelf.id}`);
  }

  if (seenIds.has(shelf.id)) {
    throw new Error(`Duplicate shelf id: ${shelf.id}`);
  }

  if (typeof shelf.title !== 'string' || shelf.title.trim() === '') {
    throw new Error(`Shelf ${shelf.id} is missing required field: title`);
  }

  if (
    typeof shelf.description !== 'string' ||
    shelf.description.trim() === ''
  ) {
    throw new Error(`Shelf ${shelf.id} is missing required field: description`);
  }

  seenIds.add(shelf.id);
  return shelf;
}

export function validateShelvesDocument(
  value: ShelvesDocument,
): ShelvesDocument {
  const seenIds = new Set<string>();

  return {
    site: {
      title: validateSiteField(value.site?.title || '', 'title'),
      description: validateSiteField(
        value.site?.description || '',
        'description',
      ),
      intro: validateSiteField(value.site?.intro || '', 'intro'),
    },
    shelves: value.shelves.map((shelf, index) =>
      validateShelfDefinition(shelf, index, seenIds),
    ),
  };
}

export async function loadShelves(
  shelvesPath: string,
): Promise<ShelvesDocument> {
  const absolutePath = path.resolve(shelvesPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return validateShelvesDocument(parseShelvesDocument(raw));
}
