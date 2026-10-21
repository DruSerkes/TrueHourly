/**
 * The visible mark on a number the user did not type (invariant 6).
 *
 * Two rules it has to satisfy at once:
 *
 *   1. It must be visually distinguishable from an entered value. Hence the
 *      dashed border and the lighter weight — shape, not just a tint.
 *   2. It must not rely on colour, because roughly one man in twelve cannot use
 *      colour to carry information. Hence the word. "est." is readable at this
 *      size and expands to the full phrase for assistive technology, where the
 *      abbreviation would be read as a sentence ending.
 *
 * `entered` renders nothing at all. A badge on every row is a badge that marks
 * nothing, and the point is that the estimates stand out from the facts.
 */

import type { Confidence } from '../engine/types.ts';

const TEXT: Record<Exclude<Confidence, 'entered'>, { short: string; full: string }> = {
  estimated: { short: 'est.', full: 'estimated, not a figure you entered' },
  unknown: { short: 'unknown', full: 'unknown — counted as zero in the headline' },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === 'entered') return null;
  const { short, full } = TEXT[confidence];
  return (
    <span className="ml-1.5 rounded border border-dashed border-line-strong px-1 py-px align-middle text-[0.6875rem] font-normal text-ink-muted">
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}
