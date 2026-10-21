/**
 * Debounced autosave (DESIGN.md §5: "on every input change, debounced ~500ms").
 *
 * The debounce is not a performance measure — `JSON.stringify` on this object
 * is microseconds. It is there because `localStorage` writes are synchronous
 * and hit the disk, and doing one per keystroke is how a text field starts
 * dropping characters on a slow machine. 500ms also means a half-typed salary
 * is usually never written at all, which is a small privacy win for free: the
 * blob on disk tends to hold numbers the user finished typing.
 *
 * The timer is cleared on every change and on unmount, so at most one write is
 * ever pending.
 */

import { useEffect } from 'react';
import type { CompensationInput } from '../engine/types.ts';
import { saveInput } from './storage.ts';

/** Matches DESIGN.md §5. */
export const AUTOSAVE_DELAY_MS = 500;

/**
 * Persist `input` whenever it settles.
 *
 * `enabled` exists for the reset case: clearing the save and then immediately
 * autosaving the defaults back over it would make the clear a no-op. The caller
 * does not need it today — reset replaces the input, which schedules a write of
 * the defaults, and a save holding exactly the defaults is indistinguishable
 * from no save at all — but a future "don't remember me" switch is one boolean
 * away, and leaving the seam here costs nothing.
 */
export function useAutosave(input: CompensationInput, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => saveInput(input), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input, enabled]);
}
