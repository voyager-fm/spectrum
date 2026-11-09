---
interaction_id: "SP-006-inspect_integrations"
interaction_type: "display"
feature: "Repository context"
category_key: "DSH"
feature_id: "SP-006"
status: "implementing"
phase: "now"
summary: "Show declared integration flags separately from live connection state."
related_region: "web.integrations"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Inspect integrations

## Intent

Show declared integration flags separately from live connection state.

## Trigger / Entry Points

The user opens `/settings` (Integrations) from the navigation or from the Overview integrations card.

## Preconditions

The dashboard server can read `.spectrum/config.json` of the configured repository.

## Expected Outcome

A table lists GitHub, Linear and Agents with the configured flag (enabled or disabled), a separate connection column and the integration's purpose. A Model provider section shows that none is configured.

## State Changes

No repository or server state changes. Settings cannot be edited from the dashboard.

## User-visible Feedback

The page names `.spectrum/config.json` as the source and says that editing settings from the dashboard is not supported. An enabled flag never reads as connected. The model provider note says that secrets never belong in `.spectrum/`.

## Edge Cases / Failure Handling

When the configuration cannot be read, flags show as disabled and the load error appears. A connection state is shown only when an implemented adapter reports it; otherwise it reads Not implemented.

## Acceptance Criteria

- [ ] **AC-1:** Each integration shows its configuration flag and its connection state as separate values.
- [ ] **AC-2:** A configuration flag alone never produces a connected state.
- [ ] **AC-3:** The page offers no control that edits configuration or stores credentials.
- [ ] **AC-4:** The model provider section reports that no authentication path is configured until one is implemented and verified.

## Permissions / Dependencies

Read-only local inspection. Credentials stay in the server environment and never appear in page output.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Read repository rules](../SP-006/SP-006-read_rules.md)
- [View repository overview](../SP-002/SP-002-view_repository_overview.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Integrations page contract](../../../website/page_contracts/integrations/contract.toml)
