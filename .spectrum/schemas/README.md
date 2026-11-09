# Repository document model, version 2

The canonical representation connects TSV inventories declared in domain schema catalogs, TOML policies, Markdown flows and interaction specs, screen-level surface bundles, and engineering knowledge. There is one editable owner for each fact.

## Sources and ownership

| Source | Owns | Derived consumers |
| --- | --- | --- |
| `feature_inventory/{objects,surfaces,surface_structure}.tsv` | Objects, surfaces, regions and optional menus | FI references, contracts and specs |
| `feature_inventory/feature_categories.tsv` | Category identity and title | Feature classification |
| `feature_inventory/features.tsv` | Feature identity and category | Interaction grouping |
| `feature_inventory/interactions.tsv` | Interaction identity, lifecycle, phase and summary | Spec frontmatter mirror |
| Engine base schemas (`@spectrum/spec-engine`) | FI table names, primary keys and the category, feature and interaction columns the engine checks | Repository schema extensions |
| Domain `schema.json` catalog | Each table's TSV file, kind, column order and added columns | Deterministic table validation |
| `feature_inventory/specs/<category>/contracts/*.toml` | Shared policy, vocabulary, state models, reads/writes | Flows and interaction specs |
| `feature_inventory/specs/<category>/flows/*.md` | Interaction coverage, happy paths and failure handling | Interaction sources and review |
| `feature_inventory/specs/<category>/<feature_id>/*.md` | One interaction's detailed behavior and ACs | CLI, dashboard, host-agent context |
| `feature_inventory/routes.tsv` | Web route identity, its region and declared implementation status | Surface bundle matching |
| `feature_inventory/surfaces/<surface>/<region>/` | `contract.toml` bound by `region`, `layout.md`, `flow.md`, optional `spec.md` | Screen experience and review |
| `engineering/<platform>/{architecture,guides,standards,decisions}/` | Technical knowledge and decisions | Development context |

`config.json` explicitly maps these sources. Paths are relative to the repository root. A profile passed with `--profile` uses the same shape and can point directly at a repository's existing documentation directories. Customer vocabulary, optional columns, stable IDs and platform policy stay in the customer's files.

## Schemas

Reusable authoring files are shipped in [the spec-engine template library](../../packages/spec-engine/templates/README.md). The library includes schema/TSV pairs, complete interaction Markdown, contracts, flows, web page bundles and an ADR. Engineering articles develop with the project and are not generated from fixed document-type templates. Import its read-only loader and renderer through `@spectrum/spec-engine/templates`; generated documents still require human review and structural checks. `spectrum init` writes the connected starter bundle into a repository without one; it overwrites nothing.

- [config.schema.json](config.schema.json): versioned source mapping and mode.
- [inventory.schema.json](inventory.schema.json): the adjacent TSV schema vocabulary, including scalar and composite `ref` metadata.
- [inventory-extension.schema.json](inventory-extension.schema.json): an adjacent schema that extends an engine-owned FI base schema.
- [interaction.schema.json](interaction.schema.json): YAML frontmatter mirror and optional document review annotation.
- [engineering.schema.json](engineering.schema.json): descriptive document and implementation lifecycle.

These JSON Schemas describe JSON objects and frontmatter mappings. The shared engine parses the actual TSV, Markdown and TOML and performs reference and coverage checks. It does not infer semantic agreement from file presence or run customer tests. It does not execute arbitrary JSON Schema extensions from customer documents.

## FI base schemas

The engine owns the base schemas of the three FI tables. Each base fixes the table name, primary key, `-` null value and the columns whose meaning the engine checks:

| `extends` | Table | Primary key | Base columns |
| --- | --- | --- | --- |
| `spectrum:feature_categories` | `FEATURE_CATEGORIES` | `category_key` | `category_title`, `category_key` |
| `spectrum:features` | `FEATURES` | `feature_id` | `feature_category`, `category_key`, `feature_title`, `feature_id` |
| `spectrum:interactions` | `INTERACTIONS` | `interaction_id` | `interaction_title`, `interaction_id`, `interaction_type`, `feature`, `category_key`, `feature_id`, `status`, `phase`, `summary` |

An adjacent extension declares `extends` and lists every TSV column in header order. A base column appears by name, optionally with a `description`; its type, requiredness, enum and reference stay engine-owned. Added columns, such as `description`, `related_ui`, `related_region`, `menu` or `entitlement_key`, carry a full column definition. An extension cannot set `name`, `primary_key` or `null_values`, cannot redefine or omit a base column, and must extend the base for its configured inventory kind. The engine merges the extension onto the base before validating rows.

A schema without `extends` remains a complete standalone contract, so existing brownfield tables keep validating unchanged. The read-only table query API and `compat/python` read the adjacent file as written; they do not merge extensions.

## Table conventions

Use a header and a fixed column count with no blank rows. `-` means intentionally absent. `TBD` means undecided and produces a warning; primary keys require decided values. `<<AI>>` marks draft human-readable text and grants no approval. IDs are opaque, stable customer keys; the engine does not require Spectrum's own category prefixes.

`ref.table` resolves a configured table name. `ref.column` targets one column and accepts `|`-separated references. Composite references use `columns` for the local tuple and `references` for the target tuple. The triggering column's absent value skips an optional parent reference. No menu or entitlement inventory is mandatory.

## Interaction document contract

FI owns `interaction_id`, `interaction_type`, `feature`, `category_key`, `feature_id`, `status`, `phase`, `summary`, `related_region`, `menu` and `shortcut` when those columns exist. Spec frontmatter mirrors those values exactly. Markdown owns the acceptance statements; use `- [ ] **AC-1:** ...`. IDs are positive, file-local and stable across reorder; gaps are preserved. Evidence keys are `<interaction_id>#AC-<n>`.

Legacy acceptance statements without IDs are retained in the derived model with `id: null` and an `invalid-ac` finding. The importer never invents stable IDs, discards the statements or marks them verified. Assigning new IDs is a reviewable migration of the canonical Markdown.

Keep these sections in order: Intent; Trigger / Entry Points; Preconditions; Expected Outcome; State Changes; User-visible Feedback; Edge Cases / Failure Handling; Acceptance Criteria; Permissions / Dependencies; Observability / Analytics; Related Interactions; Source. Optional Boundary Notes may add an explicit boundary. Fenced examples cannot satisfy sections, links or ACs. Source links identify parsed TOML contracts and flows; each linked flow lists the spec in Interaction Coverage.

Standard relative Markdown links and repository-root Wikilinks are supported. Wikilinks may omit `.md`. Local paths, including symlinks, stay inside the repository. Link targets are checked for existence; heading anchors and prose meaning require further review.

## Independent states

- FI `status`: idea, drafted, planned, implementing, shipped, deprecated. This is a declared interaction lifecycle, not a fresh execution result.
- FI `phase`: `-` (stable), now, next, later. Inline `[now]`, `[next]`, `[later]` and `[TBD]` remain product planning annotations.
- Optional `document_status`: draft, in_review, approved, changes_requested. Missing review metadata is untracked. This annotation grants no authenticated execution permission.
- Engineering `implementation_state`: current, target, mixed, historical. Lifecycle `status` is independent.
- AC verification: not_recorded until an implemented evidence adapter supplies an actual execution record. A checked Markdown box remains an author annotation.

Sources and Verification prose own engineering evidence. A runtime approval for exact edits still needs trusted identity, digest binding, revision/hash revalidation and an implemented apply adapter.

## Migration

Version 1 feature JSON and the standalone JSON draft model are retired. Spectrum uses category-scoped feature IDs (VAL, DSH, AGT, LOOP, INT, SET and TRC) and category-local feature bundles. The explicit SP-to-category migration and historical ID mapping are recorded in [feature identity](../engineering/common/standards/feature_identity.md). Customer IDs remain opaque; no automatic customer-document migration or remote publication runs during validation.

## Planned implementation links

The planned [implementation-link contract](../product/feature_inventory/specs/trc/contracts/implementation_links.toml) defines an optional `### Implementation` subsection within an interaction's `## Source`. Ordinary Markdown links there declare implementation files and optional `#L<n>` or `#L<start>-L<end>` locations. They supplement, rather than replace, Source contract and flow links. Inline-code paths and prose are not declarations. Existing specs without implementation links remain valid. Resolution states, code navigation and the Connected code section are planned; neither a declared link nor file existence establishes executed AC evidence.

For example, a specification at `.spectrum/specs/APP-001.md` could declare the following target. This is a planned declaration format, not a generated file or a claim that the example implementation exists:

```markdown
## Source

- [Contract](../contracts/example.toml)
- [Flow](../flows/example.md)

### Implementation

- [Implementation](../../src/example.ts#L10-L24)
```

The two Source links retain document ownership. The Implementation link is an explicitly declared code relationship; it is not inferred from its label or file extension and does not establish implemented behavior.
