import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { createTableSchema } from '@/lib/validations';
import { successResponse, validationError, conflict, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tables = await prisma.table.findMany({
      where: { isActive: true },
      orderBy: { number: 'asc' },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          select: { id: true, guestCount: true, startedAt: true },
        },
      },
    });

    return successResponse(tables);
  } catch (error) {
    console.error('List tables error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = createTableSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const existing = await prisma.table.findUnique({
      where: { number: parsed.data.number },
    });

    if (existing) {
      return conflict(`Table number ${parsed.data.number} already exists`);
    }

    const table = await prisma.table.create({
      data: parsed.data,
    });

    return successResponse(table, 201);
  } catch (error) {
    console.error('Create table error:', error);
    return internalError();
  }
}
