# Review UI patterns

Observed on 2026-11-09 in public pull-request comments and public product documentation of two AI code-review tools (Greptile and CodeRabbit). Their logged-in dashboards were not inspected. Use these as structure for the PR reviews, Proposals and Runs pages, translated into Spectrum's monotone system (design.md). Do not copy wording, icons, emoji, colors or layouts.

None of these pages are implemented. Build one only when its contract in `.spectrum/` is approved and an adapter supplies real data; until then the route stays `<Planned>`.

## Review summary
Both tools post one top-level summary per review with the same order:
1. Plain-language summary: what the change does and what the review found.
2. One verdict with a short reason: a 0-5 confidence score with a meaning table, or a risk level (minimal to critical).
3. Unresolved findings, each linking to its location.
4. Collapsed details: reviewed commit range, files processed with hunk counts, configuration profile and the context used.
5. Footer: review count, last reviewed commit and a re-run action.

For Spectrum:
- Show the verdict as a label plus one sentence, never a bare number. Name the revision it covers with `<Mono>` (7-character SHA).
- When the head moved after the review, mark the verdict stale (`planned` tone) and keep showing the reviewed revision. A verdict never describes a commit it did not review.
- "Not assessed" is its own state, distinct from a pass. A review that tested nothing, or could not finish, is not "ready to merge". Show the reason instead.
- Put commit range, files processed and configuration in a collapsed section (shadcn `Collapsible` or `Accordion`), not in the first screen.

## Findings
- **Separate axes.** Severity, kind (defect, refactor, nitpick), area (correctness, security, data, performance, maintainability) and fix effort are independent labels. Do not fold them into one ladder. Filter by severity only; read the other labels on the row.
- **Ordinal severity.** Use short codes (`P0`, `P1`, `P2`) in `font-mono`. Monotone mapping: `P0` uses `destructive`, `P1` a solid badge, `P2` an outline badge. Add a `SeverityBadge` composition when the first findings page needs it; do not reuse the `ok` tone for severity.
- **Group by what blocks a merge**, not by severity: Blockers, High priority, Pending (waiting on checks or reviews), Advisory. Hide empty groups.
- **Finding anatomy:** severity badge and a one-line title (inline code allowed) → explanation → suggested change as a monospace diff (`+`/`-` prefixes, no colored fill) → header with the file path and line range (`src/a.ts` Lines 12-18) → resolution state (Open, Resolved, Outdated).
- In Spectrum a finding also names the affected spec ID and acceptance criterion. Link both.
- Offer "Hide resolved" and "Hide outdated" toggles before adding anything more elaborate.

## PR detail
- Header: `#<number>` in mono, the title, then actions on the right. Tabs below: Overview, Findings (with a count), Runs, Code. Show a count on a tab only when it is nonzero.
- The Overview answers "what is the state and what needs attention before merge". Other tabs hold the detail.
- Order changed files for reading, foundations before dependents, with an alphabetical file tree as the fallback.
- Diagrams only where they earn their place: sequence for API flows, entity-relationship for schema changes. None for trivial changes. This is optional and comes late.

## Runs
- An accordion of checked flows. Each row shows the flow name and one outcome; expanding shows numbered steps (`01`, `02` in mono) and the checks under each.
- A check outcome is one of passed, failed (with its finding severity), blocked (with the reason) or not attempted (muted text). Use lucide icons plus text; never use the icon alone.
- List blockers, such as a missing environment variable, separately from failures. "Nothing checked" is not a pass.
- Make the selected step addressable in the URL (`?step=2`) so links point at the exact place.

## Lists and analytics
- A filter row (repository, author, period) above the content and right-aligned, with tabs underneath.
- Headline metrics in one bordered strip of 3-4 cells (label in `text-muted-foreground`, value large and `tabular-nums`) rather than separate floating cards. Show `—` for a metric that has no data, not `0`.
- A list row carries provider facts (title, author, checks, diff size `+120 / −45`), review signals tied to a commit (risk, severity), and Spectrum's own judgment (next action). Keep the three visibly distinct, and show signal freshness, because review signals expire when a new commit lands.
- At most one next action per row.
- Empty chart or table areas use the dashed `EmptyNotice`, with copy saying no data exists for the filter.

## Keyboard
Add shortcuts only when a list or a multi-step detail page ships. Then follow the common convention: `J`/`K` for the next and previous item, `/` for search, `?` for the shortcut list, `Esc` to clear. Never bind a destructive or merge action to a single key.
