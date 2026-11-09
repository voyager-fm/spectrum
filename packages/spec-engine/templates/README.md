# Specification templates

This directory ships the reusable authoring files owned by `@spectrum/spec-engine`. `catalog.json` maps stable template IDs to source files and suggested repository-relative destinations. Spectrum's `.spectrum/` contains the product's actual records; these templates contain no Spectrum feature IDs or approval claims.

| IDs | Files and purpose |
| --- | --- |
| `repository.*` | Source mapping, overview and agent rules |
| `inventory.*.catalog`, `inventory.*.data` | The feature_inventory catalog and its FI categories/features/interactions, IA objects/surfaces/regions and routes tables; optional menus and custom catalogs |
| `feature.interaction` | Complete interaction frontmatter, all required sections and a stable `AC-1` task item |
| `feature.contract`, `feature.flow` | TOML vocabulary, policy, state model and reads/writes; Markdown coverage, happy/alternate paths and failures |
| `surface.*` | Surface bundle for one screen-level region: contract bound by `region`, layout, flow and optional experience specification |
| `engineering.adr` | A proposed architecture decision record with context, alternatives and consequences |

## Loading and rendering

Import `listTemplates`, `loadTemplate` and `renderTemplate` from `@spectrum/spec-engine/templates`. `loadTemplate(id)` returns the raw file and destination pattern so the caller can collect the values it needs. `renderTemplate(id, values)` returns `{ path, content }`. It writes no files, grants no approval, makes no model calls and publishes nothing. `spectrum init` renders the connected starter bundle through `renderStarterBundle` in `@spectrum/spec-engine/setup`. It writes the bundle only into a repository that has none of its paths yet.

Placeholders use `{{kind:field_name}}`:

- `text`: Markdown prose or a JSON string value. JSON is parsed before expansion and serialized afterward.
- `json`: a quoted scalar for YAML frontmatter or TOML, escaped with JSON string encoding.
- `tsv`: exactly one cell; tab, CR, LF and NUL are rejected.
- `path`: one safe filename segment. Paths, traversal and empty segments are rejected.

Every referenced field must be supplied, including prose. Use `TBD` for a genuinely undecided statement and `-` for confirmed absence; do not invent requirements to fill a template. Human review must replace the draft text before treating it as an approved product contract. Templates start with draft/planned annotations and never manufacture executed AC evidence.

## Connected starter bundle

The default repository configuration declares one catalog, `feature_inventory/schema.json`, whose tables sit beside it as flat TSV files, with feature bundles under `feature_inventory/specs/`, surface bundles under `feature_inventory/surfaces/<surface>/<region>/`, engineering and rules. Render the catalog and its tables, `feature.*`, `surface.*` and `repository.*` with consistent IDs; the route row and the surface contract name the same `structure_key`. Optional menus and custom catalogs require explicit `catalog` entries in the installed configuration. Engineering knowledge grows with the project; architecture, implementation, boundary, runbook and governance articles have no fixed authoring template here. The ADR destination includes a decision month; supply the full dated filename as `article_key` when adopting a date-based naming convention.

FI tables in the catalog extend the engine's `spectrum:*` base schemas. Base column types, keys and references remain in `src/base-schemas.ts`; repository extensions add their own fields. Rendered JSON files reference the engine's [JSON Schemas](../schemas/) by URL. No template installs a copy of an engine definition into a client, and a regression check enforces that.

## Verification

`src/templates.test.ts` renders the catalog into an isolated repository and runs the actual checker, YAML/Markdown and TOML parsers. It also checks escaping, traversal rejection, missing inputs, catalog table-name substitution and that rendered `$schema` values are engine URLs rather than installed copies. These checks prove structural usability, not that filled-in product behavior is implemented. Run `pnpm check` for the repository gate.


Engine installation policy is data in [scaffolding.json](scaffolding.json), consumed by `renderStarterBundle` in `src/setup.ts`. `templates` selects catalog IDs; `defaults` supplies starter values; `unresolved_value` fills undecided prose; `empty_document_roots` supplies a placeholder file only when a configured root has no selected documents. Output destinations remain in `catalog.json`. The blueprint is package control data, not a catalog entry or a generated customer specification.
