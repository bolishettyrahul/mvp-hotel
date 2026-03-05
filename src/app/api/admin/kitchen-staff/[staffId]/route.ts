import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, notFound, internalError } from '@/lib/api-response';
import { requireAuth } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const { error } = await requireAuth(request, ['ADMIN']);
    if (error) return error;

    const staff = await prisma.staff.findUnique({
      where: { id: params.staffId, role: 'KITCHEN' },
    });

    if (!staff) {
      return notFound('Staff member not found');
    }

    // Soft deactivate
    await prisma.staff.update({
      where: { id: params.staffId },
      data: { isActive: false },
    });

    return successResponse({ message: 'Staff member deactivated' });
  } catch (error) {
    console.error('Deactivate staff error:', error);
    return internalError();
  }
}
