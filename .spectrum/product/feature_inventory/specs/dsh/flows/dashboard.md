# Dashboard flow

## Contract References

- [Contract](../contracts/dashboard.toml)

## Interaction Coverage

- [View repository overview](../DSH-001/DSH-001-view_repository_overview.md)
- [Browse specifications](../DSH-001/DSH-001-browse_specifications.md)
- [View specification detail](../DSH-001/DSH-001-view_specification_detail.md)
- [Read repository rules](../DSH-002/DSH-002-read_rules.md)
- [Inspect integrations](../DSH-002/DSH-002-inspect_integrations.md)
- [Show planned capabilities](../DSH-003/DSH-003-show_planned_capabilities.md)
- [View status distribution](../DSH-004/DSH-004-view_status_distribution.md)
- [View acceptance coverage](../DSH-004/DSH-004-view_acceptance_coverage.md)
- [Group findings](../DSH-004/DSH-004-group_findings.md)
- [View check trend](../DSH-004/DSH-004-view_check_trend.md)

## Happy Path

1. The user opens a dashboard route on the loopback-only local server.
2. The server reads the configured repository (`SPECTRUM_REPOSITORY` or this monorepo), its Git revision and the shared model from `@spectrum/spec-engine`.
3. Overview summarizes structural health and charts specification states, acceptance criteria coverage and findings grouped by code, file or specification; a connected repository's overview also charts its stored check history; Specs lists interactions with shared contracts and flows; a spec detail shows one interaction's states, criteria, findings and linked documents.
4. Rules shows rule files from the configured roots. Integrations shows each integration's connection state as reported by the server.
5. Proposals, Runs and PR reviews show planned states. No page writes to the repository.

## Failure Handling

- Load failures appear as page errors. The dashboard never substitutes sample data.
- An unknown specification ID returns the not-found page.
- Empty specification or rule sets show an empty notice that names where the data was read from.
- Charts never show sample data. Without stored check history the trend explains why it is unavailable.
- Structural errors fail the check and appear as findings; unresolved `TBD` values remain visible warnings.
