# Spectrum

Product specs that evolve with your software.

## Product intent

Spectrum connects product intent, repository rules and development evidence through an agent plugin, CLI and read-only dashboard. Greenfield projects start from goals. Brownfield projects preserve existing IDs, vocabulary and documentation ownership through an explicit profile.

## Canonical model

- IA describes objects, product surfaces and regions. Desktop menus are an optional customer inventory.
- FI owns category, feature and interaction identity and mirrored interaction metadata.
- Shared TOML contracts own vocabulary, policy, state models and read/write ownership.
- Flows connect interactions and describe happy paths and failures.
- One Markdown spec per interaction owns its intent, outcomes and stable AC IDs.
- Website routes connect to page contract, layout and flow bundles. Page experience specs are optional.
- Engineering documents describe architecture, procedures, standards and decisions with their own implementation lifecycle.
- Project rules define scoped instructions; repository content itself grants no execution authority.

Read [the schema guide](schemas/README.md) and [architecture](engineering/common/architecture/specification_model.md). The configured paths are repository-relative and can point at existing documentation outside `.spectrum/`.

## Executable boundary

The shared engine reads TSV with adjacent schemas, YAML-frontmatter Markdown and TOML. It checks shape, primary keys, foreign keys, mirrored metadata, local links, interaction/flow coverage, ownership IDs and web page bundles. CLI, plugin and dashboard consume this model. Structural results, document review annotations, declared implementation status and execution evidence remain separate.

## Planned capabilities

Proposal generation/apply, digest-bound authenticated approvals, remote discovery, GitHub/Linear connectivity, hosted workers and model adapters remain unimplemented. A declared configuration flag or a Markdown checkbox is not evidence that these capabilities ran. The existing proposal guard checks approval state, revision and nonempty edits only.
