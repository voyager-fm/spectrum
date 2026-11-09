# Spectrum

AI-powered product specs for your codebase.

## Install the plugin

Spectrum ships as an agent plugin. Your coding agent does the reasoning; a bundled deterministic CLI does the checks. No model credentials are needed.

```sh
claude plugin marketplace add voyager-fm/spectrum
claude plugin install spectrum@spectrum
```

Inside Claude Code 2.1.275 or later: `/plugin install spectrum --marketplace voyager-fm/spectrum`. Claude Code is the only verified host so far.

## Develop

Node 22.18+ and pnpm 10 are required. From this directory:

```sh
pnpm install
pnpm check
pnpm spec:list
pnpm dev
```

Open http://127.0.0.1:3000. The Next.js dashboard reads this repository's own .spectrum directory at request time; set `SPECTRUM_REPOSITORY=/path/to/repository` to read another local repository. `pnpm cli check /path/to/repository` validates another compatible repository without writing to it.

## Structure

`apps/` holds deliverables and `packages/` shared workspace libraries; see `.spectrum/contracts/distribution.md`.

- apps/plugin: the agent plugin. Skills in `skills/<name>/SKILL.md` run a bundled CLI from `scripts/spectrum.mjs`; `pnpm plugin:build` regenerates it and `pnpm plugin:check` validates skills and bundle freshness
- apps/cli: deterministic check/list commands (unpublished; bundled into the plugin)
- apps/web: Next.js (App Router) read-only dashboard with Tailwind CSS v4 and shadcn/ui in a monotone theme. Overview, specs, spec detail, rules and integrations read real repository data; proposals, runs and PR reviews are explicit not-implemented placeholders
- apps/worker: explicit nonfunctional queue/job boundary
- packages/core: shared spec and proposal types
- packages/spec-engine: parsing, local links and validation
- packages/changeset: proposal approval and staleness guard (partial)
- packages/integrations: GitHub/Linear adapter contracts only
- .spectrum: Spectrum's own feature specs, shared contracts, flows and rules
- `*.test.ts` next to each package source: deterministic regression tests

## Implemented vs planned

Working: local spec listing/checking, validation failures, a local dashboard and a Claude Code plugin whose `spectrum` skill runs those checks.
Planned: AI generation, brownfield indexing, proposal review/apply UI, exact digest-bound approvals, GitHub App and signed webhooks, issue sync, hosted accounts/DB, model providers/BYOK/subscriptions.
This is a scaffold, not a running autonomous closed loop. No credentials are required and no external requests are made by the app. No deployment or git initialization is performed.
