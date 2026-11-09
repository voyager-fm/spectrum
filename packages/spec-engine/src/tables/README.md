# Read-only TSV queries

`createTableQuery` from `@spectrum/spec-engine` provides typed `catalog()`, `schema(name)`,
`read({ table, limit? })` and `search({ table, query, fields?, limit? })` operations.
The package also exports the table binding, metadata, query option and search input types.

Supply an absolute customer `root` and an explicit `tables` array:

```ts
import { createTableQuery } from '@spectrum/spec-engine';

const query = await createTableQuery({
  root: '/absolute/customer/project',
  tables: [
    { id: 'inventory:billing/items', path: 'billing/items/data.tsv', alias: 'items' },
    { id: 'inventory:shipping/items', path: 'shipping/items/data.tsv' },
  ],
});
const result = await query.search({ table: 'items', query: '100%', limit: 20 });
```

IDs contain a nonempty namespace and identity separated by `:`. Short aliases
are optional, explicitly selected identifiers. Duplicate IDs/aliases fail. No
basename inference, directory discovery, package identity, product-specific tree or TSV
is required; an empty catalog is valid for a Markdown-only customer project.
`catalog()` describes configured bindings, not verified file existence. Source
and metadata paths are checked when queried.

## Behavior

- Search is literal, case-insensitive substring matching using JavaScript
  `toLowerCase()`. `%`, `_`, quotes and SQL-looking text have no special meaning.
  Fields default to all header columns; unknown/empty selections fail. Source row
  order is preserved. `matched_fields` parallels the returned `rows` array.
- Read/search default to 50 results and accept integer limits from 1 to 10000.
  `total_count` counts all selected rows (all matches for search),
  `returned_count` counts returned rows, and `truncated` reports omission.
- TSV uses one physical line per record. BOM/CRLF and doubled quotes in quoted
  cells are supported. Duplicate/invalid headers, ragged/blank rows, malformed
  quoted cells and quoted tabs/newlines fail. Cells remain raw strings, including
  `001`, `-`, `TBD`, `<<AI>>`, Unicode and literal quotes in unquoted cells.
- Schema reads the header and adjacent `schema.json` by default. Use a relative
  `schemaPath` to select another metadata file, or `null` to disable metadata.
  Missing, disabled and present metadata have distinct `schema_status` values.
  Present JSON must be an object with ordered `columns[].name` matching the
  header and, when declared, a `primary_key` array naming existing columns.
  Malformed JSON/metadata fails rather than being treated as missing.
- Schema deliberately does not parse data rows. Read/search validate TSV
  structure but do not validate row values, declared types, PK uniqueness,
  foreign keys or other metadata constraints. `dataValidation: 'notRun'` states
  this boundary explicitly. Metadata is returned as `contract`, without claiming
  that any particular validation dialect was applied.

## Evidence and boundaries

Results carry the canonical customer root, selected source and worktree evidence.
`snapshot.scope: 'selected-sources'` and `contentDigest` cover observed bytes plus
observed metadata absence, not the whole repository, Git status or a verified
commit. The digest is scoped to the selected operation's paths. An optional
`snapshot: { kind: 'worktree', contentDigest }` rejects stale selected content.
Commit reads explicitly fail until a materialization adapter exists.

Every operation uses a fresh read session; later calls see edits and concurrent
roots share no table/cache registration. Observed files and missing metadata are
rechecked before returning. Changed bytes, deleted files, appeared metadata and
retargeted observed symlinks fail. Paths must stay within the canonical root,
including symlink targets and dangling optional symlinks. UTF-8 decoding is strict.
These are optimistic filesystem checks, not an atomic filesystem snapshot or a
sandbox against concurrent hostile filesystem mutation.

Queries never rewrite customer data. There is no SQL text, SQL engine, shell
command, checker execution, sync/write flag, relation enrichment or feature-show
API in this slice.

Run the colocated regressions with:

```sh
node --test packages/spec-engine/src/tables/reader.test.ts packages/spec-engine/src/tables/query.test.ts
```
