import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { createSessionSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError, errorResponse } from '@/lib/api-response';
import { checkRateLimit, getClientIP } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(`session-create:${ip}`, 5, 60000)) {
      return errorResponse('RATE_LIMITED', 'Too many session requests. Try again in 1 minute.', 429);
    }

    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const { tableId, guestCount } = parsed.data;

    // Validate table exists and is active
    const table = await prisma.table.findUnique({
      where: { id: tableId, isActive: true },
    });

    if (!table) {
      return notFound('Table not found. Please scan the QR code again.');
    }

    if (table.status === 'DISABLED') {
      return errorResponse('VALIDATION_ERROR', 'This table is currently disabled.', 400);
    }

    // Attempt to atomically claim the table if it is AVAILABLE
    const claimedTable = await prisma.table.updateMany({
      where: { id: tableId, status: 'AVAILABLE', isActive: true },
      data: { status: 'OCCUPIED' },
    });

    // If count === 0, the table was already occupied (or disabled right after our check).
    // This atomic check eliminates the race condition where concurrent requests could both create sessions.
    if (claimedTable.count === 0) {
      // Try to find the existing active session to join it
      const existingSession = await prisma.session.findFirst({
        where: { tableId, status: 'ACTIVE' },
      });

      if (!existingSession) {
        // Stale state: table is OCCUPIED/RESERVED but has no active session.
        // This can happen when a session expires but the table status wasn't reset.
        // Auto-recover by resetting the table to AVAILABLE and claiming it.
        if (table.status === 'OCCUPIED' || table.status === 'RESERVED') {
          const reclaimedTable = await prisma.table.updateMany({
            where: { id: tableId, isActive: true },
            data: { status: 'OCCUPIED' },
          });

          if (reclaimedTable.count > 0) {
            // Fall through to create a new session below
          } else {
            return errorResponse('VALIDATION_ERROR', 'Table is currently unavailable.', 400);
          }
        } else {
          return errorResponse('VALIDATION_ERROR', 'Table is currently unavailable.', 400);
        }
      } else {
        // Return existing session (same party scenario)
        const response = successResponse(existingSession);
        response.cookies.set('session-id', existingSession.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 4 * 60 * 60,
          path: '/',
        });
        return response;
      }
    }

    // We successfully claimed the table. Now exclusively create the session.
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4);

    const session = await prisma.session.create({
      data: {
        tableId,
        guestCount,
        expiresAt,
      },
    });

    const response = successResponse(session, 201);

    // Set session cookie
    response.cookies.set('session-id', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 4 * 60 * 60, // 4 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Create session error:', error);
    return internalError();
  }
}
