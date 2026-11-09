import { CircleAlert, CircleDashed } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PageHead({ title, description }: { title: string; description: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

/**
 * Status semantics, rendered in monotone:
 * ok = verified good (solid), bad = failure (the only colored state),
 * planned = not implemented or stale (dashed), info = configuration fact, neutral = draft or untracked.
 */
export type Tone = 'ok' | 'bad' | 'planned' | 'info' | 'neutral';

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  if (tone === 'ok') return <Badge>{children}</Badge>;
  if (tone === 'bad') return <Badge variant="destructive">{children}</Badge>;
  if (tone === 'planned')
    return (
      <Badge variant="outline" className="border-dashed text-muted-foreground">
        {children}
      </Badge>
    );
  if (tone === 'info') return <Badge variant="secondary">{children}</Badge>;
  return <Badge variant="outline">{children}</Badge>;
}

export function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-10 flex scroll-mt-6 flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  title,
  value,
  children,
}: {
  title: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      {children ? (
        <CardContent className="text-xs text-muted-foreground">{children}</CardContent>
      ) : null}
    </Card>
  );
}

export function Mono({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <code className={cn('rounded bg-muted px-1 py-0.5 font-mono text-xs', className)}>
      {children}
    </code>
  );
}

/** Empty result of a successful load. Name the source and the next step. */
export function EmptyNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** Explicit placeholder for a capability that is planned but not implemented. */
export function Planned({
  title,
  children,
  upcoming,
}: {
  title: string;
  children: ReactNode;
  upcoming: string[];
}) {
  return (
    <section
      aria-label={`${title} (not implemented)`}
      className="rounded-xl border border-dashed p-6"
    >
      <div className="flex items-center gap-2">
        <CircleDashed className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium">{title}</h2>
        <StatusBadge tone="planned">Not implemented</StatusBadge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
      <ul className="mt-4 flex flex-col gap-1.5 text-sm">
        {upcoming.map((item) => (
          <li
            key={item}
            className="flex gap-2 before:mt-2 before:size-1 before:shrink-0 before:rounded-full before:bg-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LoadErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <Alert variant="destructive" className="mb-6">
      <CircleAlert aria-hidden />
      <AlertTitle>Some repository data could not be read.</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
