# Spectrum
AI-powered product specs for your codebase.

## Quick start
Node 22.18+ and pnpm 10 are required. From this directory:

```sh
pnpm install
pnpm check
pnpm spec:list
pnpm dev
```
Open http://127.0.0.1:3000. The dashboard reads this repository's own .spectrum directory. `pnpm cli check /path/to/repository` validates another compatible repository without writing to it.

## Structure
- apps/cli: deterministic check/list commands
- apps/web: tiny Node HTTP read-only dashboard; replace with a full web framework as UI requirements settle
- apps/worker: explicit nonfunctional queue/job boundary
- packages/core: shared spec and proposal types
- packages/spec-engine: parsing, local links and validation
- packages/agent-runtime: agent interface and partial proposal approval guard
- packages/integrations: GitHub/Linear adapter contracts only
- .spectrum: Spectrum's own feature specs, shared contracts, flows and rules
- `*.test.ts` next to each package source: deterministic regression tests

## Implemented vs planned
Working: local spec listing/checking, validation failures and a local dashboard.
Planned: AI generation, brownfield indexing, proposal review/apply UI, exact digest-bound approvals, GitHub App and signed webhooks, issue sync, hosted accounts/DB, model providers/BYOK/subscriptions.
This is a scaffold, not a running autonomous closed loop. No credentials are required and no external requests are made by the app. No deployment or git initialization is performed.
