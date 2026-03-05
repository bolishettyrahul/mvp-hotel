import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { createCategorySchema } from '@/lib/validations';
import { successResponse, validationError, conflict, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { menuItems: { where: { isActive: true } } } },
      },
    });

    return successResponse(categories);
  } catch (error) {
    console.error('List categories error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const existing = await prisma.category.findUnique({
      where: { name: parsed.data.name },
    });

    if (existing) {
      return conflict(`Category "${parsed.data.name}" already exists`);
    }

    const category = await prisma.category.create({
      data: parsed.data,
    });

    return successResponse(category, 201);
  } catch (error) {
    console.error('Create category error:', error);
    return internalError();
  }
}
