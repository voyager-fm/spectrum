---
doc_type: topology
status: active
implementation_state: mixed
---

# Repository specification architecture

## Overview

Spectrum represents a repository's product, website and engineering documentation while preserving customer-owned vocabulary and paths. `config.json` selects canonical TSV, TOML and Markdown sources. The engine produces a derived repository model; CLI, plugin and dashboard consume that model.

## Canonical traceability

- [Document ownership and schemas](../../../schemas/README.md)
- [Validation contract](../../../product/feature_inventory/specs/val/contracts/validation.toml)
- [Dashboard contract](../../../product/feature_inventory/specs/dsh/contracts/dashboard.toml)
- [Proposal contract](../../../product/feature_inventory/specs/loop/contracts/proposal.toml)
- [Distribution architecture](../../../contracts/distribution.md)
- [Application runtime](application_runtime.md)

## Engineering scope

This document owns document parsing, deterministic reference checks and consumer data boundaries. Product policy remains in contracts and interaction specs. It does not select customer implementation architecture, deployment infrastructure, model credentials or repository permissions.

## Components and ownership

| Owner | Responsibility |
| --- | --- |
| `@spectrum/core` | Shared source, inventory, document, relationship, finding and proposal types |
| `@spectrum/spec-engine` | Safe repository reads; TSV/schema, YAML/Markdown and TOML parsing; references, mirrors and bundle checks |
| `spec-engine/compat` | Preserved revision-bound snapshot and structured Markdown compatibility APIs, with separate regressions |
| `@spectrum/changeset` | Existing partial approval/revision guard |
| CLI | Check/list argument handling and JSON/exit contract |
| Agent plugin | Host-agent context and a reproducible bundle of that CLI |
| Next.js application (`apps/web`) | Dashboard loader and page rendering; owns planned server API, webhook and model execution entry points |
| `@spectrum/integrations` | GitHub/Linear adapter contracts; connectivity is unimplemented |

FI owns mirrored metadata; Markdown owns ACs. Inventory `ref` metadata produces relationships without rewriting source files. Contracts preserve domain-specific tables, policies, state models and reads/writes. App interaction flows and web route/page bundles remain distinct document roles.

## Dependencies

The engine uses `yaml` for frontmatter, `marked` for Markdown token structure and `smol-toml` for TOML. Code blocks and inline examples supply no executable instructions or product evidence. Repository paths are canonicalized before reads; external symlinks and traversal fail validation. External URLs are references and are not fetched by validation.

## Current implementation

The version 2 engine returns configuration, inventories, documents, relationships, interaction specs and findings. Errors fail `ok`; unresolved values remain warnings. It checks primary/foreign keys, composite parents, pipe-separated references, FI/spec mirrors, unique AC IDs, contract IDs/ownership, flow coverage, page contracts and local path containment. Profiles map existing repository paths without moving files.

The engine owns base schemas for `FEATURE_CATEGORIES`, `FEATURES` and `INTERACTIONS`: table names, primary keys and the columns behind its category, feature and mirror checks. A domain `schema.json` catalog declares several tables and their TSV files. A catalog table declaring `extends` lists its header order and adds only its own columns; the engine merges it onto the base before row validation. The configuration still accepts one adjacent schema per table for brownfield layouts.

The TypeScript checker reads the current working tree. The preserved snapshot helpers are an explicit compatibility API; a normal check does not acquire an immutable repository snapshot automatically.

Engineering metadata preserves document type, lifecycle and descriptive implementation state. Sources and Verification stay in prose. Document review annotations, FI lifecycle and Markdown checkboxes never synthesize successful test evidence.

## Accepted target

Semantic policy review, automatic spec generation, authenticated digest-bound approval, transactional apply, customer test evidence ingestion, remote discovery and hosted review publication require implemented adapters. The Next.js application owns their server entry points and coordinates shared domain packages; [application runtime](application_runtime.md) defines that boundary. The existing proposal guard checks only review status, base revision and nonempty edits. A structurally valid repository is not proof that the target behavior or any external integration works.

## Verification

Behavior tests use temporary repositories with brownfield inventories, contracts, flows, frontmatter and web page bundles. They exercise malformed sources, stale references, metadata disagreement, missing coverage, stable AC IDs and unsafe paths. `pnpm check` is the local convergence gate; the plugin bundle must be regenerated when the shared CLI changes. Actual command outcomes belong to the task's execution record.

## Sources

Runtime owners are `packages/core/src/index.ts`, `packages/spec-engine/src/`, `apps/cli/src/index.ts` and `apps/web/src/lib/dashboard.ts` in this repository. These paths identify implementation; tests and check receipts establish executed evidence separately.

## Open questions

Semantic validation of arbitrary customer contract fields, exact approval digest normalization and authenticated evidence ingestion remain open. Full customer-repository validation may reveal existing inconsistencies; importing a profile does not approve or repair them.
