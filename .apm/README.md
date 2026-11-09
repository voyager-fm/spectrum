# Spectrum development harness

Three authored Agent Skills provide development orchestration (including verification), dashboard UI and test authoring. Root AGENTS.md links them explicitly.

## Layout and APM ownership
- `.apm/library/<skill>/`: canonical authored skill sources. Each directory is a local APM package selected in root `apm.yml`.
- `apm.yml` and `apm.lock.yaml`: the dependency selection and its tracked lock (APM 0.35.0). No remote or Voyager Common dependency is selected.
- `.agents/skills/` (Codex, OpenCode) and `.claude/skills/` (Claude Code): APM-generated native output, ignored by Git. Do not hand-edit them.

`pnpm agents:setup` runs `apm install --frozen` and `apm audit --ci`. It fails when a source differs from the lock. After intentionally editing a source, run `pnpm agents:sync` (`apm install` then audit) and review the `apm.lock.yaml` diff.

The APM CLI is not a project dependency; install it separately (for example the pinned `github:microsoft/apm` 0.35.0 used by voyager-app). Policy discovery may warn that the Voyager org policy repository is unreadable; that warning is not policy enforcement.

These are instructions for agents developing Spectrum, not implementation of the product's hosted agent runtime. No tools, permissions, credentials, hooks or background jobs are enabled by adding these files.

## Provenance and adaptation
Inspected local sources on 2026-11-09:
- voyager-app/AGENTS.md: scope, owner/caller inspection, evidence and protected actions.
- voyager-app/.apm/library/voyager-dev-orchestration/SKILL.md: scope/discover/decide/implement/verify/deliver and narrow specialist routing.
- voyager-app/.apm/library/voyager-dev-orchestration/references/authority-map.md and references/task-handoff.md: conditional authority lookup and continuation context in the existing task record.
- voyager-app/.apm/library/code-tooling/references/verification-coverage-review.md: select evidence from the final diff and affected consumers, with distinct proof boundaries.
- voyager-app/.apm/library/voyager-dev-test-authoring/SKILL.md: assertion ownership and actual nonzero execution evidence.
- voyager-web/AGENTS.md and .apm/library/voyager-web-workflow/SKILL.md: product contracts before behavior changes, reuse before abstraction and proportional verification.
- voyager-app/apm_modules/voyager-common/internal/pr-review/SKILL.md: review the current snapshot and distinguish deterministic routing from semantic findings.
- voyager-app/apm_modules/voyager-common/internal/skill-author/SKILL.md and references/phase-1-standardization.md: standard frontmatter, explicit triggers and behavioral evaluation boundaries.

The workflows are newly written Spectrum adaptations of these conventions. No source application code, Common implementation scripts, vendor packages or original skill bodies were copied. No license entitlement or hackathon eligibility is inferred from local access; review source licenses before future verbatim redistribution. Adapting instructions alone does not establish eligibility under event rules.

Not imported: Swift/TCA, Cloudflare/OpenNext, Supabase/checkout policy, Korean-only product wording, documentation submodule branch procedures, voyager-app's scoped instruction compilation and setup script, user-specific tool permissions, automatic PR execution or deployment.

## Validation status
Checked on 2026-11-09 with APM 0.35.0: `apm install` deployed every selected skill to both native roots, `apm audit --ci` passed 10/10 checks, and `apm install --frozen` rejected an unrecorded source edit. A Claude Code session listed the deployed skills. Codex and OpenCode discovery of `.agents/skills/` has not been observed.

Static file/frontmatter/link checks establish structure only. No model-run skill evaluation or production integration test has been performed.

## Additional selected workflows
- spectrum-ui: adapted from voyager-app/.apm/library/voyager-dev-user-facing-copy/SKILL.md and voyager-dev-reuse-evaluation/SKILL.md, plus voyager-web/.apm/library/voyager-web-e2e/SKILL.md. Keeps outcome-oriented copy, reuse decisions and actual surface evidence, while allowing useful developer-facing terms.
- spectrum-test-authoring: adapts Voyager test ownership and the web E2E behavior-first, mocked-network model. The web no-boundary-checker-tests guidance informs avoiding brittle implementation tests; it is not imported as a ban on Spectrum's core schema validator.

Security checks are integrated into test authoring and review where they have a behavior owner; no standalone scanner or generic security agent was added. No UI framework, client configuration, MCP server, service credential, CI workflow or external review bot was enabled. Source project licensing and event reuse eligibility remain separate questions for any future verbatim code reuse.

Removed on 2026-11-09 as redundant for the current scaffold: spectrum-review-feedback (overlapped verification and client-native review), references/delegation.md (its single-integration-owner rule remains in spectrum-development) and the never-run evals.json. spectrum-spec-authoring was also removed because it encoded the provisional document model; reintroduce it after the model's canonical serialization and IDs are frozen. spectrum-verification was folded into spectrum-development and spectrum-ui's verification guidance to keep the harness small during the build window.

`spectrum-development/SKILL.md` owns outcome selection and specialist routing. Its `references/authority-map.md`, `implementation.md` and `verification.md` hold the Spectrum-specific ownership, implementation and evidence details. Read them for the current phase rather than loading the entire harness. This adapts Voyager's reference routing to the plugin/CLI/Next.js/shared-package layout; it does not add a Common dependency or import native tooling.
