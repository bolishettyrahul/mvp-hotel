import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { updateOrderStatusSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError, errorResponse } from '@/lib/api-response';
import { ORDER_STATUS_FLOW } from '@/lib/utils';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    // Only authenticated staff can update order status
    const { error, staff } = await requireAuth(request, ['ADMIN', 'KITCHEN']);
    if (error) return error;

    const body = await request.json();
    const parsed = updateOrderStatusSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const { status: newStatus, note } = parsed.data;
    const staffId = staff!.staffId;

    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
    });

    if (!order) {
      return notFound('Order not found');
    }

    // Validate status transition
    const allowedTransitions = ORDER_STATUS_FLOW[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Cannot move from ${order.status} to ${newStatus}`,
        400
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id: params.orderId },
        data: { status: newStatus },
        include: {
          items: true,
          table: { select: { number: true } },
          payment: true,
        },
      });

      // Log status change
      await tx.orderStatusLog.create({
        data: {
          orderId: params.orderId,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: staffId,
          note,
        },
      });

      // When order is COMPLETED, auto-complete CASH/PAY_AT_COUNTER payments
      if (newStatus === 'COMPLETED' && updatedOrder.payment) {
        const pmt = updatedOrder.payment;
        if (
          (pmt.method === 'CASH' || pmt.method === 'PAY_AT_COUNTER') &&
          pmt.status !== 'COMPLETED'
        ) {
          await tx.payment.update({
            where: { id: pmt.id },
            data: { status: 'COMPLETED', paidAt: new Date() },
          });
        }
      }

      // When order is COMPLETED or CANCELLED, check if all session orders are done
      if ((newStatus === 'COMPLETED' || newStatus === 'CANCELLED') && order.sessionId) {
        const pendingOrders = await tx.order.count({
          where: {
            sessionId: order.sessionId,
            id: { not: params.orderId },
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        });

        if (pendingOrders === 0) {
          // All orders done — complete session and free table
          const session = await tx.session.update({
            where: { id: order.sessionId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
          await tx.table.update({
            where: { id: session.tableId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      return updatedOrder;
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update order status error:', error);
    return internalError();
  }
}
