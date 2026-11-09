# Design direction

Spectrum looks like a developer review tool: the dense, quiet dashboards of AI code-review products such as Greptile and CodeRabbit, built with shadcn/ui on a neutral palette. Borrow the patterns, never their names, logos, colors or copy.

## Principles
- **Monotone.** Grayscale only (`neutral` base color). Hierarchy comes from weight, size, borders and solid vs outline fills. The only hue is `destructive`, reserved for failures. Do not add brand, success-green or warning-yellow colors. If a state seems to need color, use a different badge style or an icon first.
- **Dense and scannable.** Tables over cards for lists of things (specs, findings, PRs, runs). Cards for summary stats and grouped settings. Default text is `text-sm`; secondary text is `text-muted-foreground`.
- **Code-native.** IDs, paths, SHAs and finding codes render in Geist Mono (`<Mono>` or `font-mono text-xs`). Show short SHAs (7 characters).
- **Quiet chrome.** Fixed left sidebar (repository card plus grouped navigation with lucide icons), no top bar, content capped at `max-w-5xl`. No hero banners, gradients, illustrations or shadows beyond the shadcn defaults.
- **Honest emptiness.** Unimplemented areas use dashed borders (`Planned`, `EmptyNotice`, `planned` badges). Dashed means "not real yet"; never use a dashed style for working features.

## Patterns to reuse for upcoming pages
Observed structures (summary, findings, PR detail, runs, lists) are in [review-patterns.md](review-patterns.md). The summary per page:

| Page | Pattern |
| --- | --- |
| PR reviews | Table: PR title, head SHA, reviewed SHA, finding count, status. Detail page: findings grouped by affected spec, each with file path, evidence and the AC it relates to. |
| Proposals | Table of change sets; detail shows a per-file diff (monospace, `+`/`-` prefixes, no red/green fill), base revision and approval state. |
| Runs | Table with kind, revision, phase and duration; detail is a step timeline using `Separator` and status badges. |
| Settings | One card per integration with its connection state; destructive actions behind a confirmation. |

## Do not
- Do not copy screenshots, layouts pixel-for-pixel, wording or icons from Greptile, CodeRabbit or any other product.
- Do not add a theme toggle. The theme follows `prefers-color-scheme`.
- Do not hand-write a component that shadcn provides. Add it with the CLI (see components.md).
