import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { kitchenLoginSchema } from '@/lib/validations';
import { successResponse, validationError, unauthorized, rateLimited, internalError } from '@/lib/api-response';
import { checkRateLimit, getClientIP, checkLoginLockout, recordLoginFailure, clearLoginLockout } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(`kitchen-login:${ip}`, 5, 60000)) {
      return rateLimited('Too many login attempts. Try again in 1 minute.');
    }

    // Progressive lockout check
    const lockoutKey = `kitchen-lockout:${ip}`;
    const lockout = checkLoginLockout(lockoutKey);
    if (!lockout.allowed) {
      return rateLimited(`Account locked. Try again in ${lockout.retryAfterSeconds} seconds.`);
    }

    const body = await request.json();
    const parsed = kitchenLoginSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const { pin } = parsed.data;

    // Fetch all active kitchen staff and compare PIN hashes
    const kitchenStaff = await prisma.staff.findMany({
      where: { role: 'KITCHEN', isActive: true },
    });

    let matchedStaff = null;
    for (const s of kitchenStaff) {
      if (s.pin && await bcrypt.compare(pin, s.pin)) {
        matchedStaff = s;
        break;
      }
    }

    if (!matchedStaff) {
      recordLoginFailure(lockoutKey);
      return unauthorized('Invalid PIN');
    }

    clearLoginLockout(lockoutKey);

    const token = await signToken({
      staffId: matchedStaff.id,
      role: 'KITCHEN',
      name: matchedStaff.name,
    });

    const response = successResponse({
      token,
      staff: { id: matchedStaff.id, name: matchedStaff.name, role: matchedStaff.role },
    });

    response.cookies.set('kitchen-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Kitchen login error:', error);
    return internalError();
  }
}
