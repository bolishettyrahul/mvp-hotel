import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { updateSessionSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError } from '@/lib/api-response';
import { requireAuth, getSessionId } from '@/lib/middleware-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }

) {
  try {
    // Allow access if the requester owns this session (cookie) or is authenticated staff
    const requestSessionId = getSessionId(request);
    const isOwner = requestSessionId === params.sessionId;

    if (!isOwner) {
      const { error } = await requireAuth(request, ['ADMIN', 'KITCHEN']);
      if (error) return error;
    }

    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      include: {
        table: { select: { id: true, number: true, label: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            payment: true,
          },
        },
      },
    });

    if (!session) {
      return notFound('Session not found');
    }

    return successResponse(session);
  } catch (error) {
    console.error('Get session error:', error);
    return internalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Only admin can update sessions (close, expire, cancel)
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = updateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      return notFound('Session not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.session.update({
        where: { id: params.sessionId },
        data: {
          status: parsed.data.status,
          completedAt: ['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(parsed.data.status)
            ? new Date()
            : undefined,
        },
      });

      // If session is ending, free up the table
      if (['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(parsed.data.status)) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return updatedSession;
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update session error:', error);
    return internalError();
  }
}
