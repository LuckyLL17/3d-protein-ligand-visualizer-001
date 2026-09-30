import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' });
try { await vite.ssrLoadModule('/scripts/check-file.ts'); }
catch (e) { console.error(e); process.exitCode = 1; }
finally { await vite.close(); }
