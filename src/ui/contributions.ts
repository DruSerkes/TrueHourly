/**
 * What a collapsed section is currently contributing.
 *
 * The rule from this session's brief: "a section header shows a summary of its
 * current contribution so a collapsed section is never a black box." Six closed
 * accordions with nothing but titles on them are a form that hides its own
 * state — the user cannot tell whether they already filled in the equity
 * section without opening it, and after a page reload restores a save, neither
 * can anyone else.
 *
 * These read the *result*, not the input. The number beside a section header is
 * therefore the same number the breakdown shows for those rows, computed once
 * by the engine — not a second parallel calculation in the UI that could
 * disagree with the panel sitting beside it.
 */

import type { Category, LineItem } from '../engine/types.ts';
import { valueOf } from './valueMode.ts';
import type { ValueMode } from './valueMode.ts';

/** Sum the matching rows in whichever mode the user is viewing. */
function sum(
  items: readonly LineItem[],
  mode: ValueMode,
  keep: (item: LineItem) => boolean
): number {
  return items.reduce((total, item) => (keep(item) ? total + valueOf(item, mode) : total), 0);
}

/** Total for one or more whole categories. */
export function sumCategories(
  items: readonly LineItem[],
  mode: ValueMode,
  categories: readonly Category[]
): number {
  return sum(items, mode, (item) => categories.includes(item.category));
}

/**
 * Total for named rows.
 *
 * Needed because one section does not map onto a category: base salary lives in
 * the always-visible fields while the bonus and sign-on live in a collapsible
 * one, and both are `category: 'cash'`. Summing the category there would
 * announce the whole salary as the contribution of a section that cannot edit
 * it.
 */
export function sumItems(
  items: readonly LineItem[],
  mode: ValueMode,
  ids: readonly string[]
): number {
  return sum(items, mode, (item) => ids.includes(item.id));
}

/** Whether any matching row is something the app worked out rather than was told. */
export function anyEstimated(
  items: readonly LineItem[],
  predicate: (item: LineItem) => boolean
): boolean {
  return items.some((item) => predicate(item) && item.confidence !== 'entered');
}
