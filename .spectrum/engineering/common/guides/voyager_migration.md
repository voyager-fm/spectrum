---
doc_type: runbook
status: active
implementation_state: mixed
---

# Adopting the Voyager documentation profile

## Overview

Use a source profile to connect Voyager's existing canonical files before considering physical relocation. The app and web consumers share documentation but retain their product and engineering ownership. This guide changes no source repository, gitlink, branch or remote state automatically.

## Canonical traceability

- [Document model](../../../schemas/README.md)
- [Voyager profile](../../../profiles/voyager.json)
- [Architecture](../architecture/specification_model.md)

## Engineering scope

This procedure reads an existing local documentation repository. It checks document structure and relationships. It does not rewrite approved behavior, infer shipped status, run customer tests or authorize publication.

## Prerequisites

Use Node 22.18+ and this repository's locked workspace dependencies. Inspect current repository rules, work in progress, documentation revisions and consumer gitlinks. Keep unrelated changes intact. Select the actual canonical documentation root rather than an arbitrary app checkout.

## Procedure

1. Review `profiles/voyager.json`. Its inventory paths target the existing `PRODUCT` IA/FI tables and `WEBSITE` routes. Its document roots target feature specs, page bundles, engineering and repository rules.
2. Run `pnpm cli check /path/to/voyager-documentation --profile /path/to/spectrum/.spectrum/profiles/voyager.json`.
3. Inspect findings by owner. Distinguish malformed source, a stale reference, an undecided requirement and a new validator assumption. Do not weaken product ACs to make the import pass.
4. For a permanent connection, install the reviewed profile as `.spectrum/config.json` in the selected repository through its normal authorized review workflow. The source files can remain at their current paths.
5. If physical relocation is separately approved, update inbound Markdown/Wikilinks, schema references and consumer pointers together. Preserve IDs, optional domain columns, contract policy, AC IDs and all original statements.

## Success criteria

Every selected table and document is readable, stable IDs and relationships are preserved, structural errors are resolved or explicitly reviewed, and warnings remain visible. Document approval, current/target state and execution evidence retain their separate meanings. A successful local read does not prove customer app or web implementation, hosted CI or deployment.

## Failure and recovery

The checker writes no files. Correct an unsuitable profile and rerun the affected check. Source repairs and customer-document migrations need their own authorized scope. Preserve existing gitlinks and uncommitted work. The Spectrum v1 self-spec migration preserved `SP-001` through `SP-004` and every original acceptance statement in FI and Markdown; historical file bodies remain available through Git and the local pre-change baseline.

## Verification

The engine's regression fixtures exercise existing-path profiles without relocating canonical files, including app-style interactions and website page bundles. Use `pnpm check` for Spectrum. Record a real profile read's revision, findings and limitations in the task response; do not present a profile file's existence as completed Voyager adoption.

## Sources

- [Voyager engineering governance](https://github.com/voyager-fm/voyager-documentation/blob/8c844a446d8fb8e8fbd8c4554b31d6e13ead83a1/ENGINEERING/common/standards/documentation.md)
- Local implementation: `packages/spec-engine/src/config.ts`, `inventory.ts`, `markdown.ts` and `index.ts`.

## Open questions

The authority to publish canonical-document changes and move app/web consumer pointers remains a separate migration decision. Customer-specific deep semantic checks need their own contract owners.
