import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayOrders,
      todayRevenue,
      pendingPayments,
      activeOrders,
      paymentBreakdown,
      occupiedTables,
      totalTables,
    ] = await Promise.all([
      // Today's order count
      prisma.order.count({
        where: { createdAt: { gte: today } },
      }),
      // Today's revenue (completed payments)
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: today },
        },
        _sum: { amount: true },
      }),
      // Pending payments count
      prisma.payment.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      // Active orders (not completed/cancelled)
      prisma.order.count({
        where: { status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] } },
      }),
      // Payment method breakdown for today
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          status: 'COMPLETED',
          paidAt: { gte: today },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Occupied tables
      prisma.table.count({
        where: { status: 'OCCUPIED', isActive: true },
      }),
      // Total active tables
      prisma.table.count({
        where: { isActive: true },
      }),
    ]);

    return successResponse({
      todayOrders,
      todayRevenue: todayRevenue._sum.amount || 0,
      pendingPayments,
      activeOrders,
      occupiedTables,
      totalTables,
      paymentBreakdown: paymentBreakdown.map(pb => ({
        method: pb.method,
        total: pb._sum.amount || 0,
        count: pb._count,
      })),
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return internalError();
  }
}
