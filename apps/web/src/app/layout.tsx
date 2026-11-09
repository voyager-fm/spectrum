import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { GitCommitHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Nav } from '../components/nav.tsx';
import { readRepositoryState, repositoryRoot } from '../lib/dashboard.ts';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Spectrum', template: '%s · Spectrum' },
  description: 'Repository-native product and technical specifications.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const repo = await readRepositoryState(repositoryRoot());
  return (
    <html lang="en" className={cn('font-sans antialiased', sans.variable, mono.variable)}>
      <body>
        <div className="grid min-h-svh md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-6 border-b bg-sidebar p-3 text-sidebar-foreground md:sticky md:top-0 md:h-svh md:border-r md:border-b-0">
            <div className="flex items-center gap-2 px-2 pt-1">
              <div className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground" aria-hidden>
                S
              </div>
              <span className="font-semibold tracking-tight">Spectrum</span>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2" title="Local repository read by this dashboard">
              <div className="truncate text-sm font-medium">{repo.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitCommitHorizontal className="size-3.5" aria-hidden />
                {repo.revision ? <span className="font-mono">{repo.revision.slice(0, 7)}</span> : 'No Git revision'}
              </div>
              {repo.dirty ? <div className="text-xs text-muted-foreground">Uncommitted changes</div> : null}
            </div>
            <Nav />
          </aside>
          <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-10 md:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
