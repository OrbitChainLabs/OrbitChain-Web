/**
 * Regression guard for the environment contract (issue #9).
 *
 * lib/env.ts is the single source of truth for environment variables. These
 * tests fail when the contract drifts in either direction:
 *
 * 1. A `process.env.X` read is added anywhere in the scanned source
 *    directories without a matching entry in `RULES` (the schema).
 * 2. A variable declared in `RULES` is missing from `.env.example`, so
 *    contributors copying the template silently inherit an incomplete
 *    configuration.
 *
 * Framework-managed build-time variables (e.g. `NODE_ENV`) are always present
 * and are allowlisted rather than required to appear in the schema.
 *
 * Run with: npm test
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RULES } from '../lib/env.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Directories (relative to the repo root) whose `process.env.*` reads must be
 * declared in lib/env.ts RULES. Mirrors the acceptance criteria of issue #9.
 */
const SCANNED_DIRS = ['app', 'components', 'hooks', 'lib', 'store', 'features', 'utils'];

/** Standalone files at the repo root that are scanned too. */
const SCANNED_FILES = ['middleware.ts'];

/** Framework-managed build-time variables that are always present. */
const BUILD_TIME_VARS = new Set(['NODE_ENV']);

const ENV_READ_RE = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
const SOURCE_EXT_RE = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIPPED_DIRS = new Set(['node_modules', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIPPED_DIRS.has(entry)) walk(full, out);
    } else if (SOURCE_EXT_RE.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Maps every env var name to the files that read it. */
function collectEnvReads(files: string[]): Map<string, string[]> {
  const reads = new Map<string, string[]>();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(ENV_READ_RE)) {
      const key = match[1];
      if (!key) continue; // regex guarantees a capture group; keeps noUncheckedIndexedAccess happy
      const locations = reads.get(key) ?? [];
      locations.push(file);
      reads.set(key, locations);
    }
  }
  return reads;
}

test('every process.env.* read is declared in lib/env.ts RULES', () => {
  const files = [
    ...SCANNED_DIRS.flatMap((dir) => walk(join(ROOT, dir))),
    ...SCANNED_FILES.map((file) => join(ROOT, file)),
  ];

  expect(files.length, 'expected to find source files to scan').toBeGreaterThan(0);

  const reads = collectEnvReads(files);
  const undeclared = [...reads.entries()]
    .filter(([key]) => !BUILD_TIME_VARS.has(key) && !(key in RULES))
    .map(([key, locations]) => `${key} — read in ${locations.join(', ')}`);

  expect(
    undeclared,
    [
      'process.env reads not declared in lib/env.ts RULES (add a rule or, for a',
      'framework-managed build-time var, extend BUILD_TIME_VARS):',
      ...undeclared.map((line) => `  - ${line}`),
    ].join('\n'),
  ).toEqual([]);
});

test('every RULES key is present in .env.example', () => {
  const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
  const missing = Object.keys(RULES).filter((key) => {
    // Matches both active ("KEY=value") and commented ("# KEY=value") entries.
    const pattern = new RegExp(`^#?\\s*${key}=`, 'm');
    return !pattern.test(example);
  });

  expect(
    missing,
    [
      'RULES keys missing from .env.example (add them, commented out when optional):',
      ...missing.map((key) => `  - ${key}`),
    ].join('\n'),
  ).toEqual([]);
});
