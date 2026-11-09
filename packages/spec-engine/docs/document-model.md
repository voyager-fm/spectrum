# Repository document model, version 2

This guide defines how any repository writes specifications that `@spectrum/spec-engine` reads and checks. The engine owns this format. A client repository holds only its own records and refers to the format through `$schema` URLs and `extends` IDs; it never holds a copy of these definitions.

The model connects TSV inventories, TOML policies, Markdown flows, interaction specs, surface bundles and engineering knowledge. There is one editable owner for each fact.

## Sources and ownership

Paths below are the default layout. `config.json` maps the actual sources, and paths are relative to the repository root. A profile passed with `--profile` uses the same shape and can point directly at a repository's existing documentation directories. Customer vocabulary, optional columns, stable IDs and platform policy stay in the customer's files.

| Source | Owns | Derived consumers |
| --- | --- | --- |
| `product/feature_inventory/schema.json` | The domain catalog: each table's TSV file, kind, column order and added columns | Deterministic table validation |
| `product/feature_inventory/{objects,surfaces,surface_structure}.tsv` | Objects, surfaces and their regions | FI references, contracts, specs and surface bundles |
| `product/feature_inventory/feature_categories.tsv` | Category identity and title | Feature classification |
| `product/feature_inventory/features.tsv` | Feature identity and category | Interaction grouping |
| `product/feature_inventory/interactions.tsv` | Interaction identity, lifecycle, phase and summary | Spec frontmatter mirror |
| `product/feature_inventory/routes.tsv` | Web route identity, path, region and declared implementation status | Surface bundle requirements |
| Engine base schemas | FI table names, primary keys and the category, feature and interaction columns the engine checks | Catalog tables that `extends` them |
| `product/feature_inventory/specs/<category>/contracts/*.toml` | Shared policy, vocabulary, state models, reads/writes | Flows and interaction specs |
| `product/feature_inventory/specs/<category>/flows/*.md` | Interaction coverage, happy paths and failure handling | Interaction sources and review |
| `product/feature_inventory/specs/<category>/<feature_id>/*.md` | One interaction's detailed behavior and ACs | CLI, dashboard, host-agent context |
| `product/feature_inventory/surfaces/<surface>/<region>/` | One screen-level region: `contract.toml`, optional `layout.md`, `flow.md` and `spec.md` | Screen experience and review |
| `engineering/<platform>/{architecture,guides,standards,decisions}/` | The project's technical knowledge and decisions | Development context |

There are two units of specification. An interaction spec describes one behavior and is bound to an `INTERACTIONS` row. A surface bundle describes one screen-level region, such as a web page, a command output or an agent skill, and is bound to a `SURFACE_STRUCTURE` row. Every surface may have its own bundles.

## Schemas

These JSON Schemas live in [`../schemas/`](../schemas/). Client files reference them by URL, for example `"$schema": "https://raw.githubusercontent.com/voyager-fm/spectrum/main/packages/spec-engine/schemas/inventory-catalog.schema.json"`.

- `config.schema.json`: versioned source mapping and mode.
- `inventory-catalog.schema.json`: a domain catalog declaring several tables and their TSV files.
- `inventory.schema.json`: a standalone single-table schema for brownfield layouts, including scalar and composite `ref` metadata.
- `interaction.schema.json`: YAML frontmatter mirror and optional document review annotation.
- `engineering.schema.json`: descriptive document and implementation lifecycle.

`$schema` only helps editors. The engine checks the actual TSV, Markdown and TOML and performs reference and coverage checks. It does not infer semantic agreement from file presence or run customer tests. It does not execute arbitrary JSON Schema extensions from customer documents.

[The template library](../templates/README.md) renders the client files of a connected starter bundle; `spectrum init` writes them into a repository without one and overwrites nothing. Rendered files reference this format; they do not install it.

## Inventory catalogs

Each domain directory has one `schema.json` catalog. Its `tables` mapping names every table in that domain. In the configuration, list the catalog as `{ "catalog": "<path>/schema.json" }`.

```json
{
  "$schema": "https://raw.githubusercontent.com/voyager-fm/spectrum/main/packages/spec-engine/schemas/inventory-catalog.schema.json",
  "schema_version": "1.0",
  "tables": {
    "FEATURES": {
      "data": "features.tsv",
      "extends": "spectrum:features",
      "columns": [
        { "name": "feature_category" },
        { "name": "category_key" },
        { "name": "feature_title" },
        { "name": "feature_id" },
        { "name": "description", "type": "string", "required": false }
      ]
    },
    "OBJECTS": {
      "kind": "objects",
      "data": "objects.tsv",
      "primary_key": ["key"],
      "null_values": ["-"],
      "columns": [{ "name": "key", "type": "string", "required": true }]
    }
  }
}
```

- The table key is the table name, and `ref.table` resolves it across all configured catalogs.
- `data` is a TSV path relative to the catalog. It must stay inside the repository.
- `columns` lists every TSV column in header order.
- A table that extends a base schema takes its kind, name, primary key and null value from the base. Otherwise, the table declares `kind`, `primary_key` and complete column definitions.
- `schema_version` belongs to the catalog. A table definition cannot set `name` or `schema_version`.

An invalid table definition fails its whole catalog at the catalog path, naming the table. A missing or malformed TSV file fails only that table.

## FI base schemas

The engine owns the base schemas of the three FI tables. Each base fixes the table name, primary key, the `-` null value and the columns whose meaning the engine checks:

| `extends` | Table | Primary key | Base columns |
| --- | --- | --- | --- |
| `spectrum:feature_categories` | `FEATURE_CATEGORIES` | `category_key` | `category_title`, `category_key` |
| `spectrum:features` | `FEATURES` | `feature_id` | `feature_category`, `category_key`, `feature_title`, `feature_id` |
| `spectrum:interactions` | `INTERACTIONS` | `interaction_id` | `interaction_title`, `interaction_id`, `interaction_type`, `feature`, `category_key`, `feature_id`, `status`, `phase`, `summary` |

- A base column appears in `columns` by name, optionally with a `description`. Its type, requiredness, enum and reference stay engine-owned.
- Added columns carry a full definition. Examples are `description`, `related_ui`, `related_region`, `menu` and `entitlement_key`.
- A catalog table cannot redefine or omit a base column. Its key must equal the base table name.
- The engine merges the definition onto the base before validating rows.

## Surface bundles

A surface bundle is a directory with a `contract.toml` whose `[contract]` declares `id` and `region`. `region` names a row of the `regions` table, keyed by its single-column primary key. Map the bundle root as `{ "kind": "surface_bundle", "root": "<path>" }`; the directory names below it are free.

```toml
[contract]
id = "web.overview"
region = "web.overview"
```

- `layout.md`, `flow.md` and `spec.md` in the same directory are the bundle's layout, flow and screen spec. Only the contract is required.
- Each region has at most one surface bundle.
- A surface contract does not declare `page_id`, `path` or `implementation_status`. Route facts belong to the route table.
- A route row whose `type` is empty or `page` and whose `region` is set needs a surface bundle for that region, and that bundle needs `layout.md` and `flow.md`.
- Shared contract checks, such as unique contract IDs, categories, primary objects and ownership, apply to surface contracts too.

A region can stand without a bundle. Describe a sub-section in its parent's `layout.md` instead.

### Brownfield page bundles

Existing repositories can keep `{ "kind": "page_bundle", "root": "<path>" }`. A page contract declares `page_id`, `path` and optionally `implementation_status`, which must match its route row. A route row without a `region` needs such a page contract.

## Brownfield single-table schemas

Existing repositories can keep one directory per table, with `data.tsv` beside a standalone `schema.json`. Map each table as `{ "kind", "data", "schema" }`. A standalone schema declares `name`, `primary_key` and every column, and it cannot use `extends`. Move a table into a domain catalog to build on a base schema.

The read-only table query API and `compat/python` read a standalone schema file as written. They do not read catalogs or merge base schemas.

## Table conventions

- **Shape**: use a header and a fixed column count, with no blank rows.
- **`-`** means intentionally absent.
- **`TBD`** means undecided and produces a warning. Primary keys require decided values.
- **`<<AI>>`** marks draft human-readable text and grants no approval.
- **IDs** are opaque, stable customer keys. The engine imposes no ID prefix.

`ref.table` resolves a configured table name. `ref.column` targets one column and accepts `|`-separated references. Composite references use `columns` for the local tuple and `references` for the target tuple. The triggering column's absent value skips an optional parent reference. No menu or entitlement inventory is mandatory.

## Interaction document contract

FI owns `interaction_id`, `interaction_type`, `feature`, `category_key`, `feature_id`, `status`, `phase`, `summary`, `related_region`, `menu` and `shortcut` when those columns exist. Spec frontmatter mirrors those values exactly.

Markdown owns the acceptance statements, written as `- [ ] **AC-1:** ...`. IDs are positive, file-local and stable across reorder, and gaps are preserved. Evidence keys are `<interaction_id>#AC-<n>`.

Acceptance statements without IDs are retained in the derived model with `id: null` and an `invalid-ac` finding. The importer never invents stable IDs, discards the statements or marks them verified. Assigning new IDs is a reviewable migration of the canonical Markdown.

Keep these sections in order:

1. Intent
2. Trigger / Entry Points
3. Preconditions
4. Expected Outcome
5. State Changes
6. User-visible Feedback
7. Edge Cases / Failure Handling
8. Acceptance Criteria
9. Permissions / Dependencies
10. Observability / Analytics
11. Related Interactions
12. Source

- An optional Boundary Notes section may add an explicit boundary.
- Fenced examples cannot satisfy sections, links or ACs.
- Source links identify parsed TOML contracts and flows. Each linked flow lists the spec in Interaction Coverage.

Standard relative Markdown links and repository-root Wikilinks are supported. Wikilinks may omit `.md`. Local paths, including symlinks, stay inside the repository. Link targets are checked for existence; heading anchors and prose meaning require further review.

## Independent states

- FI `status`: idea, drafted, planned, implementing, shipped, deprecated. This is a declared interaction lifecycle, not a fresh execution result.
- FI `phase`: `-` (stable), now, next, later. Inline `[now]`, `[next]`, `[later]` and `[TBD]` remain product planning annotations.
- Optional `document_status`: draft, in_review, approved, changes_requested. Missing review metadata is untracked. This annotation grants no authenticated execution permission.
- Engineering `implementation_state`: current, target, mixed, historical. Lifecycle `status` is independent.
- AC verification: not_recorded until an implemented evidence adapter supplies an actual execution record. A checked Markdown box remains an author annotation.

Sources and Verification prose own engineering evidence. A runtime approval for exact edits still needs trusted identity, digest binding, revision/hash revalidation and an implemented apply adapter.

## Migration

Version 1 feature JSON and the standalone JSON draft model are retired. No automatic customer-document migration or remote publication runs during validation.
