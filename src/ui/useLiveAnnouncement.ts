/**
 * Debounced text for an `aria-live` region.
 *
 * The result recomputes on every keystroke, which is right for the eye and
 * hostile to the ear: a polite live region updated 20 times while someone types
 * `180000` queues 20 announcements, and a screen-reader user hears the number
 * change for several seconds after they have stopped typing. Worse, on some
 * combinations it interrupts the echo of the character they just typed.
 *
 * So the region holds a value that settles. 700ms is long enough to swallow a
 * run of keystrokes and short enough that the announcement still feels like a
 * response to what was typed.
 *
 * The timer is the only reason this is a hook and not a plain string: it has to
 * be cleared when the value changes again, and on unmount.
 */

import { useEffect, useState } from 'react';

/** Milliseconds of quiet before the live region is updated. */
const SETTLE_MS = 700;

export function useLiveAnnouncement(text: string, delayMs: number = SETTLE_MS): string {
  const [settled, setSettled] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);

  return settled;
}
