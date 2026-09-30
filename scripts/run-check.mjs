import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  logLevel: 'error',
  appType: 'custom',
});
try {
  await vite.ssrLoadModule('/scripts/check-importer.ts');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await vite.close();
}
