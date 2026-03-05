import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { initiatePaymentSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError, conflict, unauthorized } from '@/lib/api-response';
import { getSessionId } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = initiatePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const { orderId, sessionId, method } = parsed.data;

    // Verify the requester owns this session
    const requestSessionId = getSessionId(request);
    if (!requestSessionId || requestSessionId !== sessionId) {
      return unauthorized('Invalid session. Please scan the QR code again.');
    }

    // Validate order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      return notFound('Order not found');
    }

    if (order.sessionId !== sessionId) {
      return validationError('Order does not belong to this session');
    }

    if (order.status === 'CANCELLED') {
      return validationError('Cannot initiate payment for a cancelled order');
    }

    // Check if payment already exists
    if (order.payment) {
      if (order.payment.status === 'COMPLETED') {
        return conflict('This order has already been paid');
      }
      // Return existing pending payment
      return successResponse(order.payment);
    }

    const payment = await prisma.payment.create({
      data: {
        orderId,
        sessionId,
        method,
        amount: order.totalAmount,
        status: method === 'CASH' || method === 'PAY_AT_COUNTER' ? 'PENDING' : 'PROCESSING',
      },
    });

    return successResponse(payment, 201);
  } catch (error) {
    console.error('Initiate payment error:', error);
    return internalError();
  }
}
