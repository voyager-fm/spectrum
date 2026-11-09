# Repository document model, version 2

The canonical representation follows the document relationships used by Voyager app and web: TSV inventories with adjacent schemas, TOML policies, Markdown flows and interaction specs, web page bundles, and engineering knowledge. There is one editable owner for each fact.

## Sources and ownership

| Source | Owns | Derived consumers |
| --- | --- | --- |
| `information_architecture/*/data.tsv` | Objects, surfaces, regions and optional menus | FI references, contracts and specs |
| `feature_inventory/feature_categories/data.tsv` | Category identity and title | Feature classification |
| `feature_inventory/features/data.tsv` | Feature identity and category | Interaction grouping |
| `feature_inventory/interactions/data.tsv` | Interaction identity, lifecycle, phase and summary | Spec frontmatter mirror |
| Adjacent `schema.json` | Columns, types, required values, enums, primary keys and foreign keys | Deterministic table validation |
| `feature_specs/<category>/contracts/*.toml` | Shared policy, vocabulary, state models, reads/writes | Flows and interaction specs |
| `feature_specs/<category>/flows/*.md` | Interaction coverage, happy paths and failure handling | Interaction sources and review |
| `feature_specs/<category>/<feature_id>/*.md` | One interaction's detailed behavior and ACs | CLI, dashboard, host-agent context |
| `website/route_map/routes/{data.tsv,schema.json}` | Web route identity and declared implementation status | Page contract matching |
| `website/page_contracts/<page>/` | `contract.toml`, `layout.md`, `flow.md`, optional `spec.md` | Web experience and review |
| `engineering/<platform>/{architecture,guides,standards,decisions}/` | Technical knowledge and decisions | Development context |

`config.json` explicitly maps these sources. Paths are relative to the repository root. The [Voyager profile](../profiles/voyager.json) points directly at its existing `PRODUCT/`, `WEBSITE/` and `ENGINEERING/` owners. Customer vocabulary, optional columns, stable IDs and platform policy stay in the customer's files.

## Schemas

- [config.schema.json](config.schema.json): versioned source mapping, mode and declared flags.
- [inventory.schema.json](inventory.schema.json): the adjacent TSV schema vocabulary, including scalar and composite `ref` metadata.
- [interaction.schema.json](interaction.schema.json): YAML frontmatter mirror and optional document review annotation.
- [engineering.schema.json](engineering.schema.json): descriptive document and implementation lifecycle.

These JSON Schemas describe JSON objects and frontmatter mappings. The shared engine parses the actual TSV, Markdown and TOML and performs reference and coverage checks. It does not infer semantic agreement from file presence or run customer tests. It does not execute arbitrary JSON Schema extensions from customer documents.

## Table conventions

Use a header and a fixed column count with no blank rows. `-` means intentionally absent. `TBD` means undecided and produces a warning; primary keys require decided values. `<<AI>>` marks draft human-readable text and grants no approval. IDs are opaque, stable customer keys; there is no Spectrum-specific `SP-` ID requirement.

`ref.table` resolves a configured table name. `ref.column` targets one column and accepts `|`-separated references. Composite references use `columns` for the local tuple and `references` for the target tuple. The triggering column's absent value skips an optional parent reference. No menu or entitlement inventory is mandatory.

## Interaction document contract

FI owns `interaction_id`, `interaction_type`, `feature`, `category_key`, `feature_id`, `status`, `phase`, `summary`, `related_region`, `menu` and `shortcut` when those columns exist. Spec frontmatter mirrors those values exactly. Markdown owns the acceptance statements; use `- [ ] **AC-1:** ...`. IDs are positive, file-local and stable across reorder; gaps are preserved. Evidence keys are `<interaction_id>#AC-<n>`.

Legacy acceptance statements without IDs are retained in the derived model with `id: null` and an `invalid-ac` finding. The importer never invents stable IDs, discards the statements or marks them verified. Assigning new IDs is a reviewable migration of the canonical Markdown.

Keep these sections in order: Intent; Trigger / Entry Points; Preconditions; Expected Outcome; State Changes; User-visible Feedback; Edge Cases / Failure Handling; Acceptance Criteria; Permissions / Dependencies; Observability / Analytics; Related Interactions; Source. Optional Boundary Notes may add an explicit boundary. Fenced examples cannot satisfy sections, links or ACs. Source links identify parsed TOML contracts and flows; each linked flow lists the spec in Interaction Coverage.

Standard relative Markdown links and repository-root Wikilinks are supported. Wikilinks may omit `.md`. Local paths, including symlinks, stay inside the repository. Link targets are checked for existence; heading anchors and prose meaning require further review.

## Independent states

- FI `status`: idea, drafted, planned, implementing, shipped, deprecated. This preserves Voyager's declared interaction lifecycle; it is not a fresh execution result.
- FI `phase`: `-` (stable), now, next, later. Inline `[now]`, `[next]`, `[later]` and `[TBD]` remain product planning annotations.
- Optional `document_status`: draft, in_review, approved, changes_requested. Missing review metadata is untracked. This annotation grants no authenticated execution permission.
- Engineering `implementation_state`: current, target, mixed, historical. Lifecycle `status` is independent.
- AC verification: not_recorded until an implemented evidence adapter supplies an actual execution record. A checked Markdown box remains an author annotation.

Sources and Verification prose own engineering evidence. Spectrum does not require the retired Voyager `source_refs` machine contract. A runtime approval for exact edits still needs trusted identity, digest binding, revision/hash revalidation and an implemented apply adapter.

## Migration

Version 1 feature JSON and the standalone JSON draft model are retired. Spectrum's `SP-001` through `SP-004` feature IDs and their original acceptance statements are preserved in FI and interaction Markdown. [The migration guide](../engineering/common/guides/voyager_migration.md) describes profiles, verification and recovery. No automatic customer-document migration or remote publication runs during validation.
