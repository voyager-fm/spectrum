# Spectrum plugin

Repository-native product and technical specs for your coding agent.

```sh
claude plugin marketplace add voyager-fm/spectrum
claude plugin install spectrum@spectrum
```

Skills:
- `spectrum`: check and list `.spectrum/` specs, and set a repository up with `init` and `skills install`. Its `scripts/spectrum.mjs` launcher runs the repository's pinned `@voyager-fm/spectrum` (npm, pnpm or Yarn Plug'n'Play), otherwise a newer global install, otherwise the bundled CLI, and names the one that ran on stderr.

The CLI bundle in `skills/*/scripts/spectrum.mjs` is generated from `apps/cli` and `src/launcher.ts`. Do not edit it; run `pnpm plugin:build` from the repository root. Rules: `.spectrum/contracts/distribution.md`.
