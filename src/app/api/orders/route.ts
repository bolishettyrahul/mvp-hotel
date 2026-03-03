import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { createOrderSchema } from '@/lib/validations';
import {
  successResponse, validationError, notFound, internalError,
  errorResponse, rateLimited
} from '@/lib/api-response';
import { checkRateLimit, requireAuth } from '@/lib/middleware-helpers';
import { sanitizeHtml } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    // Only authenticated staff can list orders
    const { error } = await requireAuth(request, ['ADMIN', 'KITCHEN']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const statuses = searchParams.getAll('status');
    const tableId = searchParams.get('tableId');
    const sessionId = searchParams.get('sessionId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const validStatuses = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    for (const s of statuses) {
      if (!validStatuses.includes(s)) {
        return validationError(`Invalid status "${s}". Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    const where: Record<string, unknown> = {};
    if (statuses.length === 1) where.status = statuses[0];
    else if (statuses.length > 1) where.status = { in: statuses };
    if (tableId) where.tableId = tableId;
    if (sessionId) where.sessionId = sessionId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          table: { select: { number: true, label: true } },
          payment: { select: { status: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return successResponse({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List orders error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const { sessionId, tableId, items, specialNotes, idempotencyKey } = parsed.data;

    // Rate limit per session
    if (!checkRateLimit(`order:${sessionId}`, 3, 60000)) {
      return rateLimited('Too many orders. Please wait a moment.');
    }

    // Check for duplicate order (idempotency)
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
    });

    if (existingOrder) {
      return errorResponse('DUPLICATE_ORDER', 'This order has already been placed', 409);
    }

    // Validate session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'ACTIVE') {
      return errorResponse('SESSION_EXPIRED', 'Session is invalid or expired', 400);
    }

    // Enforce session expiry
    if (new Date() > session.expiresAt) {
      // Mark session as expired
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'EXPIRED', completedAt: new Date() },
      });
      return errorResponse('SESSION_EXPIRED', 'Session has expired. Please scan the QR code again.', 400);
    }

    if (session.tableId !== tableId) {
      return validationError('Table and session do not match');
    }

    // Fetch menu items and validate availability
    const menuItemIds = items.map(i => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isActive: true },
    });

    if (menuItems.length !== menuItemIds.length) {
      return notFound('Some menu items not found');
    }

    const unavailable = menuItems.filter(mi => !mi.isAvailable);
    if (unavailable.length > 0) {
      return validationError(
        'Some items are unavailable',
        unavailable.map(mi => ({ item: mi.name, message: 'Currently unavailable' }))
      );
    }

    // Get restaurant tax rate
    const restaurant = await prisma.restaurant.findFirst();
    const taxPercent = Number(restaurant?.taxPercent || 0);

    // Calculate totals
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]));
    let subtotal = 0;

    const orderItems = items.map(item => {
      const menuItem = menuItemMap.get(item.menuItemId)!;
      const price = Number(menuItem.price);
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price,
        quantity: item.quantity,
        notes: item.notes ? sanitizeHtml(item.notes) : null,
      };
    });

    const taxAmount = Math.round((subtotal * taxPercent) / 100 * 100) / 100;
    const totalAmount = subtotal + taxAmount;

    // Create order with items in a transaction (also handles idempotency atomically)
    const order = await prisma.$transaction(async (tx) => {
      // Re-check idempotency inside the transaction to prevent race condition
      const duplicate = await tx.order.findUnique({
        where: { idempotencyKey },
      });
      if (duplicate) {
        return null; // Signal duplicate
      }

      return tx.order.create({
        data: {
          sessionId,
          tableId,
          idempotencyKey,
          specialNotes: specialNotes ? sanitizeHtml(specialNotes) : null,
          subtotal,
          taxAmount,
          totalAmount,
          items: {
            create: orderItems,
          },
          statusLogs: {
            create: {
              toStatus: 'PLACED',
              note: 'Order placed by customer',
            },
          },
        },
        include: {
          items: true,
          table: { select: { number: true } },
        },
      });
    });

    if (!order) {
      return errorResponse('DUPLICATE_ORDER', 'This order has already been placed', 409);
    }

    return successResponse(order, 201);
  } catch (error) {
    console.error('Create order error:', error);
    return internalError();
  }
}
