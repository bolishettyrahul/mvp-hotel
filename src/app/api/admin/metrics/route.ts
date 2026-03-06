import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    // Clean up stale tables: OCCUPIED but no active non-expired session
    const now = new Date();
    const staleTables = await prisma.table.findMany({
      where: {
        status: 'OCCUPIED',
        isActive: true,
        sessions: {
          none: {
            status: 'ACTIVE',
            expiresAt: { gt: now },
          },
        },
      },
      select: { id: true },
    });

    if (staleTables.length > 0) {
      const staleIds = staleTables.map(t => t.id);
      await prisma.$transaction([
        prisma.table.updateMany({
          where: { id: { in: staleIds } },
          data: { status: 'AVAILABLE' },
        }),
        prisma.session.updateMany({
          where: {
            tableId: { in: staleIds },
            status: 'ACTIVE',
            expiresAt: { lte: now },
          },
          data: { status: 'EXPIRED', completedAt: now },
        }),
      ]);
    }

    // Idle session timeout: free tables where all orders are done and session idle >5 min
    const idleCutoff = new Date(now.getTime() - 5 * 60 * 1000);
    const idleSessions = await prisma.session.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: { lte: idleCutoff },
        table: { status: 'OCCUPIED', isActive: true },
        orders: {
          every: {
            status: { in: ['COMPLETED', 'CANCELLED'] },
          },
        },
      },
      select: { id: true, tableId: true },
    });

    if (idleSessions.length > 0) {
      const idleSessionIds = idleSessions.map(s => s.id);
      const idleTableIds = Array.from(new Set(idleSessions.map(s => s.tableId)));
      await prisma.$transaction([
        prisma.session.updateMany({
          where: { id: { in: idleSessionIds } },
          data: { status: 'COMPLETED', completedAt: now },
        }),
        prisma.table.updateMany({
          where: { id: { in: idleTableIds } },
          data: { status: 'AVAILABLE' },
        }),
      ]);
    }

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
