# GitHub connection contract

The Next.js application can read a GitHub repository through a GitHub App and run the deterministic Spectrum check on that repository's `.spectrum/` at one pinned commit. The connection is read-only. It does not review code, post comments, create check runs or receive webhooks.

## Credentials
- The connection authenticates as a GitHub App installation, never as a personal token.
- The App needs repository permissions Contents: read, Metadata: read and Pull requests: read, and no webhook. Anything broader is outside this contract.
- The server reads `GITHUB_APP_ID`, `GITHUB_APP_SLUG` and the private key from `GITHUB_APP_PRIVATE_KEY_PATH` or `GITHUB_APP_PRIVATE_KEY`. Credentials stay in the server environment. They never appear in `.spectrum/`, page output, JSON responses, logs or error messages.
- `GITHUB_API_URL` optionally points the client at a GitHub Enterprise Server API or a local test double. It defaults to `https://api.github.com`.
- When any variable is missing, the application reports which names are missing and checks nothing. It does not fall back to anonymous or sample data.
- Installation tokens are requested per installation and reused only until five minutes before they expire.

## Repositories
- The repository list is the set of repositories the App's installations can read, as GitHub reports them.
- A user can also enter `owner/name` or a GitHub URL. If no installation covers that repository, the application says so and offers the App's install page. It does not try another credential.
- The App's Setup URL (`/api/github/setup`) only returns the user to the repository list. Its query parameters are not trusted or stored.

## Revisions
- A check targets the default branch, a named branch, tag or SHA, or an open pull request's head.
- The target is resolved to a full commit SHA before anything is downloaded. The archive is requested for that SHA, and the result names that SHA and the ref it came from. A result never claims a moving ref without its SHA.
- Ref names that contain whitespace, control characters, `..` path segments or Git-forbidden characters are rejected before any request.

## Snapshot
- The repository archive is extracted into a new temporary directory without restoring file ownership. The compressed download is capped at 100 MB.
- The check reads the snapshot through the same path rules as a local repository: symlinks that resolve outside the snapshot are refused, not followed.
- The snapshot is deleted after every check, whether the check passed, failed or threw.

## Results
- A result is the output of the deterministic structural check (`checkRepository`) for that commit: findings and specs read. It does not show that code implements the specs, that the specs are semantically right, or that a pull request is safe to merge.
- A commit without a readable `.spectrum/config.json` fails with an `invalid-config` finding; the application explains that nothing could be checked.
- When resolution, download or extraction fails, the result is "not assessed" with a safe error message, never a pass. A ref or pull request that does not exist is reported as not found, separately from a download or extraction failure.
- Each commit is analyzed once per server process. The analysis is cached in memory by repository and full SHA, at most 24 commits with the least recently used dropped first. Nothing is written to disk or a database, and a restart clears the cache. A failed analysis is not cached. A moving ref is resolved again on every request, so a new commit is analyzed when it appears.
- A result shows the time its analysis ran, not the time it was read from the cache.

## Repository setup
- The same snapshot is inspected for the Spectrum pieces the repository declares: `.spectrum/config.json` with `schema_version` 2, `@voyager-fm/spectrum` in `package.json`, the repository skills and the Claude Code plugin in `.claude/settings.json`. Detection uses `inspectRepositorySetup` from `@spectrum/spec-engine/setup`, so it matches the CLI.
- The dashboard turns missing pieces into a checklist of commands that the user runs in a clone. The App is read-only, so the dashboard never installs or writes anything. A skill that Spectrum did not install is never counted as done. The package is not published to npm yet, and the checklist says so.
- A file being present shows declared setup. It does not show that the CLI or an agent integration runs.

## Browsing and switching
- `/repositories/{owner}/{repo}/specs` and `/repositories/{owner}/{repo}/specs/{id}` show the specs at the same pinned commit. They keep `?ref=` or `?pr=` and name the SHA they read.
- The sidebar switches between the local repository and the connected repositories, and keeps the current tab. Its list is reused for one minute. If GitHub does not answer within three seconds, the list is marked incomplete and the page still renders.

## Not implemented
- Webhooks and automatic checks on push or pull request events.
- Pull request comments, reviews, check runs or any other write to GitHub.
- Persisted check history and comparisons between commits, or any database. Connection state lives in GitHub and the server environment.
- A CLI or plugin command for remote repositories. The JSON route `/api/github/repositories/{owner}/{repo}/check` returns the same result for later clients.
- Model-based review of a remote repository.
