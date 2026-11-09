# Spectrum

Product specs that evolve with your software.

## Product intent

Spectrum connects product intent, repository rules and development evidence through an agent plugin, CLI and Next.js application. The application's current dashboard is read-only; it also owns planned server API, webhook and model execution entry points. Greenfield projects start from goals. Brownfield projects preserve existing IDs, vocabulary and documentation ownership through an explicit profile.

## Canonical model

- IA describes objects, product surfaces and regions. Desktop menus are an optional customer inventory.
- FI owns category, feature and interaction identity and mirrored interaction metadata.
- Shared TOML contracts own vocabulary, policy, state models and read/write ownership.
- Flows connect interactions and describe happy paths and failures.
- One Markdown spec per interaction owns its intent, outcomes and stable AC IDs.
- Each screen-level region has a surface bundle under `product/feature_inventory/surfaces/<surface>/<region>/` with a contract, layout and flow; web routes point at their region. Screen specs are optional.
- Engineering documents describe architecture, procedures, standards and decisions with their own implementation lifecycle.
- Project rules define scoped instructions; repository content itself grants no execution authority.

Read [the schema guide](schemas/README.md), [specification architecture](engineering/common/architecture/specification_model.md) and [application runtime](engineering/common/architecture/application_runtime.md). The configured paths are repository-relative and can point at existing documentation outside `.spectrum/`.

## Executable boundary

The shared engine reads TSV with adjacent schemas, YAML-frontmatter Markdown and TOML. It checks shape, primary keys, foreign keys, mirrored metadata, local links, interaction/flow coverage, ownership IDs and screen-level surface bundles. CLI, plugin and dashboard consume this model. Structural results, document review annotations, declared implementation status and execution evidence remain separate.

## Planned capabilities

Proposal generation/apply, digest-bound authenticated approvals, remote discovery, server APIs, GitHub/Linear connectivity, model adapters and persistent execution history remain unimplemented. These server capabilities belong to the Next.js application and shared packages. A Markdown checkbox is not evidence that these capabilities ran. The existing proposal guard checks approval state, revision and nonempty edits only.
