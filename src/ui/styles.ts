/**
 * Shared class strings.
 *
 * Only the handful of patterns that must look identical everywhere live here —
 * an input that renders differently in two sections reads as two different
 * controls, and the focus and contrast work in `index.css` assumes one of each.
 * Everything local to one component stays inline in that component, which is
 * where Tailwind is easiest to read.
 */

export const CARD =
  'rounded-lg border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';

export const LABEL = 'block text-sm font-medium text-ink';

export const HELP = 'mt-1 text-sm text-ink-muted';

export const INPUT =
  'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink ' +
  'tabular-nums placeholder:text-ink-faint';

/** An input whose text could not be parsed. Marked by shape, not colour alone. */
export const INPUT_INVALID = 'border-caution border-2';

export const BUTTON =
  'rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink ' +
  'hover:bg-surface-2';

export const BUTTON_ACTIVE =
  'rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink';

/** Visually hidden but available to assistive technology. */
export const SR_ONLY = 'sr-only';
