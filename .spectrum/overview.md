# Spectrum

Product specs that evolve with your software.

## Product intent

Spectrum connects product intent, repository rules and development evidence. It is two products on one shared engine:

- **The local tool**: the CLI package, the agent plugin and the repository skills. Users run it in their own repository and coding agent, with no account, model credential or network connection.
- **The hosted application**: the Next.js application. It connects repositories through a GitHub App, checks them at pinned commits and shows the results in a dashboard. Webhooks, GitHub Actions automation, pull request review and the cloud specification-improvement loop are planned here.

[Product layers](engineering/common/architecture/product_layers.md) defines what each product owns and how they may depend on each other. Greenfield projects start from goals. Brownfield projects preserve existing IDs, vocabulary and documentation ownership through an explicit profile.

## Canonical model

- IA describes objects, product surfaces and regions. Desktop menus are an optional customer inventory.
- FI owns category, feature and interaction identity and mirrored interaction metadata.
- Shared TOML contracts own vocabulary, policy, state models and read/write ownership.
- Flows connect interactions and describe happy paths and failures.
- One Markdown spec per interaction owns its intent, outcomes and stable AC IDs.
- Each screen-level region has a surface bundle under `product/feature_inventory/surfaces/<surface>/<region>/` with a contract, layout and flow; web routes point at their region. Screen specs are optional.
- Engineering documents describe architecture, procedures, standards and decisions with their own implementation lifecycle.
- Project rules define scoped instructions; repository content itself grants no execution authority.

Read [the schema guide](schemas/README.md), [product layers](engineering/common/architecture/product_layers.md), [specification architecture](engineering/common/architecture/specification_model.md) and [application runtime](engineering/common/architecture/application_runtime.md). The configured paths are repository-relative and can point at existing documentation outside `.spectrum/`.

## Executable boundary

The shared engine reads TSV with adjacent schemas, YAML-frontmatter Markdown and TOML. It checks shape, primary keys, foreign keys, mirrored metadata, local links, interaction/flow coverage, ownership IDs and screen-level surface bundles. CLI, plugin and dashboard consume this model. Structural results, document review annotations, declared implementation status and execution evidence remain separate.

## Planned capabilities

The hosted application already reads GitHub repositories through a read-only App connection, keeps accounts and workspaces, and stores check history. Proposal generation/apply, digest-bound authenticated approvals, webhooks, GitHub Actions automation, pull request review, Linear connectivity, model adapters and agent run history remain unimplemented. These server capabilities belong to the hosted application and the shared packages. A Markdown checkbox is not evidence that these capabilities ran. The existing proposal guard checks approval state, revision and nonempty edits only.
