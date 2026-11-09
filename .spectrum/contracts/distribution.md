# Distribution contract

Spectrum ships as an agent plugin: a bundle of skills that runs inside the user's coding agent (Claude Code first; other Agent Skills hosts later). The host agent's model does the judgment. A bundled deterministic CLI does everything that must be exact. Spectrum does not need its own model credentials on this path.

## Repository layout
- `apps/` holds three deliverables: `apps/plugin` is the agent plugin, `apps/web` the Next.js application, and `apps/cli` the deterministic command line, packaged as `@voyager-fm/spectrum` with a `spectrum` binary (packable, not yet published to npm).
- `packages/` holds shared libraries consumed as workspace packages (`@spectrum/<name>`) through package `exports`, never through relative paths into another package.
  - `core`: shared types and contracts.
  - `spec-engine`: reading, relationship and validation of `.spectrum/`.
  - `changeset`: proposal approval and staleness rules.
  - `integrations`: GitHub/Linear adapter contracts.
- `.claude-plugin/marketplace.json` at the repository root lists `apps/plugin`, so `claude plugin marketplace add <owner>/<repo>` installs it.
- Skills for *developing* Spectrum stay in `.apm/library/`. Product skills live only in `apps/plugin/skills/`. Neither copies the other.

## Server application
`apps/web` owns the dashboard and all planned server entry points: APIs, GitHub webhooks, integration calls and model execution. Route Handlers receive external HTTP requests; server services coordinate shared packages and implemented adapters. Domain parsing, validation and proposal rules stay in the workspace packages for reuse by the CLI and plugin.

Today only local read-only dashboard views are executable. Server APIs, webhooks, model execution and saved run history remain unimplemented. The plugin's host-agent reasoning path continues to work independently of these planned services.

Persistent execution state and queue delivery can be added when jobs require automatic retry or restart recovery. Execution duration and delivery guarantees depend on the deployment environment. See [application runtime](../engineering/common/architecture/application_runtime.md) for the accepted structure and execution limits.

## Plugin rules
1. `apps/plugin/.claude-plugin/plugin.json` declares a kebab-case `name`, `version`, `description` and `author`.
2. Each skill is `apps/plugin/skills/<name>/SKILL.md` and follows the Agent Skills specification:
   - YAML frontmatter with `name` and `description`, one `key: value` per line.
   - `name`: 1–64 characters of `a-z`, `0-9` and single hyphens, equal to the directory name.
   - `description`: 1–1024 characters, stating what the skill does and when to use it.
   - Body at most 500 lines. Relative links stay inside the skill directory and resolve to existing files.
3. Skills run their own `scripts/spectrum.mjs`, located through the skill base directory the host reports. It is a launcher that picks the CLI, so checks use the version the repository pins:
   1. The repository's pinned `@voyager-fm/spectrum`, searched from the working directory up to the Git root: `node_modules` (npm, Yarn classic and hoisted workspaces), pnpm's hidden hoist directory `node_modules/.pnpm/node_modules`, then a Yarn Plug'n'Play project that declares the package, run through `yarn run spectrum`.
   2. Otherwise the first `spectrum` on `PATH`, only when its package manifest identifies `@voyager-fm/spectrum` and its version is newer than the bundle. Discovery reads manifests and never executes an unidentified `spectrum`.
   3. Otherwise the bundled CLI.

   Stdout and the exit status belong to the CLI that ran; stderr names it and its version and explains any skipped candidate. A pinned CLI older than the bundle still runs, with a version note. When that older CLI rejects the invocation with usage status 2, the launcher runs the bundled CLI instead and says so. A CLI that started and failed otherwise is not rerun, because it may have written files. The plugin has no top-level `bin/`, so installation is not limited to hosts that accept executables on `PATH`.
4. `scripts/spectrum.mjs` is a build output of `apps/cli` behind the launcher in `apps/plugin/src/launcher.ts`, checked in so a Git-based install works. The plugin check fails when the checked-in bundle differs from a fresh build.
5. A skill describes only commands that exist. Planned capabilities are not presented to the agent as available.
6. Host support is stated per host and only after verification. Claude Code is the first target. No other host manifest ships until its format and behavior are verified.

## Repository installation
A client repository can adopt Spectrum without the plugin:

1. `npm install --save-dev @voyager-fm/spectrum` pins the CLI. The package is one bundled script with the spec templates embedded and has no runtime dependencies.
2. `spectrum init` writes `.spectrum/config.json` and a connected starter bundle. It is all-or-nothing and overwrites no existing path.
3. `spectrum skills install` writes one generated skill to `.claude/skills/spectrum/SKILL.md` and `.agents/skills/spectrum/SKILL.md`. The skill runs the repository's own binary. Files carry a provenance marker; the command updates only marked files unless `--force` is given.

Repository skills and the plugin are alternatives for the same guidance; a repository needs one. `@spectrum/spec-engine/setup` owns these paths so the CLI and the dashboard detect the same setup. Commands that write never leave the repository root or follow links out of it. Publishing the package to npm needs explicit approval and has not happened.

## Verification
`pnpm check` validates every skill and the manifest and checks bundle freshness. `claude plugin validate apps/plugin` is the authoritative Claude Code manifest check when the `claude` binary is available.
