/**
 * PURITY TEST — LOAD-BEARING. DO NOT WEAKEN OR DELETE.
 * ===================================================================
 *
 * CLAUDE.md invariant 1: `src/engine/` is a pure function.
 *
 *     calculate(input: CompensationInput): TrueHourlyResult
 *
 * Same input, same output, always. No React, no DOM, no clock, no randomness,
 * no I/O, no side effects.
 *
 * This is not a style preference. Three things depend on it:
 *
 *   1. The golden fixtures in DESIGN.md §4 are hand-computed and must hold
 *      exactly. A `Date` or `Math.random()` anywhere in the engine makes them
 *      unfalsifiable — a fixture that passes today fails in January.
 *   2. The engine is the app's entire correctness surface. Testing it needs no
 *      DOM, no mocks, and no setup, which is why it can be tested exhaustively.
 *   3. v2 compare mode maps `calculate` over a `CompensationInput[]`. That is
 *      only safe if calling it twice can't produce two answers.
 *
 * ── If this test fails ──────────────────────────────────────────────
 *
 * Fix the engine, not the test. In particular:
 *
 *   - Need today's date (tenure elapsed, vesting progress, a plan year)?
 *     The date is an INPUT. Pass it in on `CompensationInput` — it belongs to
 *     the caller, which knows what "now" means and can be tested with a
 *     fixed value.
 *   - Need a statutory limit or a default? It goes in `constants.ts` with a
 *     source URL (invariant 5), not behind an `import.meta.env` read.
 *   - Need to persist or share something? That is the job of `src/state/` and
 *     `src/ui/`. The engine hands back a value and forgets it.
 *
 * Adding a name to `ALLOWED_*` below is almost always the wrong fix. If a case
 * genuinely warrants it, log the reasoning in `docs/DECISIONS.md` (working
 * agreement 4) so the next session can see why the line moved.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** `src/engine`, resolved from this test file's location. */
const ENGINE_DIR = resolve(import.meta.dirname, '..');

/** Directory names skipped entirely when walking the engine. */
const SKIPPED_DIRS = new Set(['__tests__', '__fixtures__', 'node_modules']);

/**
 * Every `.ts` file under `src/engine/`, excluding test directories.
 * Recursive, so a future `src/engine/equity/` subdirectory is covered without
 * anyone remembering to update this list.
 */
function engineSourceFiles(dir: string = ENGINE_DIR): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIPPED_DIRS.has(entry)) found.push(...engineSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      found.push(full);
    }
  }
  return found;
}

/** Blank out a match, preserving newlines so line numbers stay accurate. */
function blank(match: string): string {
  return match.replace(/[^\n]/g, ' ');
}

/**
 * Strip comments, keeping string literals.
 *
 * Comments must go before either scan: the doc comments that explain WHY the
 * engine may not call `Date` would otherwise fail the `Date` check themselves.
 *
 * Strings must SURVIVE this pass, because a module specifier lives inside one —
 * strip strings before scanning imports and the React check silently matches
 * nothing. (The self-test at the bottom of this file exists to catch exactly
 * that; it caught it once already.)
 */
function stripComments(source: string): string {
  // Order matters: a string literal alternative comes before the `//` comment
  // alternative would be reached, so a `//` inside a string is consumed as part
  // of the string and the string is handed back untouched.
  const TOKENS =
    /('(?:[^'\\\n]|\\.)*')|("(?:[^"\\\n]|\\.)*")|(`(?:[^`\\]|\\.)*`)|(\/\*[\s\S]*?\*\/)|(\/\/[^\n]*)/g;
  return source.replace(TOKENS, (match) =>
    match.startsWith('/*') || match.startsWith('//') ? blank(match) : match
  );
}

/** Strip string literals from already-comment-free code. */
function stripStrings(source: string): string {
  const STRINGS = /('(?:[^'\\\n]|\\.)*')|("(?:[^"\\\n]|\\.)*")|(`(?:[^`\\]|\\.)*`)/g;
  return source.replace(STRINGS, blank);
}

/**
 * Code with both comments and strings removed — the right input for scanning
 * forbidden IDENTIFIERS, where a mention inside a string or comment is prose,
 * not a call.
 */
function stripCommentsAndStrings(source: string): string {
  return stripStrings(stripComments(source));
}

/** Module specifiers the engine may never import. */
const FORBIDDEN_IMPORTS = [
  { pattern: /^react$/, why: 'the engine must not depend on React' },
  { pattern: /^react-dom(\/.*)?$/, why: 'the engine must not depend on React DOM' },
  { pattern: /^react\/.+$/, why: 'the engine must not depend on React' },
];

/**
 * Identifiers that make the engine impure. Each is matched as a whole word so
 * `updatedAt` doesn't trip the `Date` rule and `prefetch` doesn't trip `fetch`.
 *
 * `Date` covers `new Date()`, `Date.now()`, and `Date.parse()` alike — the
 * engine has no business knowing what time it is.
 */
const FORBIDDEN_IDENTIFIERS = [
  { name: 'window', pattern: /\bwindow\b/, why: 'browser global; the engine has no environment' },
  { name: 'document', pattern: /\bdocument\b/, why: 'DOM access' },
  { name: 'Date', pattern: /\bDate\b/, why: 'the current date is an input, not an ambient fact' },
  { name: 'Math.random', pattern: /\bMath\s*\.\s*random\b/, why: 'nondeterminism' },
  { name: 'fetch', pattern: /\bfetch\b/, why: 'network I/O; also invariant 7 (no data leaves)' },
  { name: 'localStorage', pattern: /\blocalStorage\b/, why: 'persistence belongs to src/state' },
];

/**
 * Additional impurity sources worth catching early. These were not named in the
 * original brief; they are the same class of problem, so a failure here means
 * the same thing. Removing one of these is a weakening of this test.
 */
const FORBIDDEN_EXTRAS = [
  {
    name: 'sessionStorage',
    pattern: /\bsessionStorage\b/,
    why: 'persistence belongs to src/state',
  },
  { name: 'performance', pattern: /\bperformance\s*\.\s*now\b/, why: 'a clock is a clock' },
  { name: 'navigator', pattern: /\bnavigator\b/, why: 'browser global' },
  { name: 'process.env', pattern: /\bprocess\s*\.\s*env\b/, why: 'ambient configuration' },
  { name: 'import.meta.env', pattern: /\bimport\s*\.\s*meta\s*\.\s*env\b/, why: 'ambient config' },
  { name: 'crypto', pattern: /\bcrypto\s*\.\s*randomUUID\b/, why: 'nondeterminism' },
  { name: 'console', pattern: /\bconsole\s*\./, why: 'a side effect; return a Warning instead' },
];

/** Every `import ... from '<spec>'` / `export ... from '<spec>'` specifier. */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const STATIC = /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const BARE = /\bimport\s*['"]([^'"]+)['"]/g;
  const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [STATIC, BARE, DYNAMIC]) {
    for (const match of source.matchAll(re)) {
      if (match[1] !== undefined) specs.push(match[1]);
    }
  }
  return specs;
}

/** 1-indexed line numbers where `pattern` matches, for actionable failures. */
function matchingLines(source: string, pattern: RegExp): number[] {
  const lines: number[] = [];
  source.split('\n').forEach((line, i) => {
    // `pattern` may be non-global; construct a fresh test per line so `lastIndex`
    // can never leak state between lines.
    if (new RegExp(pattern.source).test(line)) lines.push(i + 1);
  });
  return lines;
}

describe('engine purity (CLAUDE.md invariant 1)', () => {
  const files = engineSourceFiles();

  it('finds engine source files to scan', () => {
    // Guards against the walker silently returning [] — an empty scan would make
    // every assertion below pass vacuously, which is the failure mode that would
    // quietly retire this whole test.
    expect(files.length).toBeGreaterThan(0);
  });

  // `describe.each` over discovered files means a failure names the offending
  // file in the test title, rather than burying it in one aggregate assertion.
  describe.each(files.map((f) => [relative(ENGINE_DIR, f), f] as const))('%s', (_label, file) => {
    const raw = readFileSync(file, 'utf8');
    /** Strings intact — module specifiers live inside them. */
    const withStrings = stripComments(raw);
    /** Strings gone — a name inside a string is prose, not a call. */
    const code = stripStrings(withStrings);

    it('imports no React packages', () => {
      const offenders = importSpecifiers(withStrings).filter((spec) =>
        FORBIDDEN_IMPORTS.some(({ pattern }) => pattern.test(spec))
      );
      expect(offenders, `forbidden import(s) in ${relative(ENGINE_DIR, file)}`).toEqual([]);
    });

    it.each([...FORBIDDEN_IDENTIFIERS, ...FORBIDDEN_EXTRAS])(
      'does not reference $name ($why)',
      ({ pattern }) => {
        expect(matchingLines(code, pattern)).toEqual([]);
      }
    );
  });
});

describe('purity scanner self-test', () => {
  // The scanner is only trustworthy if it actually catches what it claims to.
  // These cases pin its behavior so a future refactor of the regexes can't
  // silently turn the whole suite into a no-op.

  it('detects a forbidden identifier in code', () => {
    const code = stripCommentsAndStrings('const now = Date.now();');
    expect(matchingLines(code, /\bDate\b/)).toEqual([1]);
  });

  it('ignores a forbidden identifier inside a comment', () => {
    const code = stripCommentsAndStrings('// never call Date.now() here\nconst a = 1;');
    expect(matchingLines(code, /\bDate\b/)).toEqual([]);
  });

  it('ignores a forbidden identifier inside a string literal', () => {
    const code = stripCommentsAndStrings(`const label = 'window';`);
    expect(matchingLines(code, /\bwindow\b/)).toEqual([]);
  });

  it('does not false-positive on words that merely contain a forbidden name', () => {
    const code = stripCommentsAndStrings('const updatedAt = 1;\nconst prefetch = 2;');
    expect(matchingLines(code, /\bDate\b/)).toEqual([]);
    expect(matchingLines(code, /\bfetch\b/)).toEqual([]);
  });

  it('preserves line numbers when stripping', () => {
    const code = stripCommentsAndStrings('/* a\n b\n c */\nwindow.x = 1;');
    expect(matchingLines(code, /\bwindow\b/)).toEqual([4]);
  });

  it('keeps string literals when only comments are stripped', () => {
    // The regression this pins: import scanning runs on comment-stripped code,
    // so if this pass ate strings, every React check would match nothing.
    expect(stripComments(`import { a } from 'react'; // nope`)).toContain(`'react'`);
  });

  it('extracts static, bare, and dynamic import specifiers', () => {
    const code = stripComments(
      [
        `import { a } from 'react';`,
        `export { b } from './local.ts';`,
        `import 'react-dom/client';`,
        `const c = await import('react/jsx-runtime');`,
      ].join('\n')
    );
    expect(importSpecifiers(code)).toEqual(
      expect.arrayContaining(['react', './local.ts', 'react-dom/client', 'react/jsx-runtime'])
    );
  });

  it('flags exactly the React specifiers and not local ones', () => {
    const isForbidden = (spec: string) =>
      FORBIDDEN_IMPORTS.some(({ pattern }) => pattern.test(spec));
    expect(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'].every(isForbidden)).toBe(
      true
    );
    expect(['./types.ts', 'node:path', 'reactive-thing'].some(isForbidden)).toBe(false);
  });
});
