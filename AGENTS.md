# Working on Spectrum
Write all product content, specifications, and commit messages in English.
Read .spectrum/overview.md and .spectrum/rules/agents.md before changes.
Use TypeScript with erasable syntax and explicit .ts imports (Node >=22.18).
Keep the CLI, dashboard and worker on the shared spec-engine and core contracts.
Run pnpm check. Add regression tests for changed behavior.
Keep unimplemented integration paths explicit; never fabricate successful model calls or reviews.
Keep specs aligned with changes, but distinguish planned requirements from verified functionality.
Do not commit, push, publish, or create external issues without explicit user authorization.

## Development harness
Skill sources live in `.apm/library/<skill>/` and are selected in `apm.yml`. After cloning, run `pnpm agents:setup` to restore native skills from `apm.lock.yaml` into `.agents/skills/` (Codex, OpenCode) and `.claude/skills/` (Claude Code) and audit them. After editing a skill source, run `pnpm agents:sync` to redeploy and record the new lock. The native outputs are generated and ignored: never hand-edit them.

- Non-trivial implementation and verification before handoff: [spectrum-development](.apm/library/spectrum-development/SKILL.md).
- UI behavior, copy or visual review: [spectrum-ui](.apm/library/spectrum-ui/SKILL.md).
- Test and fixture authoring: [spectrum-test-authoring](.apm/library/spectrum-test-authoring/SKILL.md).

For a bounded specialist task, use that skill directly without restarting orchestration. Load only the workflow needed for the task; do not run every skill. See [.apm/README.md](.apm/README.md) for provenance, scope and validation limits.
