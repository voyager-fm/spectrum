---
interaction_id: "SP-006-inspect_integrations"
interaction_type: "display"
feature: "Repository context"
category_key: "DSH"
feature_id: "SP-006"
status: "implementing"
phase: "now"
summary: "Show each integration's connection state as reported by the server."
related_region: "web.integrations"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Inspect integrations

## Intent

Show each integration's connection state as reported by the server.

## Trigger / Entry Points

The user opens `/settings` (Integrations) from the navigation or from the Overview integrations card.

## Preconditions

The dashboard server can read its own environment. Repository configuration is not consulted for connection state.

## Expected Outcome

A table lists GitHub and Linear with a connection column and the integration's purpose. GitHub reads App configured or Not configured from the server's GitHub App credentials and links to Repositories. Linear reads Not implemented. A Model provider section shows that none is configured.

## State Changes

No repository or server state changes. Settings cannot be edited from the dashboard.

## User-visible Feedback

The page says that connection state comes from the server environment and the connected service, never from `.spectrum/config.json`, and that connecting or editing integrations from the dashboard is not supported yet. The model provider note says that secrets never belong in `.spectrum/`.

## Edge Cases / Failure Handling

When the repository configuration cannot be read, the load error appears and connection states are unaffected. A connection state is shown only when an implemented adapter reports it; otherwise it reads Not implemented. A repository configuration that still contains the retired `integrations` or `agents` keys produces a `retired-config-key` warning in the structural check and has no effect on this page.

## Acceptance Criteria

- [ ] **AC-1:** Each integration shows a connection state reported by its implemented adapter, or Not implemented when no adapter exists.
- [ ] **AC-2:** No repository configuration value produces or changes a connection state.
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
