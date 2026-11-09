# UI verification

Report each item as passed, failed or not run. Do not merge them into one "verified".

## Deterministic
- `pnpm check` at the repository root: root typecheck, `@spectrum/web` typecheck (`next typegen && tsc --noEmit`), all `*.test.ts` and the spec check. Confirm the test count is nonzero.
- Loader behavior belongs in `apps/web/src/lib/dashboard.test.ts`. Use temporary repositories for missing and broken `.spectrum` data. Do not test rendered markup to freeze layout.
- `pnpm --filter @spectrum/web build` when routing, metadata or server/client boundaries changed. Typecheck does not catch every build error.

## Running the dashboard
- `pnpm dev` serves http://127.0.0.1:3000 against this repository. Next allows one dev server per directory: if another session already runs one, use that server (it hot-reloads your edits) instead of killing it.
- To see empty and failure states, point it at a temporary repository: `SPECTRUM_REPOSITORY=/tmp/x pnpm dev` with no `.spectrum`, or with a malformed `config.json` or a feature spec with a broken link.
- An HTTP 200 proves the route rendered, not that the layout or the states are right.

## Visual evidence
Use the browser tooling the client provides, if any. Check:
- each changed route, plus every state from states-and-copy.md that the change touches
- light and dark color schemes (emulate `prefers-color-scheme`; the screenshot follows the OS setting otherwise)
- that no color other than `destructive` appears (design.md)
- a narrow viewport under 768px, the `md` breakpoint (sidebar stacks above content, tables scroll)
- keyboard focus moving through navigation and controls

If no browser tooling ran, say "visual inspection not performed" and list what was checked instead. A screenshot shows only the state it captured.
