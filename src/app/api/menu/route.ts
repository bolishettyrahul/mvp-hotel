import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { createMenuItemSchema } from '@/lib/validations';
import { successResponse, validationError, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    const menuItems = await prisma.menuItem.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group by category for the public menu
    const grouped = menuItems.reduce((acc, item) => {
      const catName = item.category.name;
      if (!acc[catName]) {
        acc[catName] = {
          categoryId: item.category.id,
          categoryName: catName,
          items: [],
        };
      }
      acc[catName].items.push(item);
      return acc;
    }, {} as Record<string, { categoryId: string; categoryName: string; items: typeof menuItems }>);

    const response = successResponse(Object.values(grouped));
    // Cache for 10 seconds, serve stale content while revalidating for up to 59 seconds
    // This allows the server to handle essentially infinite concurrent users scanning QR codes at once
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=59');

    return response;
  } catch (error) {
    console.error('List menu error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = createMenuItemSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const menuItem = await prisma.menuItem.create({
      data: parsed.data,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return successResponse(menuItem, 201);
  } catch (error) {
    console.error('Create menu item error:', error);
    return internalError();
  }
}
