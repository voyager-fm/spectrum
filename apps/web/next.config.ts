import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// The dashboard imports shared workspace packages from ../../packages, so the
// monorepo root is the build root. `next` always runs with apps/web as cwd.
const monorepoRoot = resolve(process.cwd(), '../..');

const config: NextConfig = {
  turbopack: { root: monorepoRoot },
  outputFileTracingRoot: monorepoRoot,
  // Dev-only: allow teammates to open the dev server through a private
  // Tailscale Serve URL (tailnet or shared-node access only).
  allowedDevOrigins: ['*.ts.net'],
};

export default config;
