import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountsMisconfigured, SignInPrompt } from '../../components/account.tsx';
import { EmptyNotice, PageHead } from '../../components/dashboard.tsx';
import { currentViewer, safeNext } from '../../lib/auth.ts';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  denied: 'GitHub sign-in was cancelled.',
  state: 'The sign-in link expired or was opened in another browser. Start again.',
  github: 'GitHub did not complete the sign-in. Try again in a moment.',
  database: 'Signed in with GitHub, but this server could not save the session.',
  'not-enabled': 'Sign-in is not enabled on this server.',
};

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  const viewer = await currentViewer();
  if (viewer.mode === 'accounts' && viewer.user) redirect(safeNext(next));
  return (
    <>
      <PageHead
        title="Sign in"
        description="Spectrum uses your GitHub account to decide which repositories you can see."
      />
      {error && ERRORS[error] ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {ERRORS[error]}
        </p>
      ) : null}
      {viewer.mode === 'single-operator' ? (
        <EmptyNotice>
          This server runs in single-operator mode. No sign-in is needed, and everyone who can reach
          it sees every repository the App can read.
        </EmptyNotice>
      ) : viewer.mode === 'misconfigured' ? (
        <AccountsMisconfigured missing={viewer.missing} />
      ) : (
        <SignInPrompt next={safeNext(next)} />
      )}
    </>
  );
}
