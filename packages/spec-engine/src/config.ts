import type {
  DocumentSource,
  DocumentSourceKind,
  InventoryEntry,
  InventoryKind,
  SpectrumConfig,
} from '@spectrum/core';
import { readRepositoryText } from './files.ts';
import { record } from './markdown.ts';

export const inventoryKinds: InventoryKind[] = [
  'objects',
  'surfaces',
  'regions',
  'menus',
  'categories',
  'features',
  'interactions',
  'routes',
  'other',
];
const documentKinds: DocumentSourceKind[] = [
  'feature_bundle',
  'page_bundle',
  'contracts',
  'flows',
  'engineering',
  'rules',
  'reference',
];

export function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
export function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}

export function parseConfiguration(raw: unknown): SpectrumConfig {
  if (!record(raw) || raw.schema_version !== 2)
    throw new Error(
      'Expected schema_version: 2. Migrate legacy feature JSON to TSV inventories and Markdown interaction specs; see the @spectrum/spec-engine document model guide.',
    );
  if (!text(raw.name) || raw.mode !== 'proposal-only' || raw.canonical_source !== 'git-files')
    throw new Error(
      'Configuration requires name, mode: proposal-only and canonical_source: git-files.',
    );
  if (
    !Array.isArray(raw.inventories) ||
    !raw.inventories.length ||
    !Array.isArray(raw.documents) ||
    !raw.documents.length
  )
    throw new Error('Configuration requires nonempty inventories and documents.');
  const inventories: InventoryEntry[] = raw.inventories.map((source: unknown) => {
    if (record(source) && source.catalog !== undefined) {
      if (!text(source.catalog) || Object.keys(source).some((key) => key !== 'catalog'))
        throw new Error('A catalog inventory entry requires only a catalog path.');
      return { catalog: source.catalog };
    }
    if (
      !record(source) ||
      !inventoryKinds.includes(source.kind as InventoryKind) ||
      !text(source.data) ||
      !text(source.schema)
    )
      throw new Error('Each inventory requires a catalog path, or kind, data and schema paths.');
    return { kind: source.kind as InventoryKind, data: source.data, schema: source.schema };
  });
  const documents: DocumentSource[] = raw.documents.map((source: unknown) => {
    if (
      !record(source) ||
      !documentKinds.includes(source.kind as DocumentSourceKind) ||
      !text(source.root)
    )
      throw new Error('Each document source requires a supported kind and root path.');
    return { kind: source.kind as DocumentSourceKind, root: source.root };
  });
  if (raw.overview !== undefined && !text(raw.overview))
    throw new Error('overview must be a repository-relative path.');
  return {
    schema_version: 2,
    name: raw.name,
    mode: 'proposal-only',
    canonical_source: 'git-files',
    inventories,
    documents,
    ...(raw.overview ? { overview: raw.overview as string } : {}),
  };
}

/**
 * Keys that earlier templates wrote but nothing ever read. Connection state comes from the
 * server's verified connections, never from repository configuration.
 */
export const RETIRED_CONFIGURATION_KEYS = ['integrations', 'agents'] as const;

export function retiredConfigurationKeys(raw: unknown): string[] {
  return record(raw) ? RETIRED_CONFIGURATION_KEYS.filter((key) => raw[key] !== undefined) : [];
}

export async function readRawConfiguration(
  root: string,
  configPath = '.spectrum/config.json',
): Promise<unknown> {
  return JSON.parse(await readRepositoryText(root, configPath));
}

export async function readConfiguration(
  root: string,
  configPath = '.spectrum/config.json',
): Promise<SpectrumConfig> {
  return parseConfiguration(await readRawConfiguration(root, configPath));
}
