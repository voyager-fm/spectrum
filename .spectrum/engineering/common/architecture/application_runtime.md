---
doc_type: topology
status: active
implementation_state: mixed
---

# Application runtime

## Decision and scope

`apps/web` is Spectrum's single server application, using Next.js App Router: the hosted application in [product layers](product_layers.md). It owns the dashboard, the GitHub connection and accounts, and the planned webhook, automation and model execution entry points. The CLI and agent plugin are the separate local tool and consume the same domain packages.

This decision establishes code ownership. It does not implement server APIs, select a hosting provider, configure credentials or authorize repository writes and external publication.

## Canonical traceability

- [Product layers](product_layers.md)
- [Distribution contract](../../../contracts/distribution.md)
- [GitHub connection contract](../../../contracts/github-connection.md)
- [Specification model](specification_model.md)
- [Dashboard contract](../../../product/feature_inventory/specs/dsh/contracts/dashboard.toml)
- [Runs surface contract](../../../product/feature_inventory/surfaces/web/runs/contract.toml)

## Ownership

| Owner | Responsibility | Current state |
| --- | --- | --- |
| Next.js Server Components and dashboard loader | Read the configured local repository or a connected GitHub repository at a pinned commit and render derived results | Implemented, read-only toward repositories |
| Next.js Route Handlers | Receive sign-in, App setup, check and webhook requests | Sign-in, sign-out, App setup and the JSON check route implemented; webhooks planned |
| Server services within `apps/web/src/lib/` | Coordinate the GitHub connection, accounts, setup detection, discovery, drafting, review and model calls through shared packages and adapters | GitHub connection, accounts and setup checklist implemented; drafting, review and model calls planned |
| Service database in `apps/web/src/db/` | Users, sessions, workspaces and stored check results (Postgres) | Implemented in account mode |
| `@spectrum/core` | Shared domain types and contracts | Implemented |
| `@spectrum/spec-engine` | Repository reads, parsing, structural validation and derived model | Implemented |
| `@spectrum/changeset` | Proposal rules shared by consumers | Partial approval/revision guard |
| `@spectrum/integrations` | GitHub App, user authorization and repository snapshot clients; Linear contract | GitHub implemented; Linear contract only |
| CLI and agent plugin (local tool) | Deterministic local commands; reasoning supplied by the user's host agent | Implemented; independent of this application |

## Current execution

Server Components load the local repository through `apps/web/src/lib/dashboard.ts` and connected repositories through `apps/web/src/lib/github.ts`, both with `@spectrum/spec-engine`. Pages render the derived model. The development and start scripts bind to `127.0.0.1`. The application never writes to a repository. Without account variables it runs in single-operator mode and keeps checks in memory. With them, it requires GitHub sign-in and stores checks in Postgres. Proposals, Runs and PR reviews show planned states without execution controls or synthetic results.

The local tool uses its CLI and the host agent's model. It does not depend on this application or a Spectrum model service. No queue, model adapter, agent run history, webhook receiver or remote review publisher exists.

## Planned server execution

1. A Route Handler receives an API request or integration delivery and validates its authentication and input against an implemented contract.
2. A server service coordinates shared domain packages and the required integration or model adapter.
3. The response or stored execution record identifies the repository revision and actual result. Approval and publication remain governed by their own contracts.

Keep orchestration in server modules and domain rules in workspace packages. Pages render results. Consumers import workspace packages through their public exports. When adapters are added, credentials stay on the server and unavailable capabilities remain explicit until implemented.

## Execution lifetime

Request-bound execution must fit the selected deployment's duration and resource limits. Next.js `after()` can run work after a response, within the route's configured or platform duration. It provides no persistent execution record or application retry policy.

When jobs require retry, deduplication or recovery after a restart, add persistent job state and queue delivery behind the same application service boundary. Choose the execution mechanism against the actual hosting limits and workload; a separate application is not required by the current architecture. Those guarantees remain unimplemented until their storage, delivery and failure behavior are verified.

## Verification

`pnpm check` covers shared types, domain behavior, structural specifications and plugin freshness. Browser smoke coverage checks that Runs remains visibly planned and offers no execution controls. These checks do not establish live model execution, webhook delivery or recovery guarantees.

## Sources

- Runtime owners: `apps/web/src/lib/dashboard.ts`, `apps/web/src/lib/github.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/db/`, `apps/web/src/app/`, `apps/cli/src/index.ts` and `packages/` in this repository.
- [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Next.js after duration](https://nextjs.org/docs/app/api-reference/functions/after#duration)
