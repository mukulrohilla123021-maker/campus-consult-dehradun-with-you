import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import dotenv from 'dotenv';
import { initDatabase } from './server/db.ts';
import { setupWebSockets } from './server/realtime.ts';
import { registerAuthAndPublicRoutes } from './server/routesAuthAndPublic.ts';
import { registerWorkflowRoutes } from './server/routesWorkflows.ts';
import { registerAdminAndFinanceRoutes } from './server/routesAdminAndFinance.ts';

dotenv.config();

async function startServer() {
  initDatabase();

  const app = express();
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'campus-consult-dehradun', port: 3000 });
  });

  registerAuthAndPublicRoutes(app);
  registerWorkflowRoutes(app);
  registerAdminAndFinanceRoutes(app);

  // API 404 handler so /api/* never falls through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output missing. Run npm run build first.');
      }
    });
  }

  const server = http.createServer(app);
  setupWebSockets(server);

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Campus Consult Dehradun server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
