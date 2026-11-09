# Brand tone and references

Spectrum should feel like it belongs next to the developer tools its users already run: OpenCode, Ghostty and Warp in the terminal, CodeRabbit and Greptile on their pull requests. This file sets the mood. design.md and components.md turn it into dashboard rules, and review-patterns.md covers the structure of review pages; where they are more specific, they win.

Reference sites were read on 2026-11-09 as text only (no screenshots or CSS inspected; for Ghostty, the raw homepage HTML was checked for its ASCII frames). Treat the observations below as tone direction, not measured specs.

## Brand in one line
A precise, quiet instrument for engineers: terminal aesthetic, review-shaped, and honest about what it has and has not verified.

Mood words: **precise, plain, technical, calm, confident, honest**, with a restrained **pixel/bitmap** accent.
Not: cute, glossy, "magic AI", enterprise-heavy, hype. The pixel accent is 1-bit and monochrome, never a colorful retro-game look.

## What each reference teaches
| Reference | Borrow (pattern) | Do not borrow |
| --- | --- | --- |
| OpenCode | Terminal-native identity: monospace as a first-class typeface, near-monochrome surfaces, bracketed/numbered labels (`[0]`, `01`). Plain, reassuring copy about where things run ("works on your machine", "no account needed"). The CLI and the web share one voice. | Custom wordmark, its font, interactive letter gimmicks, star/contributor counters. |
| CodeRabbit | The review is the product: the main visual is a real review artifact (a PR comment, a finding, a verification step), not an illustration. Numbered capability sections (`01 Review`, `02 Triage`). Short, blunt, sentence-case headlines. | Orange brand color, mascot, provocative slogans, logo walls and customer-count claims. |
| Greptile | Technical labeling: mono section labels in brackets (`[ AGENT ]`), numbered steps, code mockups with file paths and `+`/`-` diff lines as imagery. Declarative headlines that end in a period. Peer-to-peer, matter-of-fact voice. | Green accent, lizard mascot, bug-example marketing, testimonials. |
| Ghostty | ASCII art as the hero: the brand visual is an animated character-grid drawing, so the medium (text in a terminal) is the illustration. One-sentence factual positioning ("fast, feature-rich, cross-platform terminal emulator"). Sparse page, the product speaks. | The ghost mark, its icon and its specific ASCII frames. |
| Warp | Text-built "instrument" visuals: a block-character grid (`▩ ▨ □`) with a status legend as the hero, technical-figure captions (`fig. 1 — …`), bordered panels showing real config (YAML with numbered callouts), charts and status rosters. Dense, terse, lowercase-leaning copy. Polished dark surfaces that still feel like a terminal. | Its warm accent colors and typeface, the "factory" metaphor and wording, customer logo rows and benchmark claims. |

Shared across all three, and therefore Spectrum's baseline: dark-friendly neutral surfaces, mono for anything code-shaped, product artifacts as the only imagery, and copy that a senior engineer would not roll their eyes at.

## Terminal aesthetic signals
The "dev tool" feel comes from making the UI look like it came out of code. These are the levers; per-surface limits follow in the next section.

| Signal | Examples |
| --- | --- |
| Monospace | IDs, paths, SHAs, commands, step numbers and eyebrow labels in Geist Mono |
| Machine labels | `[ SPECS ]`, `[0]`, `01`, `STEP 02`; uppercase, small, tracked, muted |
| Code syntax | `+`/`-` diff prefixes, `$` before commands, file paths, `//` for asides |
| Terminal palette | Background and foreground, one indigo accent for selection and emphasis; `destructive` for failures |
| Grid and hairlines | 1px borders and strict alignment instead of shadows or gradients |
| Real output as visuals | Review comments, ChangeSet diffs, feature records; no illustrations |
| Density | Tables, aligned columns, `tabular-nums` |
| Keyboard cues | Shortcut hints (`⌘K`, `↵`, `esc`) in `Kbd`-style chips, only for shortcuts that exist |
| CLI status words | `passed`, `failed`, `not run`, optionally with `✓` `✗` `–`; the word always carries the meaning |
| Box drawing | `───`, `│`, `└─` for trees and dividers in CLI output and docs |
| Character-grid visuals | ASCII art or a block-character grid (`█ ▓ ▒ ░`, `▩ □`) as a hero or diagram, with a legend when cells mean something (Ghostty, Warp) |
| Figure captions | `fig. 1 — the spec loop` above a diagram or panel; mono, small, muted |
| Plain voice | Short declarative sentences, no exclamation marks |

### Pixel and bitmap accent
A small dose of pixel art reinforces the terminal feel. Keep it a display accent, not a theme.
- **Font:** Geist Pixel (Vercel, Feb 2026; Square, Grid, Circle, Triangle and Line styles, also a variable `--font-geist-pixel`) extends the Geist family we already use. Use it for the wordmark, large landing headlines, step numbers or a CLI banner. Never for body text, tables, labels, badges or anything users must read quickly. It is not installed; confirm its license in `vercel/geist-pixel-font` before adding it.
- **Motifs:** 1-bit monochrome only: pixel-grid icons or logo marks, dithered (Bayer/ordered) fills on brand imagery, block characters (`█ ▓ ▒ ░`) for meters or dividers in CLI and docs, ASCII art for a CLI banner.
- **Character-grid hero:** On brand surfaces, the strongest visual is a Spectrum concept drawn in text: for example the spec loop or a ChangeSet moving through draft → review → approved as a character grid with a legend. If it animates, it respects `prefers-reduced-motion` and stays legible as a static frame. If the grid shows states, label it "Example" unless it reads real data.
- **Limits:** Ink or the single accent, like everything else. No multicolor sprites, game characters or mascots. Pixel motifs are decoration; they never encode state (no pixel "success" icon), and they never replace a status word.

## How the tone applies per surface
| Surface | Expression |
| --- | --- |
| Dashboard (`apps/web`) | Most restrained. Follow design.md: neutral surfaces with the one indigo accent, dense tables, quiet chrome. The spectrum gradient appears only in the sidebar logo mark. The brand shows through mono identifiers, precise descriptions, real keyboard hints and honest planned states. Pixel: the sidebar wordmark at most. No box drawing, ASCII or dithering. |
| CLI (`apps/cli`) | OpenCode-like. Plain lines, aligned columns, box-drawing trees, status words (`passed`, `failed`, `not run`) that still read without color. An optional ASCII or block-character banner on `--help` or `init` only, never on every command and never in machine-readable output. No spinners or emoji that imply work the CLI is not doing. |
| README, docs, future landing page | The most room for brand. Allowed: Geist Pixel headline or wordmark, bracketed mono eyebrows (`[ SPECS ]`, `[ REVIEW ]`), numbered steps, `fig.` captions, `$` command blocks, dithered or pixel-grid monochrome motifs, an ASCII/character-grid hero, and a real spec diff or finding as a visual. Still neutral with the one accent; the spectrum gradient stays in the logo mark. |

## Visual vocabulary
- **Type:** Geist for prose, Geist Mono for IDs, paths, SHAs, commands, step numbers and eyebrow labels, Geist Pixel for display only (see above). Mono eyebrows are uppercase, small (`text-xs`), muted, with tracking; headings stay sentence case.
- **Color:** Neutral, one indigo accent, `destructive` for failures and amber `warning` for warning marks (see design.md). The references use orange or green accents; Spectrum uses indigo and keeps it to selection, primary actions, focus and chart emphasis. The multi-hue spectrum gradient is the logo mark only.
- **Structure:** Hairline borders and grid alignment instead of shadows, gradients or glow. Numbering (`01`, `02`) for sequences such as the spec loop or setup steps.
- **Imagery:** Only real or clearly labeled sample artifacts: a `.spectrum/` feature record, a ChangeSet diff, a finding linked to an acceptance criterion. Sample content is labeled "Example" on screen. The only decorative exception is the monochrome pixel/dither accent above. No stock illustrations, 3D shapes, mascots or AI sparkles.

## Voice
- Short declarative sentences. Headlines may end in a period on marketing surfaces; dashboard headings do not.
- Say what Spectrum does in concrete nouns: specs, rules, findings, proposals, revisions. Prefer "Checks every feature spec against the schema." over "Supercharge your product workflow."
- Name the boundary in the same breath as the capability: "Deterministic check, no model." / "Review publishing is not implemented."
- Confident, never inflated. No "always in sync", "autonomous PM", "10x", or claims about customers, stars, accuracy or bugs caught. Spectrum has no such evidence yet; inventing it breaks the honesty rules in states-and-copy.md.
- Peer tone: no exclamation marks, no apologies, no "Oops".

## Checklist for a branded surface
- Could a reviewer mistake it for OpenCode, CodeRabbit or Greptile? If yes, it copies too much: change layout, wording or visual.
- Is every color neutral, the indigo accent, `destructive` or `warning`, each in its own role?
- Is every visual a Spectrum artifact (or labeled example), apart from a monochrome pixel accent?
- Is pixel type limited to display text, and does every status still read as a word?
- Does every capability claim match what is implemented today (`.spectrum/overview.md`, "Current boundary")?
