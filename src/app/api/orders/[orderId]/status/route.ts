import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { updateOrderStatusSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError, errorResponse } from '@/lib/api-response';
import { ORDER_STATUS_FLOW } from '@/lib/utils';
import { requireAuth } from '@/lib/middleware-helpers';

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

      return updatedOrder;
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update order status error:', error);
    return internalError();
  }
}
