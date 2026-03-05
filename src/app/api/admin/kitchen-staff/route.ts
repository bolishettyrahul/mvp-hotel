import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createKitchenStaffSchema } from '@/lib/validations';
import { successResponse, validationError, conflict, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const staff = await prisma.staff.findMany({
      where: { role: 'KITCHEN' },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose hashed PINs — return masked value
    const safeStaff = staff.map(s => ({ ...s, pin: '****' }));
    return successResponse(safeStaff);
  } catch (error) {
    console.error('List kitchen staff error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const body = await request.json();
    const parsed = createKitchenStaffSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    // Use transaction to prevent race condition on PIN uniqueness
    const result = await prisma.$transaction(async (tx) => {
      // Check if PIN already used (must iterate since PINs are hashed)
      const existingStaff = await tx.staff.findMany({
        where: { role: 'KITCHEN', isActive: true },
        select: { pin: true },
      });

      for (const s of existingStaff) {
        if (s.pin && await bcrypt.compare(parsed.data.pin, s.pin)) {
          return { duplicate: true as const };
        }
      }

      const hashedPin = await bcrypt.hash(parsed.data.pin, 10);

      const staff = await tx.staff.create({
        data: {
          name: parsed.data.name,
          pin: hashedPin,
          role: 'KITCHEN',
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });

      return { duplicate: false as const, staff };
    });

    if (result.duplicate) {
      return conflict('This PIN is already in use');
    }

    return successResponse(result.staff, 201);
  } catch (error) {
    console.error('Create kitchen staff error:', error);
    return internalError();
  }
}
