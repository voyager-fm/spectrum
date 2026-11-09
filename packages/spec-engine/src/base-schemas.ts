import type { InventoryKind, InventorySchema } from '@spectrum/core';

/**
 * Engine-owned FI table schemas. They define the table identity, primary key and the
 * columns whose meaning the engine checks (category/feature mismatches, spec mirrors).
 * A repository schema extends one of these and adds only its own columns.
 */
export const baseInventorySchemas = {
  'spectrum:feature_categories': {
    schema_version: '1.0',
    name: 'FEATURE_CATEGORIES',
    primary_key: ['category_key'],
    null_values: ['-'],
    columns: [
      { name: 'category_title', type: 'string', required: true },
      { name: 'category_key', type: 'string', required: true },
    ],
  },
  'spectrum:features': {
    schema_version: '1.0',
    name: 'FEATURES',
    primary_key: ['feature_id'],
    null_values: ['-'],
    columns: [
      {
        name: 'feature_category',
        type: 'string',
        required: true,
        ref: { table: 'FEATURE_CATEGORIES', column: 'category_title' },
      },
      {
        name: 'category_key',
        type: 'string',
        required: true,
        ref: { table: 'FEATURE_CATEGORIES', column: 'category_key' },
      },
      { name: 'feature_title', type: 'string', required: true },
      { name: 'feature_id', type: 'string', required: true },
    ],
  },
  'spectrum:interactions': {
    schema_version: '1.0',
    name: 'INTERACTIONS',
    primary_key: ['interaction_id'],
    null_values: ['-'],
    columns: [
      { name: 'interaction_title', type: 'string', required: true },
      { name: 'interaction_id', type: 'string', required: true },
      {
        name: 'interaction_type',
        type: 'string',
        required: false,
        enum: ['command', 'input', 'display', 'background'],
      },
      {
        name: 'feature',
        type: 'string',
        required: false,
        ref: { table: 'FEATURES', column: 'feature_title' },
      },
      {
        name: 'category_key',
        type: 'string',
        required: false,
        ref: { table: 'FEATURE_CATEGORIES', column: 'category_key' },
      },
      {
        name: 'feature_id',
        type: 'string',
        required: false,
        ref: { table: 'FEATURES', column: 'feature_id' },
      },
      {
        name: 'status',
        type: 'string',
        required: false,
        enum: ['idea', 'drafted', 'planned', 'implementing', 'shipped', 'deprecated'],
      },
      { name: 'phase', type: 'string', required: false, enum: ['-', 'now', 'next', 'later'] },
      { name: 'summary', type: 'string', required: false },
    ],
  },
} satisfies Record<string, InventorySchema>;

export type BaseInventorySchemaId = keyof typeof baseInventorySchemas;

/** The configured inventory kind each engine-owned schema belongs to. */
export const baseInventoryKinds: Record<BaseInventorySchemaId, InventoryKind> = {
  'spectrum:feature_categories': 'categories',
  'spectrum:features': 'features',
  'spectrum:interactions': 'interactions',
};

export function baseInventorySchema(id: string): InventorySchema | undefined {
  if (!Object.hasOwn(baseInventorySchemas, id)) return undefined;
  return structuredClone(baseInventorySchemas[id as BaseInventorySchemaId]);
}
