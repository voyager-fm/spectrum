'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

type State = { status: 'loading' } | { status: 'ready' } | { status: 'failed'; message: string };

/**
 * Paints a CSS color over the page background and reads it back as opaque `rgb()`. Mermaid
 * derives shades from its theme variables and cannot parse the `oklch()` and alpha tokens the
 * dashboard palette uses.
 */
function resolveColors(names: string[]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const read = (name: string) => {
    probe.style.color = `var(${name})`;
    return getComputedStyle(probe).color;
  };
  const background = read('--background');
  const out: Record<string, string> = {};
  for (const name of names) {
    const color = read(name);
    if (!context) {
      out[name] = color;
      continue;
    }
    context.fillStyle = background;
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    out[name] = `rgb(${r}, ${g}, ${b})`;
  }
  probe.remove();
  return out;
}

/** Neutral surfaces with the brand accent only on lines' emphasis, matching the dashboard. */
function themeVariables(dark: boolean) {
  const c = resolveColors([
    '--background',
    '--foreground',
    '--muted',
    '--muted-foreground',
    '--border',
    '--brand',
  ]);
  return {
    darkMode: dark,
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontSize: '13px',
    background: c['--background'],
    textColor: c['--foreground'],
    primaryColor: c['--muted'],
    primaryTextColor: c['--foreground'],
    primaryBorderColor: c['--muted-foreground'],
    secondaryColor: c['--background'],
    secondaryTextColor: c['--foreground'],
    secondaryBorderColor: c['--border'],
    tertiaryColor: c['--background'],
    tertiaryTextColor: c['--foreground'],
    tertiaryBorderColor: c['--border'],
    lineColor: c['--muted-foreground'],
    mainBkg: c['--muted'],
    nodeBorder: c['--muted-foreground'],
    clusterBkg: c['--background'],
    clusterBorder: c['--border'],
    titleColor: c['--foreground'],
    edgeLabelBackground: c['--background'],
    noteBkgColor: c['--muted'],
    noteTextColor: c['--foreground'],
    noteBorderColor: c['--border'],
    actorBkg: c['--muted'],
    actorBorder: c['--muted-foreground'],
    actorTextColor: c['--foreground'],
    actorLineColor: c['--muted-foreground'],
    signalColor: c['--foreground'],
    signalTextColor: c['--foreground'],
    labelBoxBkgColor: c['--muted'],
    labelBoxBorderColor: c['--muted-foreground'],
    labelTextColor: c['--foreground'],
    loopTextColor: c['--foreground'],
    activationBkgColor: c['--muted'],
    activationBorderColor: c['--brand'],
    sequenceNumberColor: c['--background'],
  };
}

/**
 * Renders a Mermaid fence as a diagram in the browser. `children` is the highlighted source: it
 * shows while Mermaid loads, stays available under the diagram, and replaces the diagram when
 * the source does not parse. Mermaid runs with `securityLevel: 'strict'`, which sanitizes labels
 * and disables click handlers, because diagrams come from repository files.
 */
export function MermaidDiagram({ source, children }: { source: string; children: ReactNode }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const target = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const draw = async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: themeVariables(scheme.matches),
          flowchart: { htmlLabels: false },
        });
        await mermaid.parse(source);
        const { svg } = await mermaid.render(id, source);
        if (cancelled || !target.current) return;
        target.current.innerHTML = svg;
        setState({ status: 'ready' });
      } catch (error) {
        document.getElementById(`d${id}`)?.remove();
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        const summary = message.split('\n')[0]?.trim().replace(/:$/, '');
        setState({ status: 'failed', message: summary || 'unknown error' });
      }
    };
    void draw();
    scheme.addEventListener('change', draw);
    return () => {
      cancelled = true;
      scheme.removeEventListener('change', draw);
    };
  }, [id, source]);

  return (
    <figure className="flex flex-col gap-2">
      <div
        ref={target}
        role="img"
        aria-label="Mermaid diagram"
        hidden={state.status !== 'ready'}
        className="overflow-x-auto rounded-xl border p-4 [&_svg]:mx-auto [&_svg]:h-auto"
      />
      {state.status === 'ready' ? (
        <details className="text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer select-none rounded-sm outline-ring/50 focus-visible:outline-2">
            Diagram source
          </summary>
          <div className="mt-2">{children}</div>
        </details>
      ) : (
        <>
          {children}
          <figcaption className="text-xs text-muted-foreground" aria-live="polite">
            {state.status === 'loading'
              ? 'Rendering diagram…'
              : `This Mermaid diagram could not be rendered, so its source is shown instead (${state.message}).`}
          </figcaption>
        </>
      )}
    </figure>
  );
}
