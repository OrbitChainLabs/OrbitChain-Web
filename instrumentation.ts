/**
 * Next.js instrumentation hook.
 *
 * Runs once when the Next.js server instance boots (`next dev` / `next start`)
 * and during `next build`, so missing or invalid required environment
 * variables fail fast with the variable name instead of surfacing later as
 * cryptic runtime request errors.
 *
 * The schema in `lib/env.ts` is the single source of truth: it separates
 * required from optional variables, so this hook only fails builds when a
 * genuinely required variable is missing or invalid. Optional variables are
 * reported as warnings and never break the build.
 */
export async function register(): Promise<void> {
  const { assertEnv } = await import('./lib/env');
  assertEnv();
}
