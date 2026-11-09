---
name: spectrum-verification
description: "Review Spectrum changes against specs and test owners; select deterministic, integration and UI evidence and report failed or missing coverage. Use before implementation handoff or when checking a proposed change."
---

# Spectrum verification

## Reconstruct impact
Read the final changed files and affected consumers, not just the implementation plan. Separate schema structure, product acceptance, technical unit behavior, integration and presentation claims. Use real stable IDs when available; technical tests need not invent product interactions.

## Evidence selection
- Existing runtime checks: pnpm test (colocated `*.test.ts` under apps/ and packages/) and node apps/cli/src/index.ts check from the repository root. Confirm a nonzero executed test count.
- Full project check: pnpm check when dependencies and tooling are available. Report install/typecheck failures rather than treating a Node test run as a substitute.
- New draft model: the legacy CLI does not validate it. Check schema conformance with a compatible validator when available, then separately check foreign keys, paths, TOML/Markdown IDs, flow coverage, AC evidence and approval consistency. State partial checks precisely.
- Web changes: verify the actual changed route/API and error paths. Visual claims need browser evidence; HTTP 200 alone proves neither layout quality nor interactive behavior.
- GitHub/Linear/model-provider changes: mock contract evidence and live integration evidence are distinct. Test signature verification, duplicate delivery, stale revision, credential boundaries and retry behavior when implemented. Do not post externally merely to complete a test.

## Review and return
Preserve original assertions during repairs. Explain skipped, failed, blocked and unimplemented boundaries. Do not declare all checks passed when a required check was not run. A second independent review is useful for cross-boundary risks, but repeated unchanged reviews are not additional proof. Findings include affected path, observed evidence, consequence and recommended correction. No commit, push or external review publication is implied.
