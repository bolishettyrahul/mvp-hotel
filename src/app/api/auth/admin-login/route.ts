import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { adminLoginSchema } from '@/lib/validations';
import { successResponse, validationError, unauthorized, rateLimited, internalError } from '@/lib/api-response';
import { checkRateLimit, getClientIP } from '@/lib/middleware-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(`admin-login:${ip}`, 5, 60000)) {
      return rateLimited('Too many login attempts. Try again in 1 minute.');
    }

    const body = await request.json();
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return validationError('Invalid input', parsed.error.issues);
    }

    const { email, password } = parsed.data;

    const staff = await prisma.staff.findFirst({
      where: { email, role: 'ADMIN', isActive: true },
    });

    if (!staff || !staff.passwordHash) {
      return unauthorized('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, staff.passwordHash);
    if (!isValid) {
      return unauthorized('Invalid email or password');
    }

    const token = await signToken({
      staffId: staff.id,
      role: 'ADMIN',
      name: staff.name,
    });

    const response = successResponse({
      token,
      staff: { id: staff.id, name: staff.name, role: staff.role },
    });

    // Set httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return internalError();
  }
}
