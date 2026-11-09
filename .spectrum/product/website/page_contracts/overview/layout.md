# Overview layout

## Regions

Repository navigation, page heading and load errors precede the page content. Tables and document previews use the existing dashboard components.

1. Summary cards: structural check result, specification count, rule files, mode.
2. Spec health: segmented bars for document review status, declared lifecycle and phase, each with a legend that prints every value's count and share, followed by a per-category table.
3. Acceptance criteria: totals, stable-ID share, specifications without criteria and ticked checkboxes, with lists that link to specification detail.
4. Findings: grouping and severity controls, then one expandable row per group with a ranked bar of its errors and warnings.
5. Check trend: stored check history for connected repositories, or a statement that no history is stored.
6. Agent loop: planned capabilities.

Charts stay monotone. Ordered states use one gray ramp; only errors use the destructive color. Every charted value is also printed as text.

## Sources

- [Page contract](contract.toml)
- [Flow](flow.md)
- [Status distribution](../../../feature_inventory/specs/dsh/DSH-004/DSH-004-view_status_distribution.md)
- [Group findings](../../../feature_inventory/specs/dsh/DSH-004/DSH-004-group_findings.md)
