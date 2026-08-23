/**
 * lib/auth/requireAdmin.ts
 *
 * Shared authentication guard for every route under `app/api/admin/`.
 *
 * The app has two coexisting identity systems, and the guard accepts an admin
 * from either of them:
 *
 * 1. A NextAuth session (social login) whose `backendUser.role` is `admin`.
 *    This is the only identity source the old `app/api/admin/logs/route.ts`
 *    recognized; it is kept so social-login admins keep working.
 * 2. The backend JWT stored in the `token` cookie (email + wallet auth flows
 *    through `store/authStore.ts`). The payload is decoded and its `role`
 *    claim (top-level, `user.role`, or `userRole`) must be `admin`.
 *
 * Status semantics, per the issue's acceptance criteria:
 * - no credentials at all            -> 401
 * - credentials present, not admin   -> 403
 *
 * IMPORTANT — verification seam: the JWT path decodes the token payload but
 * does not verify its signature, because the signing secret (`JWT_SECRET`)
 * lives in the sibling OrbitChain-API repository and is not available here.
 * A forged token is therefore as strong as a real one *for the role claim
 * only*. Cryptographic signature verification for the whole app is tracked
 * separately in the route-guard issue (middleware.ts / drafts routes); once a
 * shared `verifyToken` module lands, this guard's JWT branch should consume
 * it. Fail-closed behavior for malformed or expired tokens is implemented
 * here regardless.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

export type AdminGuardResult =
  | { authorized: true }
  | { authorized: false; status: 401 | 403 };

interface DecodedTokenPayload {
  sub?: unknown;
  userId?: unknown;
  exp?: unknown;
  role?: unknown;
  user?: { role?: unknown };
  userRole?: unknown;
}

/** Base64URL-decode the payload segment of a JWT. Returns null on any failure. */
function decodeTokenPayload(token: string): DecodedTokenPayload | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;

    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = atob(base64);
    const payload = JSON.parse(jsonPayload);

    if (typeof payload !== 'object' || payload === null) return null;
    return payload as DecodedTokenPayload;
  } catch {
    return null;
  }
}

/** Case-insensitive admin check: the web app uses lowercase roles, the mock
 *  data layer uses uppercase (ADMIN). Both must be accepted. */
function isAdminRole(role: unknown): boolean {
  return typeof role === 'string' && role.toLowerCase() === 'admin';
}

function isExpired(exp: unknown): boolean {
  return typeof exp !== 'number' || exp <= Date.now() / 1000;
}

function hasUserIdentity(payload: DecodedTokenPayload): boolean {
  return Boolean(payload.sub || payload.userId);
}

/**
 * Returns `{ authorized: true }` when the request carries admin credentials,
 * otherwise `{ authorized: false, status }` where status is 401 (no
 * credentials) or 403 (authenticated but not an admin).
 */
export async function requireAdmin(request: NextRequest): Promise<AdminGuardResult> {
  // 1. NextAuth session (social login identity)
  const session = await getServerSession(authOptions);
  if (session?.backendUser) {
    return isAdminRole(session.backendUser.role)
      ? { authorized: true }
      : { authorized: false, status: 403 };
  }

  // 2. Backend JWT cookie (email + wallet auth flows)
  const token = request.cookies.get('token')?.value;
  if (!token) {
    return { authorized: false, status: 401 };
  }

  const payload = decodeTokenPayload(token);
  if (!payload || isExpired(payload.exp) || !hasUserIdentity(payload)) {
    return { authorized: false, status: 401 };
  }

  const role = payload.role ?? payload.user?.role ?? payload.userRole;
  return isAdminRole(role)
    ? { authorized: true }
    : { authorized: false, status: 403 };
}

/**
 * Convenience wrapper for route handlers: returns the NextResponse to send
 * when the request is denied, or null when the request is authorized. Call it
 * as the first statement of every admin handler:
 *
 *   const denied = await requireAdminResponse(request);
 *   if (denied) return denied;
 */
export async function requireAdminResponse(
  request: NextRequest,
): Promise<NextResponse | null> {
  const result = await requireAdmin(request);
  if (result.authorized) return null;

  return NextResponse.json(
    { error: result.status === 401 ? 'Unauthorized' : 'Forbidden' },
    { status: result.status },
  );
}
