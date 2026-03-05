import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { updateMenuItemSchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const item = await prisma.menuItem.findUnique({
      where: { id: params.itemId, isActive: true },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      return notFound('Menu item not found');
    }

    return successResponse(item);
  } catch (error) {
    console.error('Get menu item error:', error);
    return internalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = updateMenuItemSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const item = await prisma.menuItem.findUnique({
      where: { id: params.itemId },
    });

    if (!item) {
      return notFound('Menu item not found');
    }

    const updated = await prisma.menuItem.update({
      where: { id: params.itemId },
      data: parsed.data,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update menu item error:', error);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { error: authError } = await requireAuth(request, ['ADMIN']);
    if (authError) return authError;

    const item = await prisma.menuItem.findUnique({
      where: { id: params.itemId },
    });

    if (!item) {
      return notFound('Menu item not found');
    }

    // Soft delete
    await prisma.menuItem.update({
      where: { id: params.itemId },
      data: { isActive: false },
    });

    return successResponse({ message: 'Menu item deleted' });
  } catch (error) {
    console.error('Delete menu item error:', error);
    return internalError();
  }
}
