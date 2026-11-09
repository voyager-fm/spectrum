# Distribution contract

Spectrum ships as an agent plugin: a bundle of skills that runs inside the user's coding agent (Claude Code first; other Agent Skills hosts later). The host agent's model does the judgment. A bundled deterministic CLI does everything that must be exact. Spectrum does not need its own model credentials on this path.

## Repository layout

- `apps/` holds deliverables only. `apps/plugin` is the agent plugin, `apps/web` the dashboard, `apps/cli` the deterministic command line (an unpublished workspace package for now). `apps/worker` is a placeholder until a hosted GitHub review path exists.
- `packages/` holds shared libraries consumed as workspace packages (`@spectrum/<name>`) through package `exports`, never through relative paths into another package.
  - `core`: shared types and contracts.
  - `spec-engine`: reading, relationship and validation of `.spectrum/`.
  - `changeset`: proposal approval and staleness rules.
  - `integrations`: GitHub/Linear adapter contracts.
- `.claude-plugin/marketplace.json` at the repository root lists `apps/plugin`, so `claude plugin marketplace add <owner>/<repo>` installs it.
- Skills for _developing_ Spectrum stay in `.apm/library/`. Product skills live only in `apps/plugin/skills/`. Neither copies the other.

## Plugin rules

1. `apps/plugin/.claude-plugin/plugin.json` declares a kebab-case `name`, `version`, `description` and `author`.
2. Each skill is `apps/plugin/skills/<name>/SKILL.md` and follows the Agent Skills specification:
   - YAML frontmatter with `name` and `description`, one `key: value` per line.
   - `name`: 1–64 characters of `a-z`, `0-9` and single hyphens, equal to the directory name.
   - `description`: 1–1024 characters, stating what the skill does and when to use it.
   - Body at most 500 lines. Relative links stay inside the skill directory and resolve to existing files.
3. Skills run the deterministic CLI from their own `scripts/spectrum.mjs`, located through the skill base directory the host reports. The plugin has no top-level `bin/`, so installation is not limited to hosts that accept executables on `PATH`.
4. `scripts/spectrum.mjs` is a build output of `apps/cli`, checked in so a Git-based install works. The plugin check fails when the checked-in bundle differs from a fresh build.
5. A skill describes only commands that exist. Planned capabilities are not presented to the agent as available.
6. Host support is stated per host and only after verification. Claude Code is the first target. No other host manifest ships until its format and behavior are verified.

## Verification

`pnpm check` validates every skill and the manifest and checks bundle freshness. `claude plugin validate apps/plugin` is the authoritative Claude Code manifest check when the `claude` binary is available.
