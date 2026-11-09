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
Node 22.18+ is required; `.nvmrc` pins the development runtime to Node 24.13.0. pnpm is pinned to 10.20.0. From this directory:

```sh
nvm install
nvm use
pnpm install
pnpm check
pnpm spec:list
pnpm dev
```
Open http://127.0.0.1:3000. The Next.js dashboard reads this repository's own .spectrum directory at request time; set `SPECTRUM_REPOSITORY=/path/to/repository` to read another local repository. `pnpm cli check /path/to/repository` validates another compatible repository without writing to it.

Web browser tests: install Chromium with `pnpm --filter @spectrum/web exec playwright install chromium`, then run `pnpm test:e2e` (or `pnpm test:e2e:ui`). See [web development](apps/web/README.md) for server reuse and reports. Browser tests run separately from `pnpm check`.

### Code quality
The root `biome.json` is shared by every app and package. Biome is pinned in the root development dependencies; use the workspace binary through pnpm rather than a global installation.

| Command | Purpose |
| --- | --- |
| `pnpm lint` | Check lint rules, formatting and import organization without writing files; warnings fail the check |
| `pnpm lint:fix` | Apply formatting, safe lint fixes and import organization |
| `pnpm format` | Format files without applying lint fixes |
| `pnpm format:check` | Check formatting without writing files |
| `pnpm check` | Run Biome, typechecks, tests, spec validation and plugin validation |

JavaScript, TypeScript, JSX/TSX, JSON/JSONC and CSS use two spaces, LF line endings and a 100-column target. JavaScript strings use single quotes, JSX attributes use double quotes, and statements use semicolons. Tailwind CSS v4 directives are supported. `.editorconfig` supplies matching editor defaults.

Biome respects `.gitignore`, including generated build output and deployed agent skills. The generated `apps/plugin/skills/*/scripts/spectrum.mjs` bundles are also excluded; regenerate them with `pnpm plugin:build`. Markdown, YAML, TOML and TSV are outside automatic code formatting so specification and harness source formats stay intact.

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

### Repository document model

`.spectrum/config.json` uses `schema_version: 2` and maps canonical repository-relative paths. IA and FI use TSV with adjacent schemas; TOML owns shared policy and read/write ownership; Markdown owns interaction behavior, flows and stable AC IDs. Website routes have page contract/layout/flow bundles, and engineering documents retain their own lifecycle. CLI, plugin and dashboard read the same derived model.

Read the [schema guide](.spectrum/schemas/README.md) and [architecture](.spectrum/engineering/common/architecture/specification_model.md). Existing repositories can keep their current paths with a profile:

```sh
pnpm cli check /path/to/voyager-documentation --profile .spectrum/profiles/voyager.json
```

The checker writes no files. It reports structural errors and unresolved warnings; it does not approve requirements or run customer tests. Legacy feature-only JSON configuration reports an explicit migration boundary. [The migration guide](.spectrum/engineering/common/guides/voyager_migration.md) describes source mapping, preservation and recovery.

## Implemented vs planned
Working: local spec listing/checking, validation failures, a local dashboard and a Claude Code plugin whose `spectrum` skill runs those checks.
Planned: AI generation, brownfield indexing, proposal review/apply UI, exact digest-bound approvals, GitHub App and signed webhooks, issue sync, hosted accounts/DB, model providers/BYOK/subscriptions.
This is a scaffold, not a running autonomous closed loop. No credentials are required and no external requests are made by the app. No deployment or git initialization is performed.
