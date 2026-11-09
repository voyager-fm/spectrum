---
name: spectrum-test-authoring
description: "Create or repair behavior-focused Spectrum unit, API or browser tests. Use before new assertions, integration fixtures or security regression coverage; verification-only requests use spectrum-verification."
---

# Spectrum test authoring

## Assertion owner
Start with the behavior and its actual owner, not the directory layout. Product assertions trace to the relevant AC or contract; technical parsing, composition and transport assertions may use their technical owner without inventing a product spec. Read existing suites and fixtures before adding another owner.

## Authoring procedure
1. Identify the regression a failing assertion would demonstrate. Prefer tests that survive an implementation rewrite preserving the behavior. Do not add source-string, folder-count or import-graph tests just to freeze architecture. This does not prohibit Spectrum's actual product schema/reference validation tests.
2. Exercise a real observable outcome and meaningful failure branch. Do not create passing placeholders for unimplemented features or weaken an existing assertion after a failure.
3. Keep deterministic tests isolated with temporary repositories and cleanup. Reuse fixtures only when they have concrete shared consumers. Use stable behavior selectors for browser tests; the existence of a test ID is not itself the product contract.
4. For remote integrations, use explicit mock boundaries by default and fail unexpected network access. Never silently exercise real GitHub/Linear writes, provider billing or credentials. A mock success is not live integration evidence.
5. Where implemented, cover invalid webhook signatures, duplicate delivery, stale revision, changed approval digest, path traversal/symlink escape, unauthorized access and secret redaction. Derive expectations from approved contracts; do not implement a security feature merely because it appears on this checklist.
6. Run the owning suite and confirm nonzero selected tests. Record the failure before a fix where feasible and the result after it. If execution is blocked, report authored coverage separately from executed coverage.

Use spectrum-verification to reconcile final evidence. No new framework, CI workflow, external service or automatic security scan is enabled by this skill.
