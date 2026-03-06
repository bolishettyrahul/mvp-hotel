import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

/**
 * Get all sessions for a specific table
 * Used by admin to verify if table has active session before changing status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const sessions = await prisma.session.findMany({
      where: { tableId: params.tableId },
      select: {
        id: true,
        status: true,
        guestCount: true,
        startedAt: true,
        expiresAt: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    return successResponse(sessions);
  } catch (error) {
    console.error('Get table sessions error:', error);
    return internalError();
  }
}
