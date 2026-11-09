# Implementation boundaries

Choose one coherent slice from the confirmed owners, preserved invariants and required evidence. Update the behavior owner and necessary consumers together. If a contract conflict or a new consumer changes the decision, return to discovery before widening the write scope.

## Shared domain and deliverables

Keep shared domain rules in `packages/`; consumers import `@spectrum/<name>` through package exports. Use TypeScript with erasable syntax and explicit `.ts` imports within a package. Inspect existing APIs before adding another abstraction.

The CLI owns deterministic commands. The product plugin distributes those commands and host-agent instructions; its checked-in `scripts/spectrum.mjs` is generated from the CLI. A CLI or transitive domain change can require a plugin rebuild even when no plugin source changed.

The Next.js application owns dashboard rendering and planned server entry points. Keep repository loading and server coordination in `apps/web/src/lib/`, domain rules in shared packages and pages focused on rendering. Read the application-runtime architecture from the configured engineering root before introducing server behavior; resolve missing guidance before making a runtime decision.

Current local read-only views and partial proposal guards do not establish remote discovery, authenticated approvals, model calls, webhook delivery or saved execution history. Keep unavailable capabilities explicit until their adapters and behavior are implemented and verified. Choose deployment configuration only when the task actually includes a deployment decision.

## Specialist work

Use [spectrum-ui](../../spectrum-ui/SKILL.md) for dashboard or CLI presentation changes. It owns component reuse, states, copy and visual evidence. Use [spectrum-test-authoring](../../spectrum-test-authoring/SKILL.md) before adding or changing assertions and fixtures; add regression coverage for changed behavior in the owning suite.

If parallel work is explicitly requested or authorized, separate behavior/schema/compile ownership, not merely filenames. Keep one integration owner. Logical discovery, implementation and review roles do not require separate agents.

## Specifications and harness changes

Update affected specifications with the implementation, preserving IDs and acceptance criteria. Keep accepted targets and verified current behavior distinguishable; a structural validator pass cannot close an unimplemented requirement.

Author development skills in `.apm/library/<skill>/`. Keep the entry skill focused on shared workflow and routing, with conditional detail in linked `references/`. Do not hand-edit `.agents/skills/` or `.claude/skills/`; regenerate through `pnpm agents:sync` and review the lock diff. Product skills remain under `apps/plugin/skills/` and follow their own distribution contract.

Preserve unrelated work throughout implementation, formatting and generation. Select checks from the final diff using [verification](verification.md).
