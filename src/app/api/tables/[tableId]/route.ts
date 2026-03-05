import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { updateTableSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const table = await prisma.table.findUnique({
      where: { id: params.tableId, isActive: true },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: {
            orders: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!table) {
      return notFound('Table not found');
    }

    return successResponse(table);
  } catch (error) {
    console.error('Get table error:', error);
    return internalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = updateTableSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const table = await prisma.table.findUnique({
      where: { id: params.tableId },
    });

    if (!table) {
      return notFound('Table not found');
    }

    const updated = await prisma.table.update({
      where: { id: params.tableId },
      data: parsed.data,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update table error:', error);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { error: authError } = await requireAuth(request, ['ADMIN']);
    if (authError) return authError;

    const table = await prisma.table.findUnique({
      where: { id: params.tableId },
    });

    if (!table) {
      return notFound('Table not found');
    }

    // Soft delete
    await prisma.table.update({
      where: { id: params.tableId },
      data: { isActive: false },
    });

    return successResponse({ message: 'Table deleted' });
  } catch (error) {
    console.error('Delete table error:', error);
    return internalError();
  }
}
