# Dashboard architecture

Re-read `apps/web/src/` before relying on this map; it describes the dashboard as of 2026-11-09.

## Stack
- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 and shadcn/ui (Base UI primitives, lucide icons). No client data library or state manager is installed; do not add one for a single screen.
- Every page is an async Server Component. The root layout sets `export const dynamic = 'force-dynamic'`, so each request reads the repository from disk.
- The only Spectrum Client Component is `src/components/nav.tsx`, which needs `usePathname()`. shadcn primitives may be client components internally. Add `'use client'` only for browser state or event handlers, and keep data loading on the server.

## Data flow
```
.spectrum/ (repository on disk)
  -> packages/spec-engine checkRepository()       structural check, specs, findings
  -> apps/web/src/lib/dashboard.ts loadDashboard() DashboardSnapshot
  -> src/app/**/page.tsx                           render only
```
- `repositoryRoot()` reads `SPECTRUM_REPOSITORY` and defaults to the monorepo root. Use it for every repository read; never hardcode a path.
- `loadDashboard()` wraps each read in `attempt()`. A failure adds a line to `errors` and returns `null` or `[]`. Pages render `<LoadErrors errors={data.errors} />` and never substitute sample data.
- Put parsing and validation in `spec-engine` or `core`, not in a page. A page that computes domain truth (for example, deciding approval) duplicates the shared contract the CLI and worker must also use.
- The dashboard is read-only. Writing to the repository, publishing to GitHub or calling a model belongs to an implemented adapter behind an approved contract, not to a page or route handler added for a demo.

## Routes
| Route | File | Data |
| --- | --- | --- |
| `/` | `app/page.tsx` | check summary, findings, config, agent-loop links |
| `/specs` | `app/specs/page.tsx` | feature specs, shared contracts and flows |
| `/specs/[id]` | `app/specs/[id]/page.tsx` | one spec; `notFound()` for an unknown ID |
| `/rules` | `app/rules/page.tsx` | `.spectrum/rules` documents |
| `/settings` | `app/settings/page.tsx` | integration flags from `config.json` |
| `/proposals`, `/runs`, `/reviews` | `app/<name>/page.tsx` | `<Planned>` placeholders only |

## Adding or changing a page
1. Add the data to `DashboardSnapshot` through `attempt()` in `lib/dashboard.ts`, and cover success and missing-data cases in `lib/dashboard.test.ts`.
2. Create `app/<route>/page.tsx` with `export const metadata = { title: '<Name>' }`. The layout template renders `<Name> · Spectrum`.
3. Start the page with `<PageHead>` and `<LoadErrors>`, then the content, using the compositions in components.md and the patterns in design.md.
4. Add the route, a lucide icon and its group to `groups` in `nav.tsx`. Set `planned: true` while the page is only a placeholder, and remove it when real data is shown.
5. Spectrum imports use relative paths with explicit `.ts`/`.tsx` extensions; shadcn primitives and `cn` come from `@/components/ui/*` and `@/lib/utils`.
