import { posix } from 'node:path';
import type {
  Finding,
  Inventory,
  InventoryColumn,
  InventoryKind,
  InventorySchema,
  InventorySource,
  Relationship,
} from '@spectrum/core';
import {
  type BaseInventorySchemaId,
  baseInventoryKinds,
  baseInventorySchema,
} from './base-schemas.ts';
import { inventoryKinds, strings, text } from './config.ts';
import { readRepositoryText } from './files.ts';
import { record } from './markdown.ts';

function parseColumn(value: unknown): InventoryColumn {
  if (
    !record(value) ||
    !text(value.name) ||
    !['string', 'number', 'boolean'].includes(String(value.type)) ||
    typeof value.required !== 'boolean'
  )
    throw new Error('Each column requires name, type and required.');
  if (
    value.enum !== undefined &&
    (!Array.isArray(value.enum) ||
      !value.enum.every((v) => ['string', 'number', 'boolean'].includes(typeof v)))
  )
    throw new Error(`Invalid enum for ${value.name}.`);
  if (value.ref !== undefined) {
    const ref = value.ref;
    if (
      !record(ref) ||
      !text(ref.table) ||
      !(
        text(ref.column) ||
        (strings(ref.columns) &&
          strings(ref.references) &&
          ref.columns.length > 0 &&
          ref.columns.length === ref.references.length)
      )
    )
      throw new Error(`Invalid reference for ${value.name}.`);
  }
  return value as unknown as InventoryColumn;
}

export function parseInventorySchema(raw: unknown): InventorySchema {
  if (
    !record(raw) ||
    !text(raw.schema_version) ||
    !text(raw.name) ||
    !strings(raw.primary_key) ||
    !raw.primary_key.length ||
    !Array.isArray(raw.columns) ||
    !raw.columns.length
  )
    throw new Error('Inventory schema requires schema_version, name, primary_key and columns.');
  const columns = raw.columns.map(parseColumn);
  const names = columns.map((c) => c.name);
  if (
    new Set(names).size !== names.length ||
    new Set(raw.primary_key).size !== raw.primary_key.length ||
    raw.primary_key.some((key) => !names.includes(key))
  )
    throw new Error(
      'Columns and primary keys must be unique; primary keys must name existing columns.',
    );
  if (raw.null_values !== undefined && !strings(raw.null_values))
    throw new Error('null_values must be an array of strings.');
  return {
    ...raw,
    schema_version: raw.schema_version,
    name: raw.name,
    primary_key: raw.primary_key,
    columns,
  };
}

/**
 * Merge a repository schema extension onto its engine-owned base. The extension lists every
 * TSV column in header order: base columns by name (optionally with a description), added
 * columns with their full definition. Table identity, keys and base column rules stay
 * engine-owned.
 */
export function extendInventorySchema(raw: unknown, kind?: InventoryKind): InventorySchema {
  if (!record(raw) || !text(raw.extends))
    throw new Error('Inventory schema extension requires extends.');
  const base = baseInventorySchema(raw.extends);
  if (!base)
    throw new Error(
      `Unknown base schema ${raw.extends}; expected one of ${Object.keys(baseInventoryKinds).join(', ')}.`,
    );
  const baseKind = baseInventoryKinds[raw.extends as BaseInventorySchemaId];
  if (kind !== undefined && kind !== baseKind)
    throw new Error(`${raw.extends} extends the ${baseKind} inventory, not ${kind}.`);
  for (const owned of ['name', 'primary_key', 'null_values'])
    if (raw[owned] !== undefined)
      throw new Error(`${owned} is owned by the base schema ${raw.extends}.`);
  if (!text(raw.schema_version) || !Array.isArray(raw.columns) || !raw.columns.length)
    throw new Error('Inventory schema extension requires schema_version and columns.');
  const columns = raw.columns.map((value: unknown) => {
    const baseColumn = record(value)
      ? base.columns.find((column) => column.name === value.name)
      : undefined;
    if (!record(value) || !baseColumn) return parseColumn(value);
    const overrides = Object.keys(value).filter((key) => !['name', 'description'].includes(key));
    if (overrides.length)
      throw new Error(
        `${baseColumn.name} is defined by ${raw.extends}; list it by name (and optional description) only.`,
      );
    if (value.description !== undefined && typeof value.description !== 'string')
      throw new Error(`Invalid description for ${baseColumn.name}.`);
    return { ...baseColumn, ...(value.description ? { description: value.description } : {}) };
  });
  const missing = base.columns.filter(
    (column) => !columns.some((candidate) => candidate.name === column.name),
  );
  if (missing.length)
    throw new Error(
      `${raw.extends} requires base columns: ${missing.map((column) => column.name).join(', ')}.`,
    );
  return parseInventorySchema({
    ...raw,
    schema_version: raw.schema_version,
    extends: raw.extends,
    name: base.name,
    primary_key: base.primary_key,
    null_values: base.null_values,
    columns,
  });
}

/** Resolve an adjacent schema: an extension of an engine-owned base, or a standalone table. */
export function resolveInventorySchema(raw: unknown, kind?: InventoryKind): InventorySchema {
  return record(raw) && raw.extends !== undefined
    ? extendInventorySchema(raw, kind)
    : parseInventorySchema(raw);
}

export function absent(value: string | undefined, schema?: InventorySchema): boolean {
  return value === undefined || value === '' || (schema?.null_values ?? ['-']).includes(value);
}
export function concrete(value: string | undefined): value is string {
  return value !== undefined && !['', '-', 'TBD'].includes(value);
}
export function rowKey(table: Inventory, values: Record<string, string>): string {
  return `${table.schema.name}:${JSON.stringify(table.schema.primary_key.map((key) => values[key]))}`;
}

/** One table declared by a domain catalog, with its data path resolved from the repository root. */
export interface CatalogTable {
  kind: InventoryKind;
  data: string;
  schema: InventorySchema;
}

/**
 * Parse a domain schema catalog: `tables` maps each table name to its TSV file (relative to the
 * catalog), its kind and its columns. Engine-owned FI tables use `extends`; other tables are
 * complete definitions. Throws on the first invalid table so the catalog is never half-trusted.
 */
export function parseInventoryCatalog(raw: unknown, catalogPath: string): CatalogTable[] {
  if (!record(raw) || !text(raw.schema_version) || !record(raw.tables))
    throw new Error('Inventory catalog requires schema_version and a tables mapping.');
  const entries = Object.entries(raw.tables);
  if (!entries.length) throw new Error('Inventory catalog requires at least one table.');
  return entries.map(([name, entry]) => {
    const fail = (message: string): never => {
      throw new Error(`${name}: ${message}`);
    };
    if (!record(entry)) return fail('table definition must be a mapping.');
    const { data, kind, ...definition } = entry;
    if (!text(data) || posix.isAbsolute(data) || data.includes('\\'))
      return fail('data must be a TSV path relative to the catalog.');
    if (definition.name !== undefined || definition.schema_version !== undefined)
      fail('the table key names the table; name and schema_version belong to the catalog.');
    if (kind !== undefined && !inventoryKinds.includes(kind as InventoryKind))
      fail(`unknown kind ${String(kind)}.`);
    const table = { ...definition, schema_version: raw.schema_version };
    let schema: InventorySchema;
    let resolvedKind: InventoryKind;
    try {
      if (definition.extends !== undefined) {
        const base = baseInventoryKinds[definition.extends as BaseInventorySchemaId];
        schema = extendInventorySchema(table, (kind as InventoryKind | undefined) ?? base);
        resolvedKind = base;
        if (schema.name !== name) fail(`${definition.extends} defines table ${schema.name}.`);
      } else {
        if (kind === undefined) fail('kind is required unless the table extends a base schema.');
        schema = parseInventorySchema({ ...table, name });
        resolvedKind = kind as InventoryKind;
      }
    } catch (error) {
      if (error instanceof Error && !error.message.startsWith(`${name}: `)) fail(error.message);
      throw error;
    }
    return {
      kind: resolvedKind,
      data: posix.normalize(posix.join(posix.dirname(catalogPath), data)),
      schema,
    };
  });
}

export async function readInventoryCatalog(root: string, catalogPath: string) {
  return parseInventoryCatalog(
    JSON.parse(await readRepositoryText(root, catalogPath)),
    catalogPath,
  );
}

export async function readInventory(
  root: string,
  source: InventorySource,
  findings: Finding[],
): Promise<Inventory> {
  const schema = resolveInventorySchema(
    JSON.parse(await readRepositoryText(root, source.schema)),
    source.kind,
  );
  return readTable(root, { kind: source.kind, data: source.data, schema }, source.schema, findings);
}

export async function readTable(
  root: string,
  source: CatalogTable,
  schemaPath: string,
  findings: Finding[],
): Promise<Inventory> {
  const { schema } = source;
  const body = await readRepositoryText(root, source.data);
  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const header = lines.shift()?.split('\t') ?? [];
  const expected = schema.columns.map((c) => c.name);
  const table: Inventory = {
    kind: source.kind,
    path: source.data,
    schemaPath,
    schema,
    rows: [],
  };
  const add = (
    code: string,
    message: string,
    line: number,
    severity: 'error' | 'warning' = 'error',
  ) => findings.push({ code, message, path: source.data, line, severity });
  if (header.length !== expected.length || header.some((name, i) => name !== expected[i])) {
    add('invalid-tsv', 'Header must match schema columns in order.', 1);
    return table;
  }
  const keys = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const cells = line.split('\t');
    const lineNumber = index + 2;
    if (!line || cells.length !== header.length) {
      add(
        'invalid-tsv',
        `Expected ${header.length} cells; empty rows are not allowed.`,
        lineNumber,
      );
      continue;
    }
    const values = Object.fromEntries(header.map((name, i) => [name, cells[i]]));
    table.rows.push({ line: lineNumber, values });
    for (const column of schema.columns) {
      const value = values[column.name];
      if (
        schema.primary_key.includes(column.name) &&
        (!concrete(value) || value.startsWith('<<AI>>'))
      )
        add('invalid-primary-key', `${column.name} requires a stable, decided value.`, lineNumber);
      if (value === 'TBD' || value.includes('[TBD]')) {
        add('undecided-value', `${column.name} is undecided.`, lineNumber, 'warning');
        if (value === 'TBD') continue;
      }
      if (absent(value, schema)) {
        if (column.required) add('required-value', `${column.name} is required.`, lineNumber);
        continue;
      }
      if (column.enum && !column.enum.map(String).includes(value))
        add(
          'invalid-value',
          `${column.name} must be one of: ${column.enum.join(', ')}.`,
          lineNumber,
        );
      if (column.type === 'number' && !Number.isFinite(Number(value)))
        add('invalid-value', `${column.name} must be a finite number.`, lineNumber);
      if (column.type === 'boolean' && !['true', 'false'].includes(value))
        add('invalid-value', `${column.name} must be true or false.`, lineNumber);
    }
    const key = rowKey(table, values);
    if (keys.has(key)) add('duplicate-id', `Duplicate primary key ${key}.`, lineNumber);
    keys.add(key);
  }
  return table;
}

export function checkReferences(
  tables: Inventory[],
  findings: Finding[],
  relationships: Relationship[],
) {
  const byName = new Map(tables.map((table) => [table.schema.name, table]));
  for (const table of tables)
    for (const column of table.schema.columns) {
      const ref = column.ref;
      if (!ref) continue;
      const target = byName.get(ref.table);
      const sourceColumns = ref.column ? [column.name] : (ref.columns ?? []);
      const targetColumns = ref.column ? [ref.column] : (ref.references ?? []);
      if (
        !target ||
        targetColumns.some((name) => !target.schema.columns.some((c) => c.name === name)) ||
        sourceColumns.some((name) => !table.schema.columns.some((c) => c.name === name))
      ) {
        findings.push({
          code: 'invalid-reference-schema',
          path: table.schemaPath,
          severity: 'error',
          message: `${column.name} references an unavailable table or column in ${ref.table}.`,
        });
        continue;
      }
      for (const row of table.rows) {
        if (absent(row.values[column.name], table.schema) || row.values[column.name] === 'TBD')
          continue;
        const tuples = ref.column
          ? row.values[column.name].split('|').map((v) => [v.trim()])
          : [sourceColumns.map((name) => row.values[name])];
        for (const tuple of tuples) {
          if (tuple.some((value) => value === 'TBD')) continue;
          const found = target.rows.filter((candidate) =>
            targetColumns.every((name, i) => candidate.values[name] === tuple[i]),
          );
          if (!found.length)
            findings.push({
              code: 'invalid-reference',
              path: table.path,
              severity: 'error',
              line: row.line,
              message: `${column.name} references missing ${ref.table}(${targetColumns.join(', ')}): ${tuple.join(', ')}.`,
            });
          for (const candidate of found)
            relationships.push({
              kind: 'reference',
              source: rowKey(table, row.values),
              target: rowKey(target, candidate.values),
              field: column.name,
            });
        }
      }
    }
}
