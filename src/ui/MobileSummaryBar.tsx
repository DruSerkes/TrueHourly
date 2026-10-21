/**
 * The pinned-to-the-bottom figure on a phone (DESIGN.md §6).
 *
 * On a narrow screen the result panel cannot sit beside the form, so it sits
 * below it — which means that while someone is typing their salary, the number
 * they are typing it for is off-screen. This bar keeps it visible.
 *
 * It is `aria-hidden` on purpose. Every figure in it is already in the result
 * panel, announced through that panel's live region; duplicating it for a
 * screen reader would mean hearing the same rate twice with no way to tell the
 * two apart. The bar is a convenience for a sighted scrolling user, so it is
 * offered to exactly that user and to nobody else.
 */

import { formatHourly } from './format.ts';

export interface MobileSummaryBarProps {
  /** Dollars per hour, in whichever mode the panel is showing. */
  hourly: number;
  /** Dollars per hour, naive. Shown struck through as the thing being corrected. */
  naive: number;
  modeLabel: string;
}

export function MobileSummaryBar({ hourly, naive, modeLabel }: MobileSummaryBarProps) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-3">
        <span className="text-xs text-ink-faint">
          <span className="line-through tabular-nums">{formatHourly(naive)}</span> → {modeLabel}
        </span>
        <span className="text-2xl font-bold text-accent tabular-nums">
          {formatHourly(hourly)}
          <span className="ml-1 text-sm font-normal text-ink-muted">/ hr</span>
        </span>
      </div>
    </div>
  );
}
