# Dashboard flow

## Contract References

- [Contract](../contracts/dashboard.toml)

## Interaction Coverage

- [View repository overview](../DSH-001/DSH-001-view_repository_overview.md)
- [Browse specifications](../DSH-001/DSH-001-browse_specifications.md)
- [View specification detail](../DSH-001/DSH-001-view_specification_detail.md)
- [Filter specifications](../DSH-001/DSH-001-filter_specifications.md)
- [Search specifications](../DSH-001/DSH-001-search_specifications.md)
- [View specification document](../DSH-001/DSH-001-view_specification_document.md)
- [View feature category](../DSH-001/DSH-001-view_feature_category.md)
- [View feature](../DSH-001/DSH-001-view_feature.md)
- [View specification graph](../DSH-001/DSH-001-view_specification_graph.md)
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
3. Overview summarizes structural health and charts specification states, acceptance criteria coverage and findings grouped by code, file or specification; a connected repository's overview also charts its stored check history; Specs opens the reader: a tree of categories, features, interactions and documents beside a filterable interaction table, categories and features with their descriptions, and documents by kind; a category or feature page shows its description and its interactions; a spec detail renders one interaction's document with its states, criteria, findings, outline and links in both directions; contracts, flows and other documents open in the same reader; a connected repository's graph view draws interactions, features, categories and documents joined by their declared links, ownership, regions and membership; ⌘K searches every interaction, category, feature and document.
4. Rules shows rule files from the configured roots. Integrations shows each integration's connection state as reported by the server.
5. Proposals, Runs and PR reviews show planned states. No page writes to the repository.

## Failure Handling

- Load failures appear as page errors. The dashboard never substitutes sample data.
- An unknown specification ID, category key, feature ID or document path returns the not-found page.
- Document Markdown renders as text only; raw HTML stays literal and images are links, so repository files cannot inject markup.
- Empty specification or rule sets show an empty notice that names where the data was read from.
- Charts never show sample data. Without stored check history the trend explains why it is unavailable.
- Structural errors fail the check and appear as findings; unresolved `TBD` values remain visible warnings.
