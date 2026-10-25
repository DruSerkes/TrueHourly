/**
 * Off-headline cards (DESIGN.md §2.6).
 *
 * These are real parts of a compensation package that are not dollars per hour:
 * a PTO balance paid out when you leave, the on-call rota,
 * a vesting cliff. The engine keeps them in their own array precisely so that
 * no summing loop can pick them up, and this component keeps them visually
 * separate for the same reason — a card that looked like a line item would
 * invite the reader to add it in by eye, which is the error the separate array
 * was built to prevent.
 *
 * Hence the heading saying so in words, and the amounts labelled "one-time"
 * rather than left to look like an annual figure.
 */

import type { Note } from '../engine/types.ts';
import { ConfidenceBadge } from './ConfidenceBadge.tsx';
import { formatDollars } from './format.ts';

export function NoteCards({ notes }: { notes: readonly Note[] }) {
  if (notes.length === 0) return null;

  return (
    <section aria-labelledby="notes-heading">
      <h3 className="text-sm font-semibold text-ink" id="notes-heading">
        Worth knowing
      </h3>
      <p className="mt-1 text-xs text-ink-faint">
        None of these are counted in the figures above. They are one-offs, or they are not money at
        all.
      </p>
      <ul className="mt-2 space-y-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded-md border border-line bg-surface-2 px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-semibold text-ink">
                {note.title}
                <ConfidenceBadge confidence={note.confidence} />
              </h4>
              {note.amount !== undefined && note.amount > 0 && (
                <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                  {formatDollars(note.amount)}
                  <span className="ml-1 font-normal text-ink-faint">one-time</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{note.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
