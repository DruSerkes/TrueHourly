/**
 * Which of the two headline figures the UI is currently showing, and how to
 * read it off a line item.
 *
 * Invariant 4 says the engine always computes both and never decides which to
 * show, so the choice is UI state — but it is UI state that several unrelated
 * components need to agree on: the breakdown rows, the section headers, the
 * mode toggle, and the mobile bar. It lives in its own module because the
 * alternative is for every one of them to import it from whichever component
 * happened to declare it first, and because a module that exports a component
 * must export nothing else or Fast Refresh stops working.
 */

import type { LineItem } from '../engine/types.ts';

export type ValueMode = 'faceValue' | 'salaryEquivalent';

/**
 * The row's value in the current mode.
 *
 * The one place the mode name is mapped onto a field name. `faceValue` reads
 * `annualValue` — the two names differ because on a line item the figure is an
 * annual dollar amount, while on the headline it is one of two interpretations
 * of the whole package.
 */
export function valueOf(item: LineItem, mode: ValueMode): number {
  return mode === 'faceValue' ? item.annualValue : item.salaryEquivalent;
}
