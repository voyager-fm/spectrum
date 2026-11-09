# States and copy

## State matrix
Decide each state before writing the page. Every state renders something specific.

| State | When | Render |
| --- | --- | --- |
| Ready | data loaded | content |
| Empty | load succeeded, zero items | `<EmptyNotice>` naming the source path and the next step, e.g. `No feature specs found. Run pnpm spec:check for details.` |
| Load failure | an `attempt()` failed | `<LoadErrors>` at the top; sections that depend on the failed data show "Could not run" or a dash instead of a zero |
| Not found | unknown route parameter | `notFound()` |
| Planned | capability not implemented | `<Planned>` with the reason, the governing contract path and the planned items |
| Stale | data tied to an older revision (when implemented) | `planned` badge plus the revision it was computed for; never present it as current |

A failed load and an empty result look different. Show `—` or "Could not run" when data is missing, not `0`.

## Honesty rules
- Never render an enabled button, success badge or toast for an action no adapter performs: approve, publish, sync, generate or review. Use `<Planned>` or a disabled control with the reason next to it.
- Keep document review, structural check, declared FI lifecycle and test evidence as separate fields. Spec detail shows the FI lifecycle and phase. AC evidence stays "Not recorded" until an implemented evidence adapter supplies actual execution records; Markdown checkboxes remain author annotations.
- Label deterministic results as such ("deterministic, no model"). Do not describe a check as AI review.
- Demo data, mocks or replays must be labeled on screen as such.

## Copy
- English. Sentence case for headings, buttons and badges ("PR reviews", "Not implemented").
- Do not use color words or color alone to carry meaning; color is limited to one accent, failures and warning marks (design.md). Pair a failure badge with text.
- The audience is developers. Spec IDs (`VAL-001`), repository paths, short revisions (7 characters) and finding codes are useful. Show them with `<Mono>`.
- A description says what the page shows and what it is not evidence of. Example: "Specification health for this repository. Document status is not implementation or test evidence."
- An error or empty state names what was read and what to do next. Do not apologize or blame the user.
- Never show secrets, tokens, absolute home paths or raw stack traces. `LoadErrors` shows the error message only.
- Use "spec", "rule", "contract", "flow", "proposal" and "finding" the same way as in `.spectrum/`. Do not introduce synonyms.
