import type { Server as HttpServer } from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { extractSessionFromRequest } from './auth.ts';
import { db } from './db.ts';

const clientsByUser = new Map<string, Set<WebSocket>>();

export function setupWebSockets(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const urlPath = req.url?.split('?')[0];
    if (urlPath !== '/ws') {
      return;
    }

    const session = extractSessionFromRequest(req as unknown as import('express').Request);
    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, session.userId);
    });
  });

  wss.on('connection', (ws: WebSocket, userId: string) => {
    let set = clientsByUser.get(userId);
    if (!set) {
      set = new Set<WebSocket>();
      clientsByUser.set(userId, set);
    }
    set.add(ws);

    ws.send(JSON.stringify({ type: 'connection:ready', payload: { userId } }));

    ws.on('close', () => {
      const userSockets = clientsByUser.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clientsByUser.delete(userId);
        }
      }
    });
  });
}

export function pushRealtimeEvent(userId: string, type: string, payload: unknown): void {
  const userSockets = clientsByUser.get(userId);
  if (!userSockets) return;
  const serialized = JSON.stringify({ type, payload });
  for (const ws of userSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

export function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  linkTab = 'overview'
): void {
  const id = `ntf-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, link_tab, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, type, title, message, linkTab, createdAt);

  pushRealtimeEvent(userId, 'notification:new', {
    id,
    user_id: userId,
    type,
    title,
    message,
    link_tab: linkTab,
    is_read: 0,
    created_at: createdAt,
  });
}
