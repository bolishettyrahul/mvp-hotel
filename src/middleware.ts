import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Routes that require staff authentication
const PROTECTED_PATTERNS = [
  { pattern: /^\/api\/admin/, roles: ['ADMIN'] },
  { pattern: /^\/api\/tables(?!\/)/, roles: ['ADMIN'] },
  { pattern: /^\/api\/tables\/[^/]+$/, roles: ['ADMIN'] },
  { pattern: /^\/api\/tables\/[^/]+\/qr$/, roles: ['ADMIN'] },
  { pattern: /^\/api\/categories$/, methods: ['POST'], roles: ['ADMIN'] },
  { pattern: /^\/api\/categories\/[^/]+$/, methods: ['PATCH', 'DELETE'], roles: ['ADMIN'] },
  { pattern: /^\/api\/menu$/, methods: ['POST'], roles: ['ADMIN'] },
  { pattern: /^\/api\/menu\/[^/]+$/, methods: ['PATCH', 'DELETE'], roles: ['ADMIN'] },
  { pattern: /^\/api\/menu\/[^/]+\/availability$/, methods: ['PATCH'], roles: ['ADMIN', 'KITCHEN'] },
  { pattern: /^\/api\/orders$/, methods: ['GET'], roles: ['ADMIN', 'KITCHEN'] },
  { pattern: /^\/api\/orders\/[^/]+\/status$/, methods: ['PATCH'], roles: ['ADMIN', 'KITCHEN'] },
  { pattern: /^\/api\/sessions\/[^/]+$/, methods: ['PATCH'], roles: ['ADMIN'] },
];

// Public API routes (no auth needed)
const PUBLIC_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/health$/,
  /^\/api\/menu$/,           // GET menu is public
  /^\/api\/menu\/[^/]+$/,    // GET single menu item is public
  /^\/api\/categories$/,     // GET categories is public
  /^\/api\/sessions$/,       // POST create session
  /^\/api\/sessions\/[^/]+\/validate$/,
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // CORS: Set headers on all API responses
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Check if it's a public route
  const isPublic = PUBLIC_PATTERNS.some(pattern => pattern.test(pathname));
  if (isPublic && method === 'GET') {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/auth/') || pathname === '/api/health') {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/sessions') && method === 'POST') {
    return NextResponse.next();
  }
  if (pathname.match(/^\/api\/sessions\/[^/]+\/validate$/) && method === 'GET') {
    return NextResponse.next();
  }

  // Check for order placement (session-based, not staff auth)
  if (pathname === '/api/orders' && method === 'POST') {
    return NextResponse.next(); // Session validation done in the route handler
  }

  // Check for payment routes (session-based)
  if (pathname.startsWith('/api/payments/') && ['POST', 'GET'].includes(method)) {
    return NextResponse.next(); // Session validation done in the route handler
  }

  // Get individual order (session-based access check inside handler)
  if (/^\/api\/orders\/[^/]+$/.test(pathname) && method === 'GET') {
    return NextResponse.next();
  }

  // Get session details (session owner or staff - verified in handler)
  if (/^\/api\/sessions\/[^/]+$/.test(pathname) && method === 'GET') {
    return NextResponse.next();
  }

  // Check protected routes
  for (const route of PROTECTED_PATTERNS) {
    if (route.pattern.test(pathname)) {
      if (route.methods && !route.methods.includes(method)) {
        continue;
      }

      // Extract token — check Authorization header first, then cookies
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : (request.cookies.get('auth-token')?.value || request.cookies.get('kitchen-auth-token')?.value);

      if (!token) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }

      const payload = await verifyToken(token);
      if (!payload) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
          { status: 401 }
        );
      }

      if (route.roles && !route.roles.includes(payload.role)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 }
        );
      }

      // Attach staff info to headers for downstream use
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-staff-id', payload.staffId);
      requestHeaders.set('x-staff-role', payload.role);
      requestHeaders.set('x-staff-name', payload.name);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  }

  // Default deny: reject any API route not explicitly allowed above
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Unknown API route' } },
    { status: 404 }
  );
}

export const config = {
  matcher: ['/api/:path*'],
};
