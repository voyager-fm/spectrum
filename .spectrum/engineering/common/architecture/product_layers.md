---
doc_type: boundary
status: active
implementation_state: mixed
---

# Product layers

## Decision and scope

Spectrum is two products built on one shared engine:

1. **The local tool.** The `@voyager-fm/spectrum` command line (`apps/cli`), the agent plugin (`apps/plugin`) and the repository skills the CLI installs. A user installs it and runs it in their own repository and coding agent. It is deterministic: it needs no account, model credential or network connection, and the user's host agent does the reasoning. The local tool is open source.
2. **The hosted application.** The Next.js application in `apps/web`. It connects repositories through a GitHub App, checks them at pinned commits, keeps accounts, workspaces and check history, and shows the results in a dashboard. Automation grows here: webhooks, GitHub Actions, pull request review and the cloud specification-improvement loop.

Both read the same repository files through the shared packages, so a repository checked locally and in the dashboard gives the same result. How each product is distributed and licensed beyond that is decided separately. The dependency rules below keep the two separable.

## Layers

| Layer | Deliverables | Runs | Owns | Does not |
| --- | --- | --- | --- | --- |
| Local tool | `apps/cli`, `apps/plugin`, repository skills | In the user's repository and host agent | `check`, `list`, `init`, `skills install`, `status`; the plugin launcher; agent guidance | Make network requests, keep accounts or state outside the repository, call models, or depend on the hosted application |
| Hosted application | `apps/web` | On a Spectrum server: single-operator on a local machine, or with accounts | Repository connection, pinned-commit checks, accounts and workspaces, stored check history, dashboard, setup checklist; later webhooks, Actions, review and the cloud loop | Install the local tool or write to a customer repository outside an approved contract; the setup checklist shows commands for the user to run |
| Shared packages | `@spectrum/core`, `@spectrum/spec-engine`, `@spectrum/changeset` | Inside both products | Specification format, parsing, validation, templates, setup detection, proposal guard | Depend on either product, a network service or a database |
| Hosted adapters | `@spectrum/integrations` | Inside the hosted application | GitHub App, user authorization and repository snapshot clients; Linear contract | Reach the local tool |

## Dependency rules

1. Shared packages depend on neither product. Specification format rules live only in `@spectrum/spec-engine`.
2. The local tool imports only the shared packages. It never imports `apps/web`, `@spectrum/integrations`, database, authentication or server modules. The plugin bundles the CLI's source because it distributes the CLI; that stays inside the local layer.
3. The hosted application reads what the local tool produces only through the repository's files and the shared packages. It runs the same check through `@spectrum/spec-engine` and detects setup with `@spectrum/spec-engine/setup`, the code behind `spectrum status`. It does not import `apps/cli` or `apps/plugin`.
4. The local tool works without the hosted application. A future local command that calls a hosted API must be opt-in, and every offline command keeps working without it.
5. Behavior both products need goes into a shared package first, then into each consumer.
6. Credentials, accounts and stored history belong to the hosted application's server. They never appear in repository files, local tool output or the shared packages.

## Features by layer

| Layer | Categories and features |
| --- | --- |
| Local tool | VAL commands, AGT, SET-001 to SET-003 |
| Hosted application | DSH, INT, SET-004, TRC; LOOP pages (planned) |
| Shared | The engine behind VAL, used by both products |

A local proposal command (propose and apply in the CLI) is a separate, unspecified local-tool capability. LOOP features describe the hosted loop.

## Current state

- **Local tool:** `check`, `list`, `init`, `skills install` and `status` are implemented. The CLI package is distributed as a tarball and is not published to npm. The plugin launcher runs the repository-pinned, global or bundled CLI.
- **Hosted application:** implemented today:
  - the dashboard for the local repository;
  - read-only GitHub App connection and checks at pinned commits;
  - single-operator and account modes, with workspaces derived from GitHub installations;
  - check history stored in Postgres in account mode;
  - the setup checklist.

  Not implemented: webhooks, GitHub Actions automation, pull request review, model execution, the cloud loop and Linear. The [GitHub connection contract](../../../contracts/github-connection.md) and the [application runtime](application_runtime.md) record the details.

## Verification

Today, only `@spectrum/integrations` and the database modules are hosted-only, and only `apps/web` imports them. No automated import check enforces these rules; review applies them. `pnpm check` verifies each product's behavior and the shared engine, not the layer boundary itself.

## Sources

- [Distribution contract](../../../contracts/distribution.md)
- [Application runtime](application_runtime.md)
- [Specification model](specification_model.md)
- [GitHub connection contract](../../../contracts/github-connection.md)
