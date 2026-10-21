/**
 * What every input section is handed.
 *
 * Identical for all seven, and in its own module so a section file can export
 * nothing but its component — a module that exports both a component and
 * something else breaks Fast Refresh, which is the same reason `ids.ts` exists.
 *
 * `result` and `mode` are here because a section header states its own current
 * contribution, and that figure has to come from the engine's output rather
 * than from a second calculation in the UI.
 */

import type { CompensationInput, TrueHourlyResult } from '../../engine/types.ts';
import type { InputAction } from '../../state/reducer.ts';
import type { ValueMode } from '../valueMode.ts';

export interface InputSectionProps {
  input: CompensationInput;
  result: TrueHourlyResult;
  dispatch: (action: InputAction) => void;
  mode: ValueMode;
}
