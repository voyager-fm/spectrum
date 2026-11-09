# Design direction

Spectrum looks like a developer review tool: the terminal aesthetic of OpenCode, Ghostty and Warp and the dense, quiet review surfaces of AI code-review products such as Greptile and CodeRabbit, built with shadcn/ui on a neutral palette. Borrow the patterns, never their names, logos, colors or copy. Brand tone, mood and per-reference notes live in [brand.md](brand.md).

## Principles
- **Neutral with one accent.** Surfaces, text and borders stay grayscale (`neutral` base color); hierarchy comes from weight, size, borders and solid vs outline fills. One indigo brand accent (`--brand`, which `--primary`, `--ring` and `--sidebar-primary` follow) marks selection (active navigation, the current toggle), primary actions, focus rings and chart emphasis, nothing else. `destructive` is reserved for failures and `warning` (amber) for warning marks in charts; warning text stays in the ink tokens. Status badges stay in ink. Do not add success-green or other hues; if a state seems to need color, use a different badge style or an icon first. The full spectrum gradient appears only in the logo mark (`BrandMark`).
- **Dense and scannable.** Tables over cards for lists of things (specs, findings, PRs, runs). Cards for summary stats and grouped settings. Default text is `text-sm`; secondary text is `text-muted-foreground`.
- **Code-native.** IDs, paths, SHAs and finding codes render in Geist Mono (`<Mono>` or `font-mono text-xs`). Show short SHAs (7 characters).
- **Quiet chrome.** Fixed left sidebar (repository card plus grouped navigation with lucide icons), no top bar, content capped at `max-w-5xl`. No hero banners, gradients (apart from the logo mark), illustrations or shadows beyond the shadcn defaults. Navigation lists each page once; planned pages share one collapsed group, and account-mode facts belong on Integrations, not in the sidebar.
- **Charts.** Ordered states use one ramp of the brand accent (`rampFill` in `components/overview.tsx`), validated with the dataviz palette validator (ordinal, light and dark, up to six steps). Errors use `--destructive` and warnings `--warning`. One axis per chart, a legend for two or more series and every value also printed as text.
- **Say it once.** A caveat such as "document status is not evidence" goes in the page description and, where a figure invites the misreading, on that figure. Sections do not repeat it.
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
- Do not copy screenshots, layouts pixel-for-pixel, wording or icons from OpenCode, Ghostty, Warp, Greptile, CodeRabbit or any other product.
- Do not add a theme toggle. The theme follows `prefers-color-scheme`.
- Do not hand-write a component that shadcn provides. Add it with the CLI (see components.md).
