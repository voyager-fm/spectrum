# Engine and client repository boundary

This repository holds two different things. Keep them apart in every change.

| Part | Paths | What it is |
| --- | --- | --- |
| **Engine** | `apps/`, `packages/` | Spectrum the tool. It defines how any repository's specifications are written and checked. |
| **Client** | `.spectrum/` | Spectrum the product's own specifications. They are authored exactly as a customer repository would author its own. |

Ask one question before writing a file: *would a customer repository contain this file?* If not, it belongs to the engine. It must not appear under `.spectrum/` or in any output that `init` or a template writes into a client repository.

## Engine-owned format

The engine owns the specification format, and each definition exists exactly once:

- JSON Schemas for configuration, inventory catalogs, standalone tables, interaction frontmatter and engineering metadata: `packages/spec-engine/schemas/`
- FI base schemas (`spectrum:feature_categories`, `spectrum:features`, `spectrum:interactions`): `packages/spec-engine/src/base-schemas.ts`
- The document model, the default layout and the scaffolding contract: `packages/spec-engine/docs/`
- Templates and their catalog: `packages/spec-engine/templates/`

Client files refer to the format through `$schema` URLs (`https://raw.githubusercontent.com/voyager-fm/spectrum/main/packages/spec-engine/schemas/<file>`) and `extends` IDs. They never use a relative path into engine files, and never hold a copy of an engine definition.

## Rules

1. **Never install format definitions into a client.** Templates, `init` and setup render only client content: configuration, overview, rules, inventories, specs, contracts, flows, page bundles and project engineering notes. Schema files, base schemas, layout or scaffolding contracts and template documentation are not rendered as client files.
2. **`.spectrum/` is a client, not a fixture of the engine.** It contains only what a customer repository would contain. It does not mirror engine definitions. No test may assert that `.spectrum/` equals a shipped definition.
3. **Test format behavior in temporary repositories.** Engine and template tests build their fixtures in temporary directories. The self-check test only proves that Spectrum's own specifications are valid client content; it is not the format's source of truth.
4. **Keep templates client-neutral.** Template content contains no Spectrum product IDs (for example `VAL-001`), categories or vocabulary. It contains no paths into `packages/` or `apps/`, and no claims about Spectrum's own implementation.
5. **Change the format in order.** First change the engine definitions, base schemas, engine docs, templates and tests together. Then migrate `.spectrum/` the way a customer would migrate, keeping the brownfield compatibility path explicit.
6. **Classify documents by owner:**
   - How any repository must be written is engine documentation.
   - What Spectrum does as a product (objects, features, interactions, contracts, flows, pages) is client content under `.spectrum/product/`.
   - Spectrum's own engineering knowledge about its code lives under `.spectrum/engineering/` and may link to engine paths in this repository. Customer templates never include it.

If an existing file breaks these rules, report it and move it with the change that touches it. Do not extend the violation.
