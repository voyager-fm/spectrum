# Spectrum plugin

Repository-native product and technical specs for your coding agent.

```sh
claude plugin marketplace add voyager-fm/spectrum
claude plugin install spectrum@spectrum
```

Skills:
- `spectrum`: check and list `.spectrum/` specs, and set a repository up with `init` and `skills install`. It runs the repository's installed `node_modules/.bin/spectrum` when present and the bundled CLI otherwise.

The CLI bundle in `skills/*/scripts/spectrum.mjs` is generated from `apps/cli`. Do not edit it; run `pnpm plugin:build` from the repository root. Rules: `.spectrum/contracts/distribution.md`.
