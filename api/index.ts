import type { IncomingMessage, ServerResponse } from 'node:http';
import { createExpressApp } from '../server/app.ts';

const app = createExpressApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req as unknown as import('express').Request, res as unknown as import('express').Response);
}
