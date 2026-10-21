/**
 * One collapsible input section (DESIGN.md §6, "progressive disclosure").
 *
 * ── Why `<details>` and not a button plus a panel ───────────────────────
 *
 * The hand-rolled version is a `<button aria-expanded>` controlling a region,
 * and it is about thirty lines of state and wiring to arrive back at what
 * `<details>` does natively: keyboard operable, correctly announced as a
 * disclosure, findable by in-page search in browsers that search collapsed
 * content, and openable before any JavaScript has run. The brief asks for
 * keyboard-operable disclosures; this is the version that cannot be got wrong.
 *
 * The one thing it costs is an animated height, which is not worth thirty lines
 * of state.
 *
 * ── Why the summary carries a number ────────────────────────────────────
 *
 * A collapsed section must not be a black box. The header states what the
 * section is currently contributing, so the form can be scanned closed: a
 * `$21,200` beside "Retirement & savings" says it is filled in, and a dash says
 * it is not. The figure also moves when the mode toggle flips, which quietly
 * teaches what the toggle does.
 */

import type { ReactNode } from 'react';
import { CARD } from './styles.ts';

export interface SectionProps {
  /** Base id; the heading uses it so the summary can be targeted in tests. */
  id: string;
  title: string;
  /** What the section is for, one line, always visible in the header. */
  blurb: string;
  /**
   * The current contribution, already formatted — or `null` for "nothing yet",
   * which renders as a dash rather than as `$0`. A zero the user chose and a
   * zero nobody has touched are different states and the header should not
   * conflate them.
   */
  summary: string | null;
  /** Optional qualifier under the number, e.g. `includes an estimate`. */
  summaryNote?: string;
  children: ReactNode;
}

export function Section({ id, title, blurb, summary, summaryNote, children }: SectionProps) {
  return (
    <details className={`${CARD} group`} id={id}>
      <summary className="-m-1 cursor-pointer list-none rounded-md p-1">
        {/* Stacked below 420px: at 360px the blurb and the figure fighting for
            the same line squeezes the blurb into a four-word column. */}
        <div className="flex flex-col gap-1 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between min-[420px]:gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {/* Rotates on open. `aria-hidden` because `<details>` already
                  announces its own expanded state — a chevron described as
                  "triangle" on top of that is noise. */}
              <span
                aria-hidden="true"
                className="inline-block text-ink-faint transition-transform group-open:rotate-90 motion-reduce:transition-none"
              >
                ▸
              </span>
              {title}
            </h3>
            <p className="mt-0.5 ml-5 text-sm text-ink-muted">{blurb}</p>
          </div>

          <div className="ml-5 shrink-0 min-[420px]:ml-0 min-[420px]:text-right">
            <span className="text-sm font-medium text-ink tabular-nums">{summary ?? '—'}</span>
            {summaryNote !== undefined && (
              <span className="block text-xs text-ink-faint">{summaryNote}</span>
            )}
          </div>
        </div>
      </summary>

      <div className="mt-3 divide-y divide-line border-t border-line pt-1">{children}</div>
    </details>
  );
}
