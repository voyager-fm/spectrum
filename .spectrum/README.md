# Repository specifications

[Overview](overview.md) explains Spectrum's intent and executable boundary. [The schema guide](schemas/README.md) defines document ownership and validation. [Architecture](engineering/common/architecture/specification_model.md) connects the canonical files to the shared engine and its consumers.

[Application runtime](engineering/common/architecture/application_runtime.md) defines the Next.js server boundary, shared package ownership and the planned execution capabilities.

Product objects and behavior live in `product/`. Web route and page contracts are product specifications under `product/website/`. Engineering knowledge lives in `engineering/`; scoped agent instructions live in `rules/`. The source mapping in `config.json` lets existing repositories preserve their own paths.

Run `pnpm spec:check` to validate the configured repository model and `pnpm spec:list` to list interaction specifications. These commands read only. Planning, document approval, declared implementation and executed test evidence have separate meanings.

Spectrum feature identity uses category-local IDs and bundles; see [the namespace standard and migration crosswalk](engineering/common/standards/feature_identity.md). The planned [implementation-link feature](product/feature_specs/trc/TRC-001/TRC-001-inspect_linked_implementation.md) defines Connected code in specification detail; this specification does not claim the resolver or UI is implemented.
