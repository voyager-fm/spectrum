# Read-only table queries

Status: implemented shared-package API; CLI/plugin commands are a separate integration.

`createTableQuery` is exported by `@spectrum/spec-engine`. Callers supply an absolute
customer root and explicit qualified table bindings, with optional aliases and schema
paths. No package identity, table basename inference or mandatory tabular inventory
is required. Empty catalogs support Markdown-only projects.

The API exposes catalog, schema, read and literal case-insensitive substring search.
It preserves cell strings, source order, field-match evidence and total/returned/
truncated counts. Missing, disabled and present metadata are distinct. Structure/header
checks do not establish value/PK/FK validation; results explicitly say notRun for that.

Each operation reads fresh customer data inside the canonical root and checks observed
sources before returning. Escaping/dangling symlinks, changed inputs and stale selected
digests fail. Evidence is worktree/selected-sources, not a whole repository or commit
snapshot. Commit reads are unsupported. No SQL, shell, writes, sync or publish is exposed.

Colocated reader/query tests exercise parsing, counts, metadata, path boundaries,
two-root isolation and source-change detection. These checks do not establish model
review, atomic filesystem snapshots or live external integration.
