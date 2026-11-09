/**
 * A small force-directed layout for the specification graph: springs along edges, pairwise
 * repulsion and a weak pull to the origin, cooled by an alpha schedule. It is deterministic for
 * the same input, runs in the browser without dependencies and is exact (no Barnes–Hut
 * approximation), which keeps graphs of a few hundred nodes interactive.
 */

export interface LayoutPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pinned position while the node is dragged; null when free. */
  fx: number | null;
  fy: number | null;
}

export interface LayoutOptions {
  /** Rest length of an edge. */
  linkDistance: number;
  /** Repulsion between every pair of nodes. */
  charge: number;
  /** Pairs farther apart than this do not repel. */
  chargeDistance: number;
  /** Pull toward the origin, which keeps disconnected nodes in view. */
  gravity: number;
  /** Fraction of velocity kept after each tick. */
  friction: number;
  /** Alpha below which the layout is considered settled. */
  alphaMin: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  linkDistance: 52,
  charge: 360,
  chargeDistance: 520,
  gravity: 0.06,
  friction: 0.6,
  alphaMin: 0.002,
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
// Reaches alphaMin from 1 in about 300 ticks.
const ALPHA_DECAY = 1 - 0.002 ** (1 / 300);

export class ForceLayout {
  readonly points: LayoutPoint[];
  alpha = 1;
  private readonly edges: [number, number][];
  private readonly degree: number[];
  private readonly options: LayoutOptions;

  constructor(count: number, edges: [number, number][], options: Partial<LayoutOptions> = {}) {
    this.options = { ...DEFAULT_LAYOUT, ...options };
    this.edges = edges.filter(([a, b]) => a !== b && a >= 0 && b >= 0 && a < count && b < count);
    this.degree = Array.from({ length: count }, () => 0);
    for (const [a, b] of this.edges) {
      this.degree[a]++;
      this.degree[b]++;
    }
    // Phyllotaxis start: evenly spread, deterministic and without overlapping points.
    this.points = Array.from({ length: count }, (_, i) => {
      const r = 12 * Math.sqrt(0.5 + i);
      const angle = i * GOLDEN;
      return { x: r * Math.cos(angle), y: r * Math.sin(angle), vx: 0, vy: 0, fx: null, fy: null };
    });
  }

  get settled(): boolean {
    return this.alpha < this.options.alphaMin;
  }

  /** Raise alpha so the layout moves again, for example while a node is dragged. */
  reheat(alpha = 0.3): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  /** Advance one step. Returns false once the layout has settled. */
  tick(): boolean {
    if (this.settled) return false;
    const { linkDistance, charge, chargeDistance, gravity, friction } = this.options;
    const alpha = this.alpha;
    const p = this.points;

    for (const [a, b] of this.edges) {
      const s = p[a];
      const t = p[b];
      let dx = t.x + t.vx - s.x - s.vx;
      let dy = t.y + t.vy - s.y - s.vy;
      const length = Math.hypot(dx, dy) || 1e-6;
      // Springs on hubs are softer, so a feature with many interactions does not collapse.
      const strength = 1 / Math.min(this.degree[a], this.degree[b]);
      const k = ((length - linkDistance) / length) * alpha * strength;
      dx *= k;
      dy *= k;
      const bias = this.degree[a] / (this.degree[a] + this.degree[b]);
      t.vx -= dx * bias;
      t.vy -= dy * bias;
      s.vx += dx * (1 - bias);
      s.vy += dy * (1 - bias);
    }

    const max2 = chargeDistance * chargeDistance;
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      for (let j = i + 1; j < p.length; j++) {
        const b = p[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 > max2) continue;
        if (d2 === 0) {
          // Coincident points: separate them along a fixed direction.
          dx = 1e-3 * (j - i);
          dy = 1e-3;
          d2 = dx * dx + dy * dy;
        }
        const f = (charge * alpha) / Math.max(d2, 25);
        a.vx -= dx * f;
        a.vy -= dy * f;
        b.vx += dx * f;
        b.vy += dy * f;
      }
    }

    for (const point of p) {
      point.vx -= point.x * gravity * alpha;
      point.vy -= point.y * gravity * alpha;
      if (point.fx !== null && point.fy !== null) {
        point.x = point.fx;
        point.y = point.fy;
        point.vx = 0;
        point.vy = 0;
        continue;
      }
      point.vx *= friction;
      point.vy *= friction;
      point.x += point.vx;
      point.y += point.vy;
    }

    this.alpha += (0 - this.alpha) * ALPHA_DECAY;
    return true;
  }

  /** Run ticks until settled or the budget is spent; returns the ticks run. */
  run(maxTicks = 400): number {
    let n = 0;
    while (n < maxTicks && this.tick()) n++;
    return n;
  }
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(points: Pick<LayoutPoint, 'x' | 'y'>[]): Bounds {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

export interface View {
  x: number;
  y: number;
  scale: number;
}

/** The view that fits the bounds into a viewport with padding, capped at scale 2. */
export function fitView(b: Bounds, width: number, height: number, padding = 40): View {
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const scale = Math.min(
    2,
    Math.max(0.05, Math.min((width - padding * 2) / w, (height - padding * 2) / h)),
  );
  return {
    scale,
    x: width / 2 - ((b.minX + b.maxX) / 2) * scale,
    y: height / 2 - ((b.minY + b.maxY) / 2) * scale,
  };
}
