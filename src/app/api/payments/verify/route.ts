import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPaymentSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError, errorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

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

    const updated = await prisma.$transaction(async (tx) => {
      const pmt = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          transactionId: transactionId || null,
          paidAt: new Date(),
        },
      });

      // If all orders for this session are now paid, complete session & free the table
      if (payment.order?.sessionId) {
        const unpaid = await tx.payment.count({
          where: {
            order: { sessionId: payment.order.sessionId },
            status: { not: 'COMPLETED' },
            id: { not: paymentId },
          },
        });
        if (unpaid === 0) {
          const session = await tx.session.update({
            where: { id: payment.order.sessionId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
          await tx.table.update({
            where: { id: session.tableId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      return pmt;
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Verify payment error:', error);
    return internalError();
  }
}
