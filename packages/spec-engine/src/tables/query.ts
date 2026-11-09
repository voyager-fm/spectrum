import { realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { createReadSession, headerColumns, parseTable } from './reader.ts';

export interface TableBinding {
  /** Qualified identity, for example inventory:billing/items. Never inferred from a basename. */
  id: string;
  path: string;
  alias?: string;
  /** Defaults to schema.json beside the table. null explicitly disables metadata lookup. */
  schemaPath?: string | null;
}
export interface TableQueryOptions {
  root: string;
  tables: readonly TableBinding[];
  snapshot?: { kind: 'worktree'; contentDigest?: string } | { kind: 'commit'; revision: string };
}
export interface TableContract {
  columns: { name: string; [key: string]: unknown }[];
  primary_key?: string[];
  [key: string]: unknown;
}
export interface SearchInput {
  table: string;
  query: string;
  fields?: readonly string[];
  limit?: number;
}
type Session = ReturnType<typeof createReadSession>;

function limitValue(limit = 50) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000)
    throw new Error('Invalid limit: expected integer 1..10000');
  return limit;
}

/** Explicit catalog only; no discovery, SQL engine, project identity or process-global cache. */
export async function createTableQuery(options: TableQueryOptions) {
  if (options.snapshot && options.snapshot.kind !== 'worktree') {
    throw new Error('Commit snapshot reading is not supported; materialization adapter required');
  }
  if (!isAbsolute(options.root)) throw new Error('Customer root must be an explicit absolute path');
  const expectedDigest = options.snapshot?.contentDigest;
  const bindings = options.tables.map((binding) => Object.freeze({ ...binding }));
  const lookup = new Map<string, Readonly<TableBinding>>();
  for (const binding of bindings) {
    if (!/^[^\s:]+:[^\s:]+$/.test(binding.id))
      throw new Error(`Invalid qualified table ID: ${binding.id}`);
    if (lookup.has(binding.id)) throw new Error(`Duplicate table ID: ${binding.id}`);
    lookup.set(binding.id, binding);
    if (binding.alias !== undefined) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(binding.alias))
        throw new Error(`Invalid table alias: ${binding.alias}`);
      if (lookup.has(binding.alias)) throw new Error(`Duplicate table alias: ${binding.alias}`);
      lookup.set(binding.alias, binding);
    }
  }
  const root = await realpath(options.root);
  if (!(await stat(root)).isDirectory()) throw new Error('Customer root must be a directory');
  function bindingFor(name: string) {
    const binding = lookup.get(name);
    if (!binding) throw new Error(`Unknown table '${name}'`);
    return binding;
  }
  async function describe(binding: Readonly<TableBinding>, session: Session, text: string) {
    const columns = headerColumns(text.split('\n', 1)[0], binding.path);
    const schemaPath =
      binding.schemaPath === undefined
        ? join(dirname(binding.path), 'schema.json')
        : binding.schemaPath;
    const raw = schemaPath === null ? null : await session.optional(schemaPath);
    let contract: TableContract | null = null;
    if (raw !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      } catch (error) {
        throw new Error(`${schemaPath}: invalid JSON`, { cause: error });
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error(`${schemaPath}: invalid table metadata`);
      const value = parsed as TableContract;
      if (
        !Array.isArray(value.columns) ||
        JSON.stringify(value.columns.map((col) => col?.name)) !== JSON.stringify(columns)
      ) {
        throw new Error(`${schemaPath}: schema columns do not match TSV header`);
      }
      if (
        value.primary_key !== undefined &&
        (!Array.isArray(value.primary_key) ||
          value.primary_key.some((key) => !columns.includes(key)))
      ) {
        throw new Error(`${schemaPath}: invalid primary_key`);
      }
      contract = value;
    }
    return {
      table: binding.id,
      source: binding.path,
      schema_source: raw === null ? null : schemaPath,
      schema_status:
        schemaPath === null
          ? ('disabled' as const)
          : raw === null
            ? ('missing' as const)
            : ('present' as const),
      columns,
      contract,
      dataValidation: 'notRun' as const,
    };
  }
  async function rowsFor(name: string, session: Session) {
    const binding = bindingFor(name);
    const text = await session.read(binding.path);
    const description = await describe(binding, session, text);
    return { ...description, ...parseTable(text, binding.path) };
  }
  return {
    root,
    catalog() {
      return bindings.map((binding) => ({ ...binding }));
    },
    async schema(name: string) {
      const session = createReadSession(root);
      const binding = bindingFor(name);
      const description = await describe(binding, session, await session.read(binding.path));
      return { ...description, root, snapshot: await session.finish(expectedDigest) };
    },
    async read(input: { table: string; limit?: number }) {
      const limit = limitValue(input.limit);
      const session = createReadSession(root);
      const table = await rowsFor(input.table, session);
      return {
        ...table,
        rows: table.rows.slice(0, limit),
        root,
        snapshot: await session.finish(expectedDigest),
        total_count: table.rows.length,
        returned_count: Math.min(table.rows.length, limit),
        truncated: table.rows.length > limit,
      };
    },
    async search(input: SearchInput) {
      const limit = limitValue(input.limit);
      if (typeof input.query !== 'string' || !input.query.trim())
        throw new Error('Expected non-empty literal query');
      const query = input.query;
      const selectedFields = input.fields && [...input.fields];
      const session = createReadSession(root);
      const table = await rowsFor(input.table, session);
      const fields = selectedFields ?? table.columns;
      if (!fields.length || fields.some((field) => !table.columns.includes(field)))
        throw new Error('Unknown/empty search column selection');
      const needle = query.toLowerCase();
      const matches = table.rows.flatMap((row) => {
        const matched_fields = fields.filter((field) => row[field].toLowerCase().includes(needle));
        return matched_fields.length ? [{ row, matched_fields }] : [];
      });
      return {
        table: table.table,
        source: table.source,
        root,
        query,
        fields,
        dataValidation: 'notRun' as const,
        rows: matches.slice(0, limit).map((match) => match.row),
        matched_fields: matches.slice(0, limit).map((match) => match.matched_fields),
        total_count: matches.length,
        returned_count: Math.min(matches.length, limit),
        truncated: matches.length > limit,
        snapshot: await session.finish(expectedDigest),
      };
    },
  };
}
