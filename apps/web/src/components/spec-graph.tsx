'use client';

import { Maximize, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { bounds, ForceLayout, fitView, type View } from '../lib/graph-layout.ts';
import {
  GRAPH_GROUPS,
  type GraphEdge,
  type GraphGroup,
  type GraphNode,
  type SpecGraph,
} from '../lib/spec-graph.ts';

interface Placed {
  layout: ForceLayout;
  nodes: GraphNode[];
  edges: GraphEdge[];
  index: Map<string, number>;
}

const HUBS: GraphGroup[] = ['feature', 'category'];
const LABEL_SCALE = 1.15;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

interface Palette {
  foreground: string;
  muted: string;
  background: string;
  brand: string;
  destructive: string;
  font: string;
}

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    foreground: token('--foreground', '#111'),
    muted: token('--muted-foreground', '#777'),
    background: token('--background', '#fff'),
    brand: token('--brand', '#4f46e5'),
    destructive: token('--destructive', '#dc2626'),
    font: style.fontFamily || 'sans-serif',
  };
}

function radius(node: GraphNode): number {
  const base =
    node.group === 'category'
      ? 8
      : node.group === 'feature'
        ? 6
        : node.group === 'interaction'
          ? 4.5
          : 3.75;
  return base + Math.min(Math.sqrt(node.degree) * 0.7, 6);
}

function matches(node: GraphNode, query: string): boolean {
  return `${node.label} ${node.title} ${node.path ?? ''}`.toLowerCase().includes(query);
}

/**
 * Force-directed map of every interaction, feature, category and document and the links between
 * them. Selecting a node lists its neighbours as links; double-clicking opens its page.
 */
export function SpecGraphView({ graph }: { graph: SpecGraph }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<GraphGroup>>(() => new Set());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const present = useMemo(() => {
    const counts = new Map<GraphGroup, number>();
    for (const n of graph.nodes) counts.set(n.group, (counts.get(n.group) ?? 0) + 1);
    return GRAPH_GROUPS.filter((g) => counts.has(g.group)).map((g) => ({
      ...g,
      count: counts.get(g.group) ?? 0,
    }));
  }, [graph.nodes]);

  const visible = useMemo(() => {
    const nodes = graph.nodes.filter((n) => !hidden.has(n.group));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [graph, hidden]);

  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of visible.edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)?.add(e.target);
      map.get(e.target)?.add(e.source);
    }
    return map;
  }, [visible.edges]);

  const needle = query.trim().toLowerCase();
  const found = useMemo(
    () => (needle ? visible.nodes.filter((n) => matches(n, needle)) : []),
    [visible.nodes, needle],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The layout with the node list it was built for; indices into points follow that list.
  const layoutRef = useRef<Placed | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });
  const sizeRef = useRef({ width: 0, height: 0 });
  const paletteRef = useRef<Palette | null>(null);
  const hoverRef = useRef<string | null>(null);
  const frameRef = useRef(0);
  const autoFitRef = useRef(true);
  // Latest render inputs for the animation loop, which outlives a single render.
  const stateRef = useRef({ neighbours, selected, needle, found });
  stateRef.current = { neighbours, selected, needle, found };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const placed = layoutRef.current;
    const palette = paletteRef.current;
    if (!canvas || !placed || !palette) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { neighbours, selected, needle, found } = stateRef.current;
    const { width, height } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    const view = viewRef.current;
    const { nodes, edges, index } = placed;
    const points = placed.layout.points;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y);

    const focus = hoverRef.current ?? selected;
    const near = focus ? (neighbours.get(focus) ?? new Set<string>()) : null;
    const hits = needle ? new Set(found.map((n) => n.id)) : null;
    const lit = (id: string) => (near ? id === focus || near.has(id) : hits ? hits.has(id) : true);

    // Edges first, so nodes sit on top.
    ctx.lineWidth = 1 / view.scale;
    for (const edge of edges) {
      const a = points[index.get(edge.source) ?? -1];
      const b = points[index.get(edge.target) ?? -1];
      if (!a || !b) continue;
      const touching = focus !== null && (edge.source === focus || edge.target === focus);
      ctx.globalAlpha = touching
        ? 0.9
        : near || hits
          ? 0.06
          : edge.kind === 'membership'
            ? 0.22
            : 0.3;
      ctx.strokeStyle = touching ? palette.brand : palette.muted;
      ctx.setLineDash(edge.kind === 'membership' ? [3 / view.scale, 3 / view.scale] : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const [i, node] of nodes.entries()) {
      const p = points[i];
      const r = radius(node);
      const on = lit(node.id);
      const accent = node.id === focus || node.id === selected || (hits?.has(node.id) && !near);
      ctx.globalAlpha = on ? 1 : 0.15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      const hub = HUBS.includes(node.group);
      if (accent) ctx.fillStyle = palette.brand;
      else if (hub || !node.hasDocument) ctx.fillStyle = palette.background;
      else ctx.fillStyle = node.group === 'interaction' ? palette.foreground : palette.muted;
      ctx.fill();
      if (hub || !node.hasDocument || node.errors) {
        ctx.lineWidth = (node.errors ? 2 : 1.5) / view.scale;
        ctx.strokeStyle = node.errors
          ? palette.destructive
          : accent
            ? palette.brand
            : palette.foreground;
        ctx.setLineDash(node.hasDocument ? [] : [2 / view.scale, 2 / view.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Labels: everything once zoomed in, otherwise hubs and the focused neighbourhood.
    const size = 11 / view.scale;
    ctx.font = `${size}px ${palette.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const [i, node] of nodes.entries()) {
      const on = lit(node.id);
      const show =
        view.scale >= LABEL_SCALE ||
        node.group === 'category' ||
        (near !== null && on) ||
        hits?.has(node.id);
      if (!show) continue;
      const p = points[i];
      const label = node.label.length > 40 ? `${node.label.slice(0, 39)}…` : node.label;
      ctx.globalAlpha = on ? 1 : 0.2;
      ctx.fillStyle = node.id === focus ? palette.foreground : palette.muted;
      ctx.fillText(label, p.x, p.y + radius(node) + 3 / view.scale);
    }
    ctx.globalAlpha = 1;
  }, []);

  const fit = useCallback(() => {
    const placed = layoutRef.current;
    const { width, height } = sizeRef.current;
    if (!placed?.nodes.length || !width || !height) return;
    viewRef.current = fitView(bounds(placed.layout.points), width, height);
  }, []);

  // While the layout spreads out, the view keeps fitting it until the user pans, zooms or drags.
  const schedule = useCallback(() => {
    if (frameRef.current) return;
    const step = () => {
      frameRef.current = 0;
      const placed = layoutRef.current;
      if (!placed) return;
      const moving = placed.layout.tick();
      if (autoFitRef.current) fit();
      draw();
      if (moving) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [draw, fit]);

  // Rebuild the layout when the visible nodes change, keeping positions nodes already had.
  useEffect(() => {
    const previous = layoutRef.current;
    if (previous)
      for (const [i, node] of previous.nodes.entries())
        positions.current.set(node.id, previous.layout.points[i]);
    const index = new Map(visible.nodes.map((n, i) => [n.id, i]));
    const layout = new ForceLayout(
      visible.nodes.length,
      visible.edges.map((e: GraphEdge) => [index.get(e.source) ?? -1, index.get(e.target) ?? -1]),
    );
    let kept = 0;
    for (const [i, node] of visible.nodes.entries()) {
      const at = positions.current.get(node.id);
      if (at) {
        layout.points[i].x = at.x;
        layout.points[i].y = at.y;
        kept++;
      }
    }
    if (kept) layout.alpha = 0.5;
    layoutRef.current = { layout, nodes: visible.nodes, edges: visible.edges, index };
    if (!kept) autoFitRef.current = true;
    schedule();
  }, [visible, schedule]);

  // Canvas size and theme.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    paletteRef.current = readPalette(container);
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width, height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (autoFitRef.current) fit();
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const theme = () => {
      paletteRef.current = readPalette(container);
      draw();
    };
    media.addEventListener('change', theme);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', theme);
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [draw, fit]);

  // Redraw on selection, search or neighbourhood changes.
  useEffect(() => {
    void selected;
    void needle;
    draw();
  }, [draw, selected, needle]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const view = viewRef.current;
    const x = clientX - (rect?.left ?? 0);
    const y = clientY - (rect?.top ?? 0);
    return { x: (x - view.x) / view.scale, y: (y - view.y) / view.scale, sx: x, sy: y };
  }, []);

  const hit = useCallback((x: number, y: number): number => {
    const placed = layoutRef.current;
    if (!placed) return -1;
    const slack = 4 / viewRef.current.scale;
    let best = -1;
    let bestDistance = Infinity;
    for (const [i, node] of placed.nodes.entries()) {
      const p = placed.layout.points[i];
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius(node) + slack && d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    }
    return best;
  }, []);

  const zoom = useCallback(
    (factor: number, sx?: number, sy?: number) => {
      const view = viewRef.current;
      const { width, height } = sizeRef.current;
      const cx = sx ?? width / 2;
      const cy = sy ?? height / 2;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
      const k = scale / view.scale;
      autoFitRef.current = false;
      viewRef.current = { scale, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k };
      draw();
    },
    [draw],
  );

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const { sx, sy } = toWorld(event.clientX, event.clientY);
      zoom(Math.exp(-event.deltaY * 0.0015), sx, sy);
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, [toWorld, zoom]);

  const drag = useRef<{
    kind: 'node' | 'pan';
    index: number;
    startX: number;
    startY: number;
    viewX: number;
    viewY: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = toWorld(event.clientX, event.clientY);
    const index = hit(x, y);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      kind: index >= 0 ? 'node' : 'pan',
      index,
      startX: event.clientX,
      startY: event.clientY,
      viewX: viewRef.current.x,
      viewY: viewRef.current.y,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const { x, y } = toWorld(event.clientX, event.clientY);
    const current = drag.current;
    if (current) {
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.moved && Math.hypot(dx, dy) < 4) return;
      current.moved = true;
      const placed = layoutRef.current;
      autoFitRef.current = false;
      if (current.kind === 'node' && placed) {
        const p = placed.layout.points[current.index];
        p.fx = x;
        p.fy = y;
        placed.layout.reheat(0.25);
        schedule();
      } else {
        viewRef.current = { ...viewRef.current, x: current.viewX + dx, y: current.viewY + dy };
        draw();
      }
      return;
    }
    const index = hit(x, y);
    const id = layoutRef.current?.nodes[index]?.id ?? null;
    canvas.style.cursor = id ? 'pointer' : 'grab';
    if (id !== hoverRef.current) {
      hoverRef.current = id;
      draw();
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current) return;
    const placed = layoutRef.current;
    const point = placed?.layout.points[current.index];
    if (point) {
      point.fx = null;
      point.fy = null;
    }
    if (current.moved) return;
    // A click selects a node; a click on the background clears the selection.
    setSelected(placed?.nodes[current.index]?.id ?? null);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toWorld(event.clientX, event.clientY);
    const node = layoutRef.current?.nodes[hit(x, y)];
    if (node) router.push(node.href);
  };

  const onPointerLeave = () => {
    if (hoverRef.current) {
      hoverRef.current = null;
      draw();
    }
  };

  /** Select a node and centre the view on it. */
  const focusNode = (id: string) => {
    setSelected(id);
    const placed = layoutRef.current;
    const p = placed?.layout.points[placed.index.get(id) ?? -1];
    if (!p) return;
    const { width, height } = sizeRef.current;
    const scale = Math.max(viewRef.current.scale, LABEL_SCALE);
    autoFitRef.current = false;
    viewRef.current = { scale, x: width / 2 - p.x * scale, y: height / 2 - p.y * scale };
    draw();
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && found[0]) {
      event.preventDefault();
      focusNode(found[0].id);
    } else if (event.key === 'Escape') {
      setQuery('');
    }
  };

  const toggle = (group: GraphGroup) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const current = selected ? byId.get(selected) : undefined;
  const linked = current
    ? [...(neighbours.get(current.id) ?? [])]
        .map((id) => byId.get(id))
        .filter((n): n is GraphNode => n !== undefined)
        .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label))
    : [];
  const groupLabel = (group: GraphGroup) =>
    GRAPH_GROUPS.find((g) => g.group === group)?.label ?? group;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="Highlight nodes"
          placeholder="Highlight by ID, title or path"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          className="h-7 w-full sm:w-64"
        />
        {needle ? (
          <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {found.length} {found.length === 1 ? 'match' : 'matches'}
            {found.length ? ' · Enter selects the first' : ''}
          </span>
        ) : null}
        <ul className="flex flex-wrap gap-1.5 sm:ml-auto" aria-label="Node groups">
          {present.map((g) => {
            const on = !hidden.has(g.group);
            return (
              <li key={g.group}>
                <Button
                  size="xs"
                  variant="outline"
                  aria-pressed={on}
                  onClick={() => toggle(g.group)}
                  className={cn(
                    on ? 'border-brand/60 text-foreground' : 'text-muted-foreground line-through',
                  )}
                >
                  {g.label}
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {g.count}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div
          ref={containerRef}
          className="relative h-[min(72svh,760px)] min-h-[420px] overflow-hidden rounded-lg border bg-background"
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Specification graph: ${visible.nodes.length} nodes and ${visible.edges.length} links. Use the highlight field to find and select a node.`}
            className="block touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            onDoubleClick={onDoubleClick}
          />
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <Button size="icon-sm" variant="outline" aria-label="Zoom in" onClick={() => zoom(1.3)}>
              <Plus />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Zoom out"
              onClick={() => zoom(1 / 1.3)}
            >
              <Minus />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Fit graph"
              onClick={() => {
                fit();
                draw();
              }}
            >
              <Maximize />
            </Button>
          </div>
          {visible.nodes.length === 0 ? (
            <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              Every node group is hidden.
            </p>
          ) : null}
          <Legend />
        </div>

        <aside className="flex min-w-0 flex-col gap-3 text-sm" aria-label="Selected node">
          {current ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {groupLabel(current.group).replace(/s$/, '')}
                </p>
                <h2 className="font-medium leading-snug">{current.title}</h2>
                {current.label !== current.title ? (
                  <p className="font-mono text-xs text-muted-foreground">{current.label}</p>
                ) : null}
                {current.path ? (
                  <p className="font-mono text-[11px] break-all text-muted-foreground">
                    {current.path}
                  </p>
                ) : current.group === 'interaction' ? (
                  <p className="text-xs text-muted-foreground">No spec document yet.</p>
                ) : null}
                {current.errors ? (
                  <p className="text-xs text-destructive">
                    {current.errors} structural {current.errors === 1 ? 'error' : 'errors'}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" render={<Link href={current.href} />} nativeButton={false}>
                  Open
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  Clear
                </Button>
              </div>
              <section className="flex min-h-0 flex-col gap-1.5">
                <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Connected ({linked.length})
                </h3>
                {linked.length ? (
                  <ul className="flex max-h-[50svh] flex-col gap-1 overflow-y-auto text-[13px]">
                    {linked.map((n) => (
                      <li key={n.id} className="flex min-w-0 items-baseline gap-2">
                        <button
                          type="button"
                          onClick={() => focusNode(n.id)}
                          className="min-w-0 truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
                          title={n.path ?? n.title}
                        >
                          {n.group === 'interaction' || n.group === 'feature' ? (
                            <span className="font-mono text-xs">{n.label}</span>
                          ) : (
                            n.title
                          )}
                        </button>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {groupLabel(n.group).replace(/s$/, '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No links among the visible groups.
                  </p>
                )}
              </section>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select a node to list its connections; double-click opens it. Drag to move nodes or
              pan, scroll to zoom.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Legend() {
  const item = 'flex items-center gap-1.5';
  return (
    <ul
      aria-label="Legend"
      className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-background/85 px-2 py-1 text-[11px] text-muted-foreground"
    >
      <li className={item}>
        <span className="size-2 rounded-full bg-foreground" /> Interaction
      </li>
      <li className={item}>
        <span className="size-2 rounded-full border border-dashed border-foreground" /> No spec
        document
      </li>
      <li className={item}>
        <span className="size-2 rounded-full bg-muted-foreground" /> Document
      </li>
      <li className={item}>
        <span className="size-2.5 rounded-full border-[1.5px] border-foreground" /> Feature or
        category
      </li>
      <li className={item}>
        <span className="size-2 rounded-full border-2 border-destructive" /> Errors
      </li>
      <li className={item}>
        <span className="h-px w-3 bg-muted-foreground" /> Link
      </li>
      <li className={item}>
        <span className="h-px w-3 border-t border-dashed border-muted-foreground" /> Membership
      </li>
    </ul>
  );
}
