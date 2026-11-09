---
name: spectrum-ui
description: "Implement and inspect the Spectrum Next.js dashboard (apps/web) or CLI presentation: pages, components, empty/error/planned states, user-facing copy and visual review. Use for UI changes; not for backend-only work."
---

# Spectrum UI

Load only the reference the task needs:
- [brand.md](references/brand.md): terminal-aesthetic brand tone, pixel/bitmap accent and voice drawn from OpenCode, Ghostty, Warp, CodeRabbit and Greptile; per-surface limits (dashboard, CLI, docs/landing).
- [design.md](references/design.md): monotone developer-review-tool direction and patterns for upcoming pages.
- [review-patterns.md](references/review-patterns.md): observed review-summary, findings, PR detail, runs and list structures for the PR reviews, Proposals and Runs pages.
- [architecture.md](references/architecture.md): stack, data flow, routes and how to add a page.
- [components.md](references/components.md): shadcn primitives, Spectrum compositions, `StatusBadge` tones, tables and theme tokens.
- [states-and-copy.md](references/states-and-copy.md): state matrix, honesty rules and copy conventions.
- [verification.md](references/verification.md): checks, alternate-repository runs and visual evidence.

## Procedure
1. Read the relevant spec, contract and flow in `.spectrum/` before changing behavior. Draft examples are not approved requirements. If the UI contract is missing, report it as an open decision instead of inventing it.
2. Read the current route, `lib/dashboard.ts` and `components/dashboard.tsx`. Reuse compositions and shadcn primitives; add missing primitives with the shadcn CLI. Stay monotone. Keep data loading in `lib/` and domain rules in `packages/`; pages only render.
3. List the states the change touches (ready, empty, load failure, not found, planned, stale) and render each one. Never show an enabled action or success state for a capability no adapter implements; use `<Planned>`.
4. Write English, developer-facing copy: what the page shows, what it does not prove, and the next step. Keep secrets and stack traces out of the UI.
5. Use semantic elements, labels and the primitives' focus rings. Check the layout under 768px and in dark mode.
6. Verify per verification.md. Use spectrum-test-authoring for new loader tests.

Return the affected routes, states covered, reuse decision, checks run with results, visual evidence or "visual inspection not performed", and unresolved UX decisions. Do not assume native macOS components, Voyager brand assets or an installed browser automation framework.
