import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-studio-secret';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** Mints a token the same way Flyers Minds' real POST /auth/studio-token does
 *  (HS256, aud: "studio"), so these tests exercise the real verification path. */
function mintStudioToken(
  claims: Record<string, unknown>,
  options: { secret?: string; alg?: string; expiresInSeconds?: number } = {},
): string {
  const header = { alg: options.alg ?? 'HS256', typ: 'JWT' };
  const payload = {
    aud: 'studio',
    exp: Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 180),
    ...claims,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', options.secret ?? SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

function makeEntryRequest(token: string) {
  const url = new URL('https://studio.example.com/studio/entry');
  if (token) url.searchParams.set('token', token);
  return {
    nextUrl: url,
    headers: { get: () => null },
  } as unknown as import('next/server').NextRequest;
}

describe('GET /studio/entry — day preservation through SSO', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('STUDIO_JWT_SECRET', SECRET);
    vi.stubEnv('ACCESS_CODE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('redirects to /classroom/launch with the verified day (and course) when the token carries one', async () => {
    const token = mintStudioToken({ user_id: 'u1', course: 'aiml', day: 7 });
    const { GET } = await import('@/app/studio/entry/route');

    const res = await GET(makeEntryRequest(token));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/classroom/launch');
    expect(location.searchParams.get('day')).toBe('7');
    expect(location.searchParams.get('courseSlug')).toBe('aiml');
  });

  it('does NOT discard the day claim for a different day number', async () => {
    const token = mintStudioToken({ user_id: 'u1', course: 'aiml', day: 42 });
    const { GET } = await import('@/app/studio/entry/route');

    const res = await GET(makeEntryRequest(token));

    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('day')).toBe('42');
  });

  it('falls back to the bare dashboard ("/") when the token has no day claim', async () => {
    const token = mintStudioToken({ user_id: 'u1', course: 'aiml' }); // no `day`
    const { GET } = await import('@/app/studio/entry/route');

    const res = await GET(makeEntryRequest(token));

    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/');
    expect(location.searchParams.has('day')).toBe(false);
  });

  it('rejects a token signed with the wrong secret (does not leak a day redirect for a forged token)', async () => {
    const token = mintStudioToken({ user_id: 'u1', day: 7 }, { secret: 'wrong-secret' });
    const { GET } = await import('@/app/studio/entry/route');

    const res = await GET(makeEntryRequest(token));

    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/');
    expect(location.searchParams.get('reason')).toBe('invalid_token');
  });

  it('rejects alg:none / algorithm confusion attempts', async () => {
    const token = mintStudioToken({ user_id: 'u1', day: 7 }, { alg: 'none' });
    const { GET } = await import('@/app/studio/entry/route');

    const res = await GET(makeEntryRequest(token));

    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('reason')).toBe('invalid_token');
  });

  it('rejects an expired token even if it carries a day claim', async () => {
    const token = mintStudioToken({ user_id: 'u1', day: 7 }, { expiresInSeconds: -10 });
    const { GET } = await import('@/app/studio/entry/route');

    const res = await GET(makeEntryRequest(token));

    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/');
    expect(location.searchParams.get('reason')).toBe('invalid_token');
  });

  it('fails clearly when no token is present at all', async () => {
    const { GET } = await import('@/app/studio/entry/route');

    const res = await GET(makeEntryRequest(''));

    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('reason')).toBe('missing_token');
  });
});
