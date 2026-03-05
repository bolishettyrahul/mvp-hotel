import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { toggleAvailabilitySchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { error } = await requireAuth(request, ['ADMIN', 'KITCHEN']);
    if (error) return error;

    const body = await request.json();
    const parsed = toggleAvailabilitySchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const item = await prisma.menuItem.findUnique({
      where: { id: params.itemId, isActive: true },
    });

    if (!item) {
      return notFound('Menu item not found');
    }

    const updated = await prisma.menuItem.update({
      where: { id: params.itemId },
      data: { isAvailable: parsed.data.isAvailable },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Toggle availability error:', error);
    return internalError();
  }
}
