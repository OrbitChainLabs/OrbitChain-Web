/**
 * lib/auth/verifyToken.ts
 *
 * Single shared JWT verification for the whole app. The web app does not hold
 * the secret that signs backend tokens (`JWT_SECRET` lives in the sibling
 * OrbitChain-API repo), so verification is delegated to the API itself: the
 * token is sent to `GET /users/me` (a JwtAuthGuard-protected endpoint that
 * verifies the signature and expiry server-side) and is considered valid only
 * when that endpoint returns 200 with a user id.
 *
 * This is the "API introspection" strategy named in the route-guard issue:
 *   - middleware.ts           (Edge runtime)
 *   - app/api/drafts/**       (Node runtime)
 *   - lib/auth/ProtectedRoute.tsx and lib/auth/sessionTimeout.ts (browser)
 * all call this one module. It uses only `fetch` and environment config, so
 * it runs unchanged in all three environments. It fails closed: any network
 * error, non-200 response, or malformed body yields `null`.
 *
 * Trade-off: each verification is a network round-trip to the API, and a
 * token can only be verified while the API is reachable. The alternative —
 * sharing the signing secret or a public key with the web — is the decision
 * the issue leaves to the maintainers; if a shared secret is ever configured
 * here, swap this module's internals and every call site keeps working.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface VerifiedToken {
  userId: string;
}

/**
 * Verifies `token` against the backend API. Returns the verified user id, or
 * null when the token is missing, forged, expired, or the API is unreachable.
 */
export async function verifyToken(token: string): Promise<VerifiedToken | null> {
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    const userId =
      typeof data === 'object' &&
      data !== null &&
      typeof (data as { id?: unknown }).id === 'string'
        ? (data as { id: string }).id
        : null;

    if (!userId) {
      return null;
    }

    return { userId };
  } catch {
    // Network failure, timeout, or unparseable response — fail closed.
    return null;
  }
}
