import { NextResponse } from 'next/server';
import { loadRepositoryCheck, parseTarget } from '../../../../../../../lib/github.ts';

type Context = { params: Promise<{ owner: string; repo: string }> };

const STATUS = {
  ready: 200,
  'not-configured': 503,
  invalid: 400,
  'not-installed': 404,
  error: 502,
};

/**
 * Read-only JSON form of the repository check: `?ref=` or `?pr=` selects the revision.
 * The response carries the checked SHA; it never includes credentials.
 */
export async function GET(request: Request, { params }: Context) {
  const { owner, repo } = await params;
  const url = new URL(request.url);
  const target = parseTarget({
    ref: url.searchParams.get('ref') ?? undefined,
    pr: url.searchParams.get('pr') ?? undefined,
  });
  const view = await loadRepositoryCheck(owner, repo, target);
  if (view.status !== 'ready') {
    const { app, ...rest } = view;
    return NextResponse.json(
      { ...rest, configured: app.configured, missing: app.missing },
      { status: STATUS[view.status] },
    );
  }
  const status = view.check
    ? 200
    : view.failure === 'invalid-target'
      ? 400
      : view.failure === 'revision-not-found'
        ? 404
        : 502;
  return NextResponse.json(
    {
      status: view.check ? 'checked' : 'not-assessed',
      repository: view.repository.fullName,
      check: view.check,
      errors: view.errors,
    },
    { status },
  );
}
