# Spectrum specification engine

This package owns repository format contracts, parsing, validation, reusable templates and installation/setup policy. Applications, the CLI and the plugin consume its shared APIs.

- [Scaffolding data](templates/scaffolding.json): engine-owned starter selection, default values, unresolved-value policy and empty-root assets, consumed by `src/setup.ts`.
- [Template assets](templates/README.md): reusable customer document formats and the read-only renderer.
- [Table query API](src/tables/README.md): schema-driven table access.

Engine development documentation stays in this package. A customer's `.spectrum/` stores that customer's specifications and installed format assets; package development contracts are never generated into its product inventory.
