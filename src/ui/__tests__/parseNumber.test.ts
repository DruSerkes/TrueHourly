/**
 * The parser is the only place in the UI where a user's characters become a
 * number, so it is the only place in the UI worth testing exhaustively. Every
 * row below is a thing someone will actually type — `180k` from a recruiter
 * email, `$180,000` pasted from an offer letter, `1.` on the way to `1.5`.
 *
 * The `null` cases matter more than the successes. `null` means "keep the last
 * good value and leave the text alone"; if any of them returned 0 instead, a
 * mid-paste keystroke would silently wipe a salary.
 */

import { describe, expect, it } from 'vitest';
import { parseNumeric, parsePercent } from '../parseNumber.ts';

describe('parseNumeric', () => {
  it.each([
    ['180000', 180_000],
    ['180,000', 180_000],
    ['$180,000', 180_000],
    ['  180000  ', 180_000],
    ['180k', 180_000],
    ['180K', 180_000],
    ['$180k', 180_000],
    ['1.8m', 1_800_000],
    ['0.5k', 500],
    ['.5', 0.5],
    ['45.8', 45.8],
    ['0', 0],
    ['', 0],
    ['   ', 0],
  ])('reads %o as %o', (text, expected) => {
    expect(parseNumeric(text)).toBe(expected);
  });

  // `180 000` is in here rather than in the table above on purpose: accepting a
  // space as a group separator is indistinguishable from accepting `1 2` as
  // twelve, and a typo that becomes a plausible number is worse than one that
  // is visibly refused.
  it.each([
    ['abc'],
    ['12k3'],
    ['1.2.3'],
    ['--5'],
    ['k'],
    ['$'],
    ['1 2'],
    ['180 000'],
    ['12%'],
    ['1e5'],
  ])('refuses %o rather than guessing', (text) => {
    expect(parseNumeric(text)).toBeNull();
  });

  it('treats an empty field as zero, which is a thing a user can mean', () => {
    // Clearing a field is deliberate and unambiguous; unparseable text is not.
    expect(parseNumeric('')).toBe(0);
    expect(parseNumeric('abc')).toBeNull();
  });

  it('round-trips what the field renders back into the same number', () => {
    // CurrencyField shows a grouped string and re-parses it on the next
    // keystroke, so these two have to agree or the field drifts.
    const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(248_635);
    expect(grouped).toBe('248,635');
    expect(parseNumeric(grouped)).toBe(248_635);
  });

  it('keeps a negative sign rather than laundering it here', () => {
    // The field clamps at 0 and the engine launders anyway. A parser that
    // silently flipped the sign would be a third opinion on the same number.
    expect(parseNumeric('-5')).toBe(-5);
  });
});

describe('parsePercent', () => {
  it.each([
    ['32', 0.32],
    ['32%', 0.32],
    ['32 %', 0.32],
    ['0', 0],
    ['', 0],
    ['42.5', 0.425],
  ])('reads %o as the decimal %o', (text, expected) => {
    expect(parsePercent(text)).toBeCloseTo(expected, 10);
  });

  it('refuses text it cannot read', () => {
    expect(parsePercent('a lot')).toBeNull();
  });

  it('converts exactly once — a decimal in means a hundredth out', () => {
    // CLAUDE.md: rates are decimals past this boundary. The classic bug is
    // double conversion, which turns 32% into 0.0032.
    expect(parsePercent('100')).toBe(1);
  });
});
