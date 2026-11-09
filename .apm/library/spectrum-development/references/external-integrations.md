# External integrations

Use this reference when a change connects Spectrum to an external service such as GitHub, Linear or a model provider. The integration contract in `.spectrum/contracts/` stays the authority for scope and permissions.

## Aim for live evidence
- Treat a working connection to the real service as the deliverable. Mocks and local test doubles back up regression tests and early UI review. They never stand in for live evidence, and a user who asks for the real service expects the real service.
- Plan the live path early. Identify what only the user can do, such as account ownership, organization admin rights, billing or two-factor prompts. Prepare everything else so that step takes one action: a prefilled registration URL or manifest, the exact permission list and the callback or setup URL.
- When the user authorizes it, complete the registration in their signed-in browser through ego-browser. Before submitting, read the form values back. Afterwards, confirm the result through the service API, for example `gh api apps/<slug>` or `gh api orgs/<org>/installations`.
- Report live results separately from mock results. Name the account, the installation and the exact revision or record that was checked. Cross-check that identifier through an independent path, such as a commit SHA from `gh api repos/<owner>/<repo>/commits/<ref>`.

## Write external-facing text as product copy
- Names, descriptions, homepages and consent text that another service shows to users are product copy. Write them as the shipped service would: what Spectrum does for the user, what it reads, and what it never writes. Do not use "dev", "test" or "development" placeholders unless the user asks for a separate development registration.
- Check that a name is available before proposing it. On GitHub, App names share a namespace with user and organization accounts and with other Apps. Check `gh api users/<slug>` and `gh api apps/<slug>` for each candidate. GitHub can reject a taken name on rename with a bare 404 instead of a validation message.
- Present names that are verified available, with a recommendation, and follow the user's naming decision. Bot identities appear as `<slug>[bot]`, so the slug is user-visible.

## Credentials and scope
- Request the least privilege the contract names, and install only on the repositories, teams or projects the task needs.
- Keep secrets outside the repository with owner-only permissions, for example `~/.config/spectrum/<name>.pem` with mode 600. Reference them through ignored environment files such as `apps/web/.env.local`. The UI, docs and logs show variable names and missing-state only, never values or tokens.
- Never put credentials in `.spectrum/`, commits, task output or screenshots. Revocation, rotation and organization-wide installs are separate decisions that need the user.

## Runtime pitfalls observed in this repository
- Next.js patches `fetch` with a data cache and stream tees. Send authenticated requests with `cache: 'no-store'`. Do not `await response.body.cancel()` on error responses: the cancelled tee can stay pending and hang the route.
- On macOS `tmpdir()` is a symlink. Canonicalize extracted roots with `realpath` before spec-engine's path-escape checks.
- Pin moving refs to full SHAs before downloading content. Every result names the SHA it describes.
- Map failures to their cause. Invalid input returns 400. A missing revision or uninstalled target returns 404. A failure in an upstream or extraction step returns 502. A check that never ran is "not assessed", never a pass.
- A live call can exceed default browser-test timeouts on a cold dev server. Give assertions that depend on live calls an explicit timeout instead of relying on retries.
