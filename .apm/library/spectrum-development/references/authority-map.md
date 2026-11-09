# Scope and authority

Start from the requested result, allowed writes and external-action limits. Inspect the current branch, diff and existing work before selecting owners. Record the Git revision; without Git, record affected file hashes. Reuse established scope rather than asking for the same decisions again.

## Specification authority

Use [the configured source map](../../../../.spectrum/config.json) to locate the affected inventories and documents. Paths can point outside `.spectrum/`; the current Spectrum layout is not a required layout for customer repositories.

| Question | Read |
| --- | --- |
| Product intent and executable boundary | [Overview](../../../../.spectrum/overview.md) |
| Document ownership, serialization and relationships | [Schema guide](../../../../.spectrum/schemas/README.md) and the specification-model architecture in the configured engineering root |
| Objects, surfaces, regions and stable feature/interaction IDs | Configured IA and FI inventories under `.spectrum/product/` |
| Behavior and acceptance criteria | The affected feature bundle's contracts, flows and interaction Markdown specs |
| Web routes and page behavior | Configured route inventory and page bundles under `.spectrum/website/` |
| Runtime and package boundaries | [Distribution contract](../../../../.spectrum/contracts/distribution.md) and the application-runtime architecture in the configured engineering root |
| Engineering decisions and scoped instructions | Applicable `.spectrum/engineering/`, `.spectrum/rules/` and local `AGENTS.md` |

Before behavior changes, trace the relevant inventory, contract, flow and interaction spec to the actual owner and tests. Keep approved requirements, draft examples, current code and executed evidence distinct. Report missing or conflicting requirements as open decisions; a draft schema example does not settle product behavior.

## Implementation owners

Follow actual callers, public exports and tests; this map is a starting point, not proof that every consumer was inspected.

| Owner | Responsibility |
| --- | --- |
| `packages/core` | Shared domain types and contracts |
| `packages/spec-engine` | Configured repository reads, parsing, relationships and structural validation |
| `packages/changeset` | Proposal approval and revision guards |
| `packages/integrations` | GitHub/Linear adapter contracts; inspect for an implementation before claiming connectivity |
| `apps/cli` | Deterministic commands consuming the shared packages |
| `apps/plugin` | Distributed product skills, manifest and bundled CLI |
| `apps/web` | Next.js dashboard and planned API, webhook, integration and model execution entry points |
| `.apm/library/`, `apm.yml`, `apm.lock.yaml` | Development skill sources, selection and generated deployment lock; see [harness ownership](../../../../.apm/README.md) |

When a public contract, parser or proposal rule changes, inspect the CLI, plugin and dashboard consumers even when their files are unchanged. A server ownership decision does not prove that its planned entry points exist.
