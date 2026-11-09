import { LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { Viewer } from '../lib/auth.ts';
import { Mono } from './dashboard.tsx';

/** Sign-in link that returns to `next` afterwards. */
export function signInHref(next = '/') {
  return `/api/auth/github/login?next=${encodeURIComponent(next)}`;
}

/** Sidebar footer: who is signed in, or how this server decides access. */
export function AccountControl({ viewer }: { viewer: Viewer }) {
  if (viewer.mode === 'single-operator') {
    return (
      <p
        className="px-2 text-xs text-muted-foreground"
        title="No accounts are configured. Anyone who can reach this server sees every repository the App can read."
      >
        Single-operator mode
      </p>
    );
  }
  if (viewer.mode === 'misconfigured') {
    return (
      <Link
        href="/settings"
        className="px-2 text-xs text-destructive underline-offset-4 hover:underline"
      >
        Sign-in is misconfigured
      </Link>
    );
  }
  if (!viewer.user) {
    return (
      <a href={signInHref()} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <LogIn aria-hidden />
        Sign in with GitHub
      </a>
    );
  }
  const { user } = viewer;
  return (
    <div className="flex items-center gap-2 px-2">
      {/* biome-ignore lint/performance/noImgElement: GitHub avatars are small remote images. */}
      <img src={user.avatarUrl} alt="" className="size-6 rounded-full border" />
      <span className="min-w-0 flex-1 truncate text-sm" title={user.name ?? user.login}>
        {user.login}
      </span>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          aria-label="Sign out"
        >
          <LogOut aria-hidden />
        </button>
      </form>
    </div>
  );
}

/** Shown in place of repository data until the visitor signs in. */
export function SignInPrompt({ next }: { next: string }) {
  return (
    <section className="rounded-xl border p-6">
      <h2 className="text-sm font-medium">Sign in to see repositories</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Spectrum shows the repositories of the GitHub installations you can access. Signing in asks
        GitHub which installations those are; Spectrum keeps no GitHub token.
      </p>
      <a
        href={signInHref(next)}
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}
      >
        <LogIn aria-hidden />
        Sign in with GitHub
      </a>
    </section>
  );
}

/** Account variables are partly set: data is withheld instead of opening it to everyone. */
export function AccountsMisconfigured({ missing }: { missing: string[] }) {
  return (
    <section className="rounded-xl border border-destructive/40 p-6">
      <h2 className="text-sm font-medium">Sign-in is not fully configured</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Some account settings are present and others are missing, so repository data stays hidden.
        Missing:{' '}
        {missing.map((name, i) => (
          <span key={name}>
            {i ? ', ' : ''}
            <Mono>{name}</Mono>
          </span>
        ))}
        .
      </p>
    </section>
  );
}
