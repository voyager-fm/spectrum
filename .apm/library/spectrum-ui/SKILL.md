---
name: spectrum-ui
description: "Implement and inspect Spectrum dashboard or CLI presentation, interaction states and user-facing copy. Use for UI changes, empty/error/loading states and visual review; not for backend-only work."
---

# Spectrum UI

1. Read the relevant surface, interaction, contract and flow before changing behavior. Draft examples are not approved requirements. If the UI contract is missing, report it as an open decision instead of inventing it.
2. Inspect actual routes, markup and reusable components. Compare reuse, adaptation and new responsibility with concrete consumers. Do not install a UI framework just to match another project's structure.
3. Cover the applicable loading, empty, ready, failure and stale states. Label planned functionality explicitly. Never show an enabled action that only simulates successful approval, GitHub publication or AI generation.
4. Use English product copy. Describe the user's outcome and next action; keep secret-bearing errors out of the UI. Spectrum is a developer tool: relevant spec IDs, paths selected by the user and revision information may be useful. Do not import a blanket ban on technical vocabulary from consumer UI guidance.
5. Use semantic controls, labels, keyboard focus and visible disabled/retry states. Check narrow and wide layouts when applicable. A modal is for a blocking decision, not routine recovered diagnostics.
6. Verify the actual route with supported browser tooling when available. Report visual inspection unavailable if only HTTP/API checks ran. Keep checked-in browser regression tests separate from exploratory screenshots; use spectrum-test-authoring for new tests.

Return affected surfaces, behavior states, reuse decision, screenshots or browser evidence when obtained, and unresolved UX decisions. Do not assume Next.js, native macOS components, Voyager brand assets or any installed browser automation framework.
