import { createLogger } from '@/lib/logger';
import type { FlyersMindsDay, FlyersMindsPublishedCurriculum } from './types';

const log = createLogger('FlyersMindsClient');

// Flyers Minds' backend (backend/server.py) has no service-account / API-key auth —
// only per-user JWT via POST /auth/admin-login. We log in once with a dedicated admin
// account and cache the token for its lifetime (7 days server-side), re-authenticating
// automatically when it's missing/expired. This cache is per Node process/instance —
// fine for a single-instance deployment, and simply costs one extra login call per cold
// start otherwise.
let cachedToken: { token: string; expiresAtMs: number } | null = null;

function getBaseUrl(): string {
  const baseUrl = process.env.FLYERSMINDS_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'FLYERSMINDS_API_BASE_URL is not configured. Set it to the Flyers Minds backend base URL, ' +
        'including the /api suffix (e.g. https://learn.flyerssoft.com/api).',
    );
  }
  return baseUrl.replace(/\/+$/, '');
}

function getAdminCredentials(): { email: string; password: string; admin_code: string } {
  const email = process.env.FLYERSMINDS_ADMIN_EMAIL;
  const password = process.env.FLYERSMINDS_ADMIN_PASSWORD;
  const admin_code = process.env.FLYERSMINDS_ADMIN_CODE;
  if (!email || !password || !admin_code) {
    throw new Error(
      'Flyers Minds admin credentials are not configured. Set FLYERSMINDS_ADMIN_EMAIL, ' +
        'FLYERSMINDS_ADMIN_PASSWORD, and FLYERSMINDS_ADMIN_CODE — these must belong to an ' +
        'existing admin account on the Flyers Minds deployment (role: "admin").',
    );
  }
  return { email, password, admin_code };
}

/** Decodes a JWT's `exp` claim without verifying the signature — we trust a token we just
 *  obtained ourselves over HTTPS from the login endpoint; we only need `exp` for cache TTL. */
function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const json = Buffer.from(payloadSegment, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function flyersMindsFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const baseUrl = getBaseUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await getAdminToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { detail?: string };
      detail = errBody.detail || '';
    } catch {
      // response wasn't JSON — ignore
    }
    throw new Error(
      `Flyers Minds API error: ${method} ${path} -> ${res.status}${detail ? ` (${detail})` : ''}`,
    );
  }

  return res.json() as Promise<T>;
}

/** Logs in (once, cached) and returns a valid admin bearer token. */
export async function getAdminToken(): Promise<string> {
  const now = Date.now();
  // Refresh 5 minutes early to avoid racing token expiry mid-request.
  if (cachedToken && cachedToken.expiresAtMs - now > 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const credentials = getAdminCredentials();
  const baseUrl = getBaseUrl();
  log.info('Authenticating with Flyers Minds (admin login)');

  const res = await fetch(`${baseUrl}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { detail?: string };
      detail = errBody.detail || '';
    } catch {
      // ignore
    }
    throw new Error(
      `Flyers Minds admin login failed: ${res.status}${detail ? ` (${detail})` : ''}`,
    );
  }

  const data = (await res.json()) as { token: string };
  const expiresAtMs = decodeJwtExpiryMs(data.token) ?? now + 6 * 24 * 60 * 60 * 1000; // fallback ~6 days
  cachedToken = { token: data.token, expiresAtMs };
  return data.token;
}

/** GET /api/pg-curriculum/days/{dayNumber}?course_slug=... — one day, including its
 *  ordered content sections, tasks, hands-on items, etc. (see types.ts). This is the
 *  full curriculum item OpenMAIC generates a classroom from — nothing about it is
 *  reordered or dropped on the way in. */
export async function getDay(dayNumber: number, courseSlug: string): Promise<FlyersMindsDay> {
  return flyersMindsFetch<FlyersMindsDay>(
    `/pg-curriculum/days/${dayNumber}?course_slug=${encodeURIComponent(courseSlug)}`,
  );
}

/** GET /api/pg-curriculum/published?course_slug=... — the full curriculum for a course.
 *  `days` is returned pre-ordered ascending by day_number (verified: the real query
 *  is `... ORDER BY day_number`) — pass it through as-is, never re-sort it. Only used
 *  where the full day list is actually needed (e.g. pre-warming) — fetching a single
 *  day should use getDay() instead to avoid downloading the whole curriculum. */
export async function getPublishedCurriculum(
  courseSlug: string,
): Promise<FlyersMindsPublishedCurriculum> {
  return flyersMindsFetch<FlyersMindsPublishedCurriculum>(
    `/pg-curriculum/published?course_slug=${encodeURIComponent(courseSlug)}`,
  );
}

/** Human-readable course title for the requirement text. Flyers Minds has no
 *  lightweight "get course by slug" endpoint (only the full published-curriculum
 *  response carries it), so this avoids an extra bulk fetch per launch: prefer an
 *  explicit env override, else title-case the slug (e.g. "aiml" -> "Aiml"). */
export function resolveCourseTitle(courseSlug: string): string {
  const override = process.env.FLYERSMINDS_COURSE_TITLE;
  if (override) return override;
  return courseSlug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
