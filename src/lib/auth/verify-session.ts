import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export type Role = 'patient' | 'worker' | 'district';
export type SessionClaims = JWTPayload & { sub: string; role?: Role; email?: string };

export async function verifySessionCookie(cookie: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(cookie, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ['RS256'],
      clockTolerance: 5,
    });
    if (!payload.sub) return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}
