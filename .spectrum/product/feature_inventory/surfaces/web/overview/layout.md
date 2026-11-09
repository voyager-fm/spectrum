# Overview layout

## Regions

Repository navigation, page heading and load errors precede the page content. Tables and document previews use the existing dashboard components.

1. Summary cards: structural check result and specification count.
2. Spec health: segmented bars for document review status, declared lifecycle and phase, each with a legend that prints every value's count and share, followed by a per-category table.
3. Acceptance criteria: totals, stable-ID share, specifications without criteria and ticked checkboxes, with lists that link to specification detail.
4. Findings: grouping and severity controls, then one expandable row per group with a ranked bar of its errors and warnings.
5. Check trend, connected repositories only: stored check history, or a statement that no history is stored. The local Overview omits it.

The page description carries the statement that document status is not evidence; the Ticked by authors card repeats it for checkboxes. Other sections do not.

Ordered states use one ramp of the indigo brand accent. Errors use the destructive color and warnings the warning color. Every charted value is also printed as text.

## Sources

- [Surface contract](contract.toml)
- [Flow](flow.md)
- [Status distribution](../../../specs/dsh/DSH-004/DSH-004-view_status_distribution.md)
- [Group findings](../../../specs/dsh/DSH-004/DSH-004-group_findings.md)
