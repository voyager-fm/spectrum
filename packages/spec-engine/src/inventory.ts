import type {
  Finding,
  Inventory,
  InventoryColumn,
  InventorySchema,
  InventorySource,
  Relationship,
} from '@spectrum/core';
import { strings, text } from './config.ts';
import { readRepositoryText } from './files.ts';
import { record } from './markdown.ts';

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
  const columns: InventoryColumn[] = raw.columns.map((value: unknown) => {
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
  });
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

export function absent(value: string | undefined, schema?: InventorySchema): boolean {
  return value === undefined || value === '' || (schema?.null_values ?? ['-']).includes(value);
}
export function concrete(value: string | undefined): value is string {
  return value !== undefined && !['', '-', 'TBD'].includes(value);
}
export function rowKey(table: Inventory, values: Record<string, string>): string {
  return `${table.schema.name}:${JSON.stringify(table.schema.primary_key.map((key) => values[key]))}`;
}

export async function readInventory(
  root: string,
  source: InventorySource,
  findings: Finding[],
): Promise<Inventory> {
  const schema = parseInventorySchema(JSON.parse(await readRepositoryText(root, source.schema)));
  const body = await readRepositoryText(root, source.data);
  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const header = lines.shift()?.split('\t') ?? [];
  const expected = schema.columns.map((c) => c.name);
  const table: Inventory = {
    kind: source.kind,
    path: source.data,
    schemaPath: source.schema,
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
