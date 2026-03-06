import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET environment variable is required. Set it in your .env file or Vercel dashboard.');
    return null;
  }
  return new TextEncoder().encode(secret);
}

export interface TokenPayload extends JWTPayload {
  staffId: string;
  role: 'ADMIN' | 'KITCHEN';
  name: string;
}

export async function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
