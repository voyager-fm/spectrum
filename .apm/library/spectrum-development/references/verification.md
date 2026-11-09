# Verification and handoff

Reconstruct impact from the final files and their consumers, including generated bundles, fixtures and configuration. Match each requested behavior to its owning check. Retain still-valid evidence and rerun checks invalidated by the final change; do not substitute an unrelated passing suite for a failed boundary.

## Repository commands

Read the current root and affected package `package.json` scripts before running commands. These are the existing routes, not a new executor matrix.

| Change or claim | Required route and boundary |
| --- | --- |
| Development work | Run `pnpm format`, preserving unrelated work, then `pnpm check` before handoff. The latter runs lint, typechecks, unit/document tests, structural spec validation and plugin freshness checks. |
| Changed behavior | Run the owning regression suite and affected consumers. Confirm a nonzero executed test count; authored assertions and successful compilation are not executed coverage. |
| CLI or bundled dependencies | Run `pnpm plugin:build` when the checked-in bundle needs regeneration, then verify freshness through `pnpm plugin:check` or `pnpm check`. |
| UI behavior or presentation | Follow [spectrum-ui verification](../../spectrum-ui/references/verification.md) for build, browser and state evidence appropriate to the changed claim. |
| Development skill sources | Run `pnpm agents:sync`, review the lock and generated references, then `pnpm agents:setup` to verify the frozen restore. These commands audit deployment; they do not evaluate model behavior. |

## What each result proves

`pnpm spec:check` validates the configured TSV, TOML and Markdown model and its structural relationships. It does not prove semantic agreement, shipped implementation, executed acceptance criteria or live integrations. Declared document status and a Markdown checkbox are not execution evidence.

Mocks prove only the mocked boundary. Do not report them as live GitHub/Linear/model results. Static skill/frontmatter/link validation and APM audit prove structure and deployment, not effective agent decisions. Report model-run evaluation separately when it was actually performed.

Local checks, browser inspection, hosted CI and deployment are distinct. Report exact commands and outcomes as passed, failed, blocked or not run, with the reason for missing required evidence. Do not claim CI success from a local check.

## Failure and recovery

Read the first failing boundary and classify dependency installation, lint, typecheck, test assertion, zero-test selection and environment failures before retrying. An install or typecheck failure is a failed check, not a skipped test pass. Correct a wrong selector before broadening the run.

Repair within the approved scope and rerun the failed boundary. Stop bounded repair after two attempts when the root cause or product decision remains unresolved; report the attempts and needed decision. Continue independent authorized work when possible. Never weaken specifications, assertions or check selection to manufacture a passing result.

## Delivery

Return the changed paths and affected consumers, exact checks and results, unimplemented capabilities and unresolved decisions. Keep enough context in the existing task record for a continuation: scope, revision, accepted decisions, completed work, evidence and next action. A separate receipt system is unnecessary.

## Shared working tree

Other agents may edit, rebase and autostash in the same working tree. Their `git pull --rebase --autostash` can move your tracked edits into a stash for a while. Do not touch their rebase, stash, index or files. Wait until the rebase finishes, then confirm your edits came back.

- Verify the exact content you will commit in a clean export instead of the shared tree or a worktree. Extract `git archive HEAD` into the scratchpad and copy only your changed paths over it. When a file such as `pnpm-lock.yaml` also holds other agents' edits, apply only your hunk to the `HEAD` version. Then run `pnpm install --frozen-lockfile`, `pnpm check` and the affected builds there.
- Commit with explicit paths, for example `git add -- <paths>` followed by `git commit -m ... -- <paths>`, so another agent's staged changes stay out of your commit.
- Before pushing, fetch and confirm that `origin/main` is an ancestor of your commits. Check `git log origin/main..HEAD` so you do not publish another agent's unpushed commits by accident.
- Use a different port for your own servers when another agent's dev server is running. Do not restart or stop their processes.

Apply the session's actual authorization and current `AGENTS.md` workflow to commits, pushes and external actions. Implementation alone grants no additional permission; an active repository exception may already authorize a specific operation. Stage only the authorized change and do not infer publication, deployment, issue creation or review resolution from a code push.
