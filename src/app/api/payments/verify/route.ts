import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPaymentSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError, errorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export async function POST(request: NextRequest) {
  try {
    // Only authenticated staff can verify payments
    const { error } = await requireAuth(request, ['ADMIN', 'KITCHEN']);
    if (error) return error;

    const body = await request.json();
    const parsed = verifyPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const { paymentId, transactionId } = parsed.data;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      return notFound('Payment not found');
    }

    if (payment.status === 'COMPLETED') {
      return successResponse(payment);
    }

    if (payment.status === 'FAILED' || payment.status === 'REFUNDED') {
      return errorResponse('VALIDATION_ERROR', 'Payment cannot be verified in current state', 400);
    }

    // For UPI payments, verify transaction (placeholder for real UPI verification)
    // For CASH/PAY_AT_COUNTER, this is admin confirming receipt

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        transactionId: transactionId || null,
        paidAt: new Date(),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Verify payment error:', error);
    return internalError();
  }
}
