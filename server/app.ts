import express, { type Express } from 'express';
import dotenv from 'dotenv';
import { initDatabase } from './db.ts';
import { registerAuthAndPublicRoutes } from './routesAuthAndPublic.ts';
import { registerWorkflowRoutes } from './routesWorkflows.ts';
import { registerAdminAndFinanceRoutes } from './routesAdminAndFinance.ts';

dotenv.config();

let cachedApp: Express | null = null;

export function createExpressApp(): Express {
  if (cachedApp) {
    return cachedApp;
  }

  initDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'campus-consult-dehradun',
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
    });
  });

  registerAuthAndPublicRoutes(app);
  registerWorkflowRoutes(app);
  registerAdminAndFinanceRoutes(app);

  // API 404 handler so /api/* never falls through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  cachedApp = app;
  return app;
}
