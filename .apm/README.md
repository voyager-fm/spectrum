# Spectrum development harness

Three authored Agent Skills provide development orchestration (including verification), dashboard UI and test authoring. Root AGENTS.md links them explicitly.

## Layout and APM ownership
- `.apm/library/<skill>/`: canonical authored skill sources. Each directory is a local APM package selected in root `apm.yml`.
- `apm.yml` and `apm.lock.yaml`: the dependency selection and its tracked lock (APM 0.35.0). No remote dependency is selected.
- `.agents/skills/` (Codex, OpenCode) and `.claude/skills/` (Claude Code): APM-generated native output, ignored by Git. Do not hand-edit them.

`pnpm agents:setup` runs `apm install --frozen` and `apm audit --ci`. It fails when a source differs from the lock. After intentionally editing a source, run `pnpm agents:sync` (`apm install` then audit) and review the `apm.lock.yaml` diff.

The APM CLI is not a project dependency; install it separately (for example the pinned `github:microsoft/apm` 0.35.0). Policy discovery may warn that an organization policy repository is unreadable; that warning is not policy enforcement.

These are instructions for agents developing Spectrum, not implementation of the product's hosted agent runtime. No tools, permissions, credentials, hooks or background jobs are enabled by adding these files.

## Validation status
Checked on 2026-11-09 with APM 0.35.0: `apm install` deployed every selected skill to both native roots, `apm audit --ci` passed 10/10 checks, and `apm install --frozen` rejected an unrecorded source edit. A Claude Code session listed the deployed skills. Codex and OpenCode discovery of `.agents/skills/` has not been observed.

Static file/frontmatter/link checks establish structure only. No model-run skill evaluation or production integration test has been performed.

## Selected workflows
- spectrum-development: outcome selection, specialist routing and verification for the plugin, CLI, Next.js application and shared packages.
- spectrum-ui: outcome-oriented copy, reuse decisions and actual surface evidence, while allowing useful developer-facing terms.
- spectrum-test-authoring: behavior-first assertions and a mocked-network browser test model. Avoid brittle implementation tests; this is not a ban on Spectrum's core schema validator.

Security checks are integrated into test authoring and review where they have a behavior owner; no standalone scanner or generic security agent was added. No UI framework, client configuration, MCP server, service credential, CI workflow or external review bot was enabled.

Removed on 2026-11-09 as redundant for the current scaffold: spectrum-review-feedback (overlapped verification and client-native review), references/delegation.md (its single-integration-owner rule remains in spectrum-development) and the never-run evals.json. spectrum-spec-authoring was also removed because it encoded the provisional document model; reintroduce it after the model's canonical serialization and IDs are frozen. spectrum-verification was folded into spectrum-development and spectrum-ui's verification guidance to keep the harness small during the build window.

`spectrum-development/SKILL.md` owns outcome selection and specialist routing. Its `references/authority-map.md`, `implementation.md` and `verification.md` hold the Spectrum-specific ownership, implementation and evidence details. Read them for the current phase rather than loading the entire harness.
