# Spectrum plugin

Repository-native product and technical specs for your coding agent.

```sh
claude plugin marketplace add voyager-fm/spectrum
claude plugin install spectrum@spectrum
```

Skills:
- `spectrum`: check and list `.spectrum/` specs with the bundled deterministic CLI.

The CLI bundle in `skills/*/scripts/spectrum.mjs` is generated from `apps/cli`. Do not edit it; run `pnpm plugin:build` from the repository root. Rules: `.spectrum/contracts/distribution.md`.
