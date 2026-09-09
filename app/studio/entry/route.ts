import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAccessToken } from '@/app/api/access-code/verify/route';

// Uses node:crypto, so it cannot run on the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSO entry point for Flyers Minds.
 *
 * Flyers Minds (POST /api/auth/studio-token) mints a short-lived HS256 JWT signed
 * with the shared STUDIO_JWT_SECRET and redirects the learner here. We verify it
 * and, if it checks out, hand back the same `openmaic_access` cookie the access-code
 * flow issues, so the learner lands in Studio without a second login.
 */

interface StudioClaims {
  user_id?: string;
  email?: string;
  course?: string | null;
  day?: number | null;
  topic?: string | null;
  aud?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/** Verify an HS256 JWT and return its claims, or null if anything is off. */
function verifyStudioToken(token: string, secret: string): StudioClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string };
  let claims: StudioClaims;
  try {
    header = decodeSegment(headerB64) as { alg?: string };
    claims = decodeSegment(payloadB64) as StudioClaims;
  } catch {
    return null;
  }

  // Reject `alg: none` and any algorithm confusion attempt.
  if (header.alg !== 'HS256') return null;

  const expected = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  const provided = Buffer.from(signatureB64, 'base64url');
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  // Audience must be this app, so a token minted for anything else is not accepted.
  if (claims.aud !== 'studio') return null;

  // Expiry is mandatory — a token without one would never stop being valid.
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || nowSeconds >= claims.exp) return null;

  return claims;
}

/** Render's proxy terminates TLS, so trust the forwarded host for the redirect. */
function resolveOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/?sso=failed&reason=${reason}`, origin));

  const token = request.nextUrl.searchParams.get('token');
  if (!token) return fail('missing_token');

  const secret = process.env.STUDIO_JWT_SECRET;
  if (!secret) {
    console.error('[studio/entry] STUDIO_JWT_SECRET is not configured');
    return fail('not_configured');
  }

  const claims = verifyStudioToken(token, secret);
  if (!claims) return fail('invalid_token');

  const response = NextResponse.redirect(new URL('/', origin));

  // When ACCESS_CODE is unset the middleware lets everything through, so there is
  // no session cookie to mint — a verified token just lands on the app.
  const accessCode = process.env.ACCESS_CODE;
  if (accessCode) {
    response.cookies.set('openmaic_access', createAccessToken(accessCode), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days, matching the access-code flow
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}
