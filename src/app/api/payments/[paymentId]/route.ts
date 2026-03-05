import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, notFound, internalError, unauthorized } from '@/lib/api-response';
import { getSessionId, getStaffFromRequest } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        order: {
          select: { id: true, orderNumber: true, totalAmount: true, status: true },
        },
      },
    });

    if (!payment) {
      return notFound('Payment not found');
    }

    // Allow access if session owner or authenticated staff
    const requestSessionId = getSessionId(request);
    const staff = await getStaffFromRequest(request);
    if (!staff && (!requestSessionId || requestSessionId !== payment.sessionId)) {
      return unauthorized('Access denied');
    }

    return successResponse(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    return internalError();
  }
}
