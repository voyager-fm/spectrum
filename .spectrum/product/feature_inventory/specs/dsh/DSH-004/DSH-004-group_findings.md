---
interaction_id: "DSH-004-group_findings"
interaction_type: "input"
feature: "Specification health"
category_key: "DSH"
feature_id: "DSH-004"
status: "implementing"
phase: "now"
summary: "Group structural findings by code, file or specification and filter them by severity."
related_region: "web.overview"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Group findings

## Intent

Make a long list of structural findings actionable by showing which codes, files or specifications produce most of them.

## Trigger / Entry Points

The grouping and severity links above the Findings section of the local Overview and of a connected repository's overview. The choice is kept in the `group` and `severity` query parameters together with the selected `ref` or `pr`.

## Preconditions

A check result exists for the shown revision.

## Expected Outcome

Findings are grouped by code (default), file or specification. A ranked bar chart shows each group's finding count, largest first, with errors and warnings counted separately. Each group expands to its findings with severity, path and line, and message. File paths link to the source at the checked revision when it is known. Specification groups link to the specification detail. Findings on files that are not an interaction specification are grouped as "Not in a specification". The severity filter shows all findings, only errors or only warnings.

## State Changes

None. The grouping and filter live in the URL only.

## User-visible Feedback

The current grouping and filter are marked. The total shown is stated next to the controls, for example "4 of 12 findings".

## Edge Cases / Failure Handling

Unknown `group` or `severity` values fall back to the defaults. A filter that matches nothing shows an empty notice naming the filter. With no findings at all, the section states that there are no structural findings and that this does not show that the code implements the specifications.

## Acceptance Criteria

- [ ] **AC-1:** Every finding appears in exactly one group, and group counts add up to the filtered total.
- [ ] **AC-2:** Grouping and severity links keep the selected ref or pull request.
- [ ] **AC-3:** An unknown query value falls back to grouping by code with all severities.

## Permissions / Dependencies

Read-only.

## Observability / Analytics

None.

## Related Interactions

- [View repository overview](../DSH-001/DSH-001-view_repository_overview.md)
- [Check repository](../../val/VAL-001/VAL-001-check_repository.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
