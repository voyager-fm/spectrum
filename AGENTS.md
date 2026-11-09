# Working on Spectrum
Write all product content, specifications, and commit messages in English.
Read .spectrum/overview.md and .spectrum/rules/agents.md before changes.
Use TypeScript with erasable syntax and explicit .ts imports (Node >=22.18).
Keep the engine (`apps/`, `packages/`) and Spectrum's own client specifications (`.spectrum/`) separate: specification format definitions live only in `packages/spec-engine/`, and `.spectrum/` and template output contain only what a customer repository would contain. See [the boundary rules](.apm/library/spectrum-development/references/repository-boundary.md).
Keep the plugin, CLI and Next.js application on the shared workspace packages (@spectrum/core, spec-engine, changeset). apps/web owns the dashboard and planned server API, webhook and model execution entry points; see .spectrum/contracts/distribution.md and .spectrum/engineering/common/architecture/application_runtime.md.
Use the root Biome configuration for shared linting, formatting and import organization; do not add ESLint or Prettier. Run `pnpm format` after development work and `pnpm check` before handoff. Use `pnpm lint:fix` for safe lint and import fixes. Add regression tests for changed behavior.
Keep unimplemented integration paths explicit; never fabricate successful model calls or reviews.
Keep specs aligned with changes, but distinguish planned requirements from verified functionality.
Do not commit, push, publish, or create external issues without explicit user authorization, except as the temporary hackathon workflow below allows.

## Temporary: hackathon workflow
This section is temporary. Remove it when the hackathon ends; it applies from 2026-11-09 until then.
- Work on `main` only. Do not create feature branches, worktrees or pull requests, and do not push to any branch other than `origin/main`.
- Commit and push finished, verified work to `origin/main` as you go, in small commits split by scope. This authorizes commits and pushes to `main` only; publishing, releases and external issues still need explicit approval.
- Several agents share this working tree. Stage only the paths you changed (`git add <paths>`, never `git add -A`), and never stash, reset, check out or reformat another agent's uncommitted changes.
- Before pushing, run `pnpm check`, then `git pull --rebase --autostash origin main`. If the rebase conflicts or the autostash does not reapply cleanly, stop and tell the user; never drop a stash.

## Development harness
Skill sources live in `.apm/library/<skill>/` and are selected in `apm.yml`. After cloning, run `pnpm agents:setup` to restore native skills from `apm.lock.yaml` into `.agents/skills/` (Codex, OpenCode) and `.claude/skills/` (Claude Code) and audit them. After editing a skill source, run `pnpm agents:sync` to redeploy and record the new lock. The native outputs are generated and ignored: never hand-edit them.

- Non-trivial implementation and verification before handoff: [spectrum-development](.apm/library/spectrum-development/SKILL.md).
- UI behavior, copy or visual review: [spectrum-ui](.apm/library/spectrum-ui/SKILL.md).
- Test and fixture authoring: [spectrum-test-authoring](.apm/library/spectrum-test-authoring/SKILL.md).

For a bounded specialist task, use that skill directly without restarting orchestration. Load only the workflow needed for the task; do not run every skill. See [.apm/README.md](.apm/README.md) for provenance, scope and validation limits.
