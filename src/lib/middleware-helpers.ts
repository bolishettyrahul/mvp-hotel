import { NextRequest } from 'next/server';
import { verifyToken, type TokenPayload } from './auth';
import { unauthorized, forbidden } from './api-response';

// ─── Auth Middleware Helpers ─────────────────────────────────────────────────

export async function getStaffFromRequest(
  request: NextRequest
): Promise<TokenPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    // Try cookie fallback
    const token = request.cookies.get('auth-token')?.value;
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
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
