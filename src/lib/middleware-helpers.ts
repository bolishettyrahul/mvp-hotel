import { NextRequest } from 'next/server';
import { verifyToken, type TokenPayload } from './auth';
import { unauthorized, forbidden } from './api-response';

// ─── Auth Middleware Helpers ─────────────────────────────────────────────────

export async function getStaffFromRequest(
  request: NextRequest
): Promise<TokenPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    // Try cookie fallback — check both admin and kitchen cookies
    const token =
      request.cookies.get('auth-token')?.value ||
      request.cookies.get('kitchen-auth-token')?.value;
    if (!token) return null;
    return verifyToken(token);
  }

  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}

export async function requireAuth(
  request: NextRequest,
  allowedRoles?: ('ADMIN' | 'KITCHEN')[]
) {
  const staff = await getStaffFromRequest(request);

  if (!staff) {
    return { error: unauthorized(), staff: null };
  }

  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    return { error: forbidden(), staff: null };
  }

  return { error: null, staff };
}

// ─── Session Validation ─────────────────────────────────────────────────────

export function getSessionId(request: NextRequest): string | null {
  // Check header first, then cookie
  const sessionId = request.headers.get('x-session-id');
  if (sessionId) return sessionId;

  return request.cookies.get('session-id')?.value || null;
}

// ─── Rate Limiting (Simple in-memory) ──────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();

  // On-demand cleanup instead of setInterval (serverless-safe)
  if (now - lastCleanup > 60000) {
    lastCleanup = now;
    rateLimitMap.forEach((entry, k) => {
      if (now > entry.resetAt) {
        rateLimitMap.delete(k);
      }
    });
  }

  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// ─── IP Extraction ──────────────────────────────────────────────────────────

export function getClientIP(request: NextRequest): string {
  // In production behind a reverse proxy, use the IP the proxy sets.
  // Take the first IP from x-forwarded-for (client IP set by the nearest proxy).
  // Note: In production, configure your reverse proxy to overwrite (not append to)
  // x-forwarded-for to prevent client spoofing.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // Use the first entry (set by the trusted reverse proxy closest to the client)
    const clientIp = xff.split(',')[0]?.trim();
    if (clientIp) return clientIp;
  }

  return request.headers.get('x-real-ip') || request.ip || '127.0.0.1';
}

// ─── Progressive Lockout (for login endpoints) ─────────────────────────────

const lockoutMap = new Map<string, { failures: number; lockedUntil: number }>();

/**
 * Check if a login attempt is allowed under progressive lockout.
 * After 5 failures: 60s lockout. After 10: 5min. After 15: 30min.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
export function checkLoginLockout(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = lockoutMap.get(key);

  if (!entry) return { allowed: true };

  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  return { allowed: true };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = lockoutMap.get(key) || { failures: 0, lockedUntil: 0 };
  entry.failures += 1;

  // Progressive lockout durations
  if (entry.failures >= 15) {
    entry.lockedUntil = now + 30 * 60 * 1000; // 30 minutes
  } else if (entry.failures >= 10) {
    entry.lockedUntil = now + 5 * 60 * 1000;  // 5 minutes
  } else if (entry.failures >= 5) {
    entry.lockedUntil = now + 60 * 1000;       // 60 seconds
  }

  lockoutMap.set(key, entry);
}

export function clearLoginLockout(key: string): void {
  lockoutMap.delete(key);
}
