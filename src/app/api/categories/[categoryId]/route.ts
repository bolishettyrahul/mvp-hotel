import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { updateCategorySchema } from '@/lib/validations';
import { successResponse, validationError, notFound, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const category = await prisma.category.findUnique({
      where: { id: params.categoryId },
    });

    if (!category) {
      return notFound('Category not found');
    }

    const updated = await prisma.category.update({
      where: { id: params.categoryId },
      data: parsed.data,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('Update category error:', error);
    return internalError();
  }
}
