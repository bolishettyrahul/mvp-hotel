import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, notFound, internalError, unauthorized } from '@/lib/api-response';
import { getSessionId, getStaffFromRequest } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        items: {
          include: {
            menuItem: { select: { imageUrl: true, isVeg: true } },
          },
        },
        table: { select: { number: true, label: true } },
        payment: true,
        statusLogs: {
          orderBy: { createdAt: 'asc' },
          include: {
            staff: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      return notFound('Order not found');
    }

    // Allow access if session owner or authenticated staff
    const requestSessionId = getSessionId(request);
    const staff = await getStaffFromRequest(request);
    if (!staff && (!requestSessionId || requestSessionId !== order.sessionId)) {
      return unauthorized('Access denied');
    }

    return successResponse(order);
  } catch (error) {
    console.error('Get order error:', error);
    return internalError();
  }
}
