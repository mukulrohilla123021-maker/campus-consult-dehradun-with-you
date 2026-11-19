import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { WRITABLE_DATA_DIR } from './storagePaths.ts';

export type UserRole = 'customer' | 'consultant' | 'admin' | 'super_admin';

export interface SessionPayload {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

const COOKIE_NAME = 'cc_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cachedSecret: string | null = null;

function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  fs.mkdirSync(WRITABLE_DATA_DIR, { recursive: true });
  const secretPath = path.join(WRITABLE_DATA_DIR, '.session_secret');
  if (fs.existsSync(secretPath)) {
    cachedSecret = fs.readFileSync(secretPath, 'utf8').trim();
    return cachedSecret;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  } catch {
    // Fallback to in-memory generated secret if filesystem write fails
  }
  cachedSecret = generated;
  return cachedSecret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = String(storedHash || '').split(':');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    if (!salt || !keyHex) return false;
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export function signSessionToken(userId: string, role: UserRole): string {
  const now = Date.now();
  const payload: SessionPayload = {
    userId,
    role,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.role || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function isHttpsRequest(req?: Request): boolean {
  if (!req) return Boolean(process.env.APP_URL?.startsWith('https://'));
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  return Boolean(
    req.secure ||
      forwardedProto.includes('https') ||
      origin.startsWith('https://')
  );
}

export function setSessionCookie(res: Response, token: string, req?: Request): void {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const https = isHttpsRequest(req);
  const cookieAttrs = https
    ? 'Path=/; HttpOnly; SameSite=None; Secure; Partitioned'
    : 'Path=/; HttpOnly; SameSite=Lax';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttrs}; Max-Age=${maxAgeSec}`
  );
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const https = isHttpsRequest(req);
  const cookieAttrs = https
    ? 'Path=/; HttpOnly; SameSite=None; Secure; Partitioned'
    : 'Path=/; HttpOnly; SameSite=Lax';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieAttrs}; Max-Age=0`);
}

export function extractSessionFromRequest(req: Request): SessionPayload | null {
  // 1. Check Authorization: Bearer <token> (works reliably inside cookie-restricted iframes)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    const parsed = verifySessionToken(bearer);
    if (parsed) return parsed;
  }

  // 2. Check HttpOnly cc_session cookie
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[COOKIE_NAME];
  if (cookieToken) {
    const parsed = verifySessionToken(cookieToken);
    if (parsed) return parsed;
  }

  // 3. Check ?token= query parameter (used for WebSocket /ws upgrades in iframes)
  if (req.url && req.url.includes('token=')) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const qToken = parsedUrl.searchParams.get('token');
      if (qToken) {
        const parsed = verifySessionToken(qToken);
        if (parsed) return parsed;
      }
    } catch {
      // Ignore invalid URL
    }
  }

  return null;
}

// Simple rate limiter for auth endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function authRateLimit(maxRequests = 30, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const existing = rateBuckets.get(key);
    if (!existing || existing.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (existing.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
      return;
    }
    existing.count += 1;
    next();
  };
}
