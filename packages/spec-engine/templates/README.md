# Specification templates

This directory ships the reusable authoring files owned by `@spectrum/spec-engine`. `catalog.json` maps stable template IDs to source files and suggested repository-relative destinations. Spectrum's `.spectrum/` contains the product's actual records; these templates contain no Spectrum feature IDs or approval claims.

| IDs | Files and purpose |
| --- | --- |
| `schema.*` | JSON Schema definitions for configuration, standalone inventories, inventory extensions, interaction frontmatter and engineering metadata |
| `repository.*` | Source mapping, overview and agent rules |
| `inventory.*.schema`, `inventory.*.data` | FI categories/features/interactions, IA objects/surfaces/regions, routes, optional menus and custom tables |
| `feature.interaction` | Complete interaction frontmatter, all required sections and a stable `AC-1` task item |
| `feature.contract`, `feature.flow` | TOML vocabulary, policy, state model and reads/writes; Markdown coverage, happy/alternate paths and failures |
| `page.*` | Page contract, layout, flow and optional experience specification |
| `engineering.adr` | A proposed architecture decision record with context, alternatives and consequences |

## Loading and rendering

Import `listTemplates`, `loadTemplate` and `renderTemplate` from `@spectrum/spec-engine/templates`. `loadTemplate(id)` returns the raw file and destination pattern so the caller can collect the values it needs. `renderTemplate(id, values)` returns `{ path, content }`. It writes no files, grants no approval, makes no model calls and publishes nothing. The CLI currently implements check/list; it has no template generation command.

Placeholders use `{{kind:field_name}}`:

- `text`: Markdown prose or a JSON string value. JSON is parsed before expansion and serialized afterward.
- `json`: a quoted scalar for YAML frontmatter or TOML, escaped with JSON string encoding.
- `tsv`: exactly one cell; tab, CR, LF and NUL are rejected.
- `path`: one safe filename segment. Paths, traversal and empty segments are rejected.

Every referenced field must be supplied, including prose. Use `TBD` for a genuinely undecided statement and `-` for confirmed absence; do not invent requirements to fill a template. Human review must replace the draft text before treating it as an approved product contract. Templates start with draft/planned annotations and never manufacture executed AC evidence.

## Connected starter bundle

The default repository configuration selects FI, IA, route/page bundles, feature bundles, engineering and rules. Render its corresponding inventory pairs, `feature.*`, `page.*`, `repository.*` and `schema.*` with consistent IDs. Optional menus and custom tables require explicit entries in the installed configuration. Engineering knowledge grows with the project; architecture, implementation, boundary, runbook and governance articles have no fixed authoring template here. The ADR destination includes a decision month; supply the full dated filename as `article_key` when adopting a date-based naming convention.

FI schema templates extend the engine's `spectrum:*` base schemas. Base column types, keys and references remain in `src/base-schemas.ts`; repository extensions add their own fields. JSON Schema definitions in `schemas/` are shipped authoring assets. `.spectrum/schemas/` is the self-repository installation; update both through review when changing the format. A regression check prevents these installed definitions from drifting.

## Verification

`src/templates.test.ts` renders the catalog into an isolated repository and runs the actual checker, YAML/Markdown and TOML parsers. It also checks escaping, traversal rejection, missing inputs and schema installation consistency. These checks prove structural usability, not that filled-in product behavior is implemented. Run `pnpm check` for the repository gate.
