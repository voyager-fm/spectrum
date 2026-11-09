import { createServer } from 'node:http';
import { checkRepository } from '../../../packages/spec-engine/src/index.ts';
const root = process.cwd();
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const server = createServer(async (req,res) => {
  if (req.method !== 'GET') { res.writeHead(405); res.end('Read-only scaffold'); return; }
  if (!['/','/api/specs'].includes(req.url ?? '')) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const result = await checkRepository(root);
    res.setHeader('Cache-Control','no-store');
    if (req.url === '/api/specs') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(result)); return; }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spectrum</title><style>body{font:16px system-ui;background:#11131a;color:#e6e7f0;max-width:1000px;margin:64px auto;padding:24px}h1{font-size:40px}small{color:#aeb3c9}article{padding:24px;border:1px solid #363a4c;border-radius:12px;margin:16px 0}.badge{color:#bba9ff}li{margin:10px 0}</style><h1>Spectrum</h1><p>Repository-native product specs.</p><small>Local scaffold · read-only · no GitHub, Linear or AI connection</small><h2>Self-specification</h2><p>Validation: ${result.ok ? 'passed' : 'failed'} · ${result.specs.length} specs</p>${result.specs.map(s=>`<article><span class="badge">${escape(s.id)} · ${escape(s.status)}</span><h2>${escape(s.title)}</h2><ul>${s.acceptance.map(a=>`<li>${escape(a)}</li>`).join('')}</ul><small>${escape(s.path)}</small></article>`).join('')}<h2>Findings</h2><pre>${escape(JSON.stringify(result.findings,null,2))}</pre></html>`);
  } catch (e) { res.writeHead(500); res.end('Unable to load repository specs'); console.error(e); }
});
server.listen(Number(process.env.PORT ?? 3000),'127.0.0.1',()=>console.log('Spectrum local dashboard: http://127.0.0.1:' + (process.env.PORT ?? 3000)));
