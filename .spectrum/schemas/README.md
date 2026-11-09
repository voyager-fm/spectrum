# Spectrum document schema draft 0.1

This draft generalizes Voyager's category → feature → interaction inventory and object/surface → contract → flow → interaction spec relationships. It does not require a top-level PRODUCT/ENGINEERING split. Existing files and applications were left unchanged when this draft was added.

## Files
- document-model.schema.json: JSON Schema Draft 2020-12 definitions, shapes, required fields, and state enums.
- ../examples/review/model.json: one minimal feature bundle and its relationships.
- contracts/*.toml, flows/*.md, and specs/*.md in the example: sample document bodies. Paths are relative to the parent directory of model.json.

## Layers and canonical sources
- object: product objects and state vocabulary.
- surface: touchpoints such as CLI, web, API, and background processing. Desktop menus and shortcuts are optional.
- category → feature → interaction: linked through stable IDs, with one spec per interaction.
- contract: shared states, policies, and read/write ownership. TOML is the canonical body.
- flow: paths and failure branches between interactions. Markdown is the canonical body.
- spec: detailed behavior and acceptance criteria. In this draft, model.json is the canonical source for ACs; Markdown references them. UI rendering is planned but not implemented.
- external_links: references to GitHub/Linear issues and pull requests only. These do not authorize automatic synchronization or posting.

## Separate status dimensions
Keep phase (now/next/later/undecided), implementation (unverified/planned/in_progress/implemented/released), review (draft/in_review/approved/changes_requested), and AC verification (not_run/passed/failed) separate. Document approval alone does not change implementation to implemented or verification to passed. Approved documents require an actor, timestamp, and content digest. This record does not by itself establish authenticated identity or execution permission.

## Validation beyond the schema
JSON Schema alone does not establish the following:
1. Unique IDs, valid foreign keys, and consistent feature/category and bidirectional interaction/spec relationships.
2. Consistent contract/flow/spec references and interaction coverage.
3. Existing relative paths and repository-boundary checks, including symlinks.
4. Required Markdown sections, matching frontmatter IDs, and matching TOML contract IDs.
5. AC IDs unique within each spec, with evidence for passed/failed verification.
6. Matching approval content digests, trusted actors, and revalidated base revisions.
7. Consistent object-state vocabulary and contract/flow/spec meaning. Distinguish deterministic checks from human review.

## Markdown shell
Intent; Trigger / Entry Points; Preconditions; Expected Outcome; State Changes; User-visible Feedback; Edge Cases / Failure Handling; Acceptance Criteria; Permissions / Dependencies; Observability / Analytics; Related Interactions; Source.

## Explicit assumptions and open decisions
- JSON inventory is a provisional serialization choice. To use TSV with a schema as Voyager does, preserve this relationship model and define a separate adapter. Do not create independently editable JSON and TSV canonical sources.
- TBD in prose means undecided; implementation unverified means not verified. Do not use TBD as a stable ID.
- The approval digest's file bundle and normalization rules, and schema migration rules, require further design.
- Detailed TOML contract fields remain illustrative. This JSON Schema does not validate TOML.
- The current app reads only the existing .spectrum/features/SP-*.json files. It neither reads nor validates this new model. A passing existing spec:check does not validate the new model.
