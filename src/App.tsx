/**
 * The page.
 *
 * Four things: hold the input, run the engine, lay out the two halves, and keep
 * the input in `localStorage` so a returning visitor does not retype it.
 *
 * `calculate` is called on every render rather than memoized. It is pure, it
 * touches a few dozen numbers, and it runs in well under a millisecond — a
 * `useMemo` here would add a dependency array to keep correct in exchange for
 * nothing measurable. If that ever stops being true the fix is a memo, not a
 * cache inside the engine.
 *
 * Layout follows DESIGN.md §6 with one deliberate departure: form and result sit
 * side by side on a wide screen, and on a narrow one they stack with the
 * headline figure pinned to the bottom edge.
 *
 * ── Why nothing sticks on desktop ───────────────────────────────────────
 *
 * DESIGN.md §6 asks for a sticky result panel, and three versions of that were
 * tried before dropping it. The whole column pinned leaves its bottom
 * unreachable; the column with its own scrollbar lets the big number scroll out
 * of the panel that was meant to hold it; and pinning just the headline card —
 * which solves both of those — turns out to be the worst of the three in use,
 * because the thing hanging over the content you are scrolling to read is
 * precisely the thing you have already read.
 *
 * Sticky earns its keep when the pinned element is a CONTROL you keep reaching
 * for. This one is an OUTPUT, and on desktop it is already visible beside the
 * field you are typing into — which is the job sticky would have been doing.
 * On mobile the form and the result cannot share the screen, so there the
 * pinned bar stays and genuinely earns it.
 *
 * ── Why `reset` clears the save here and not in the reducer ─────────────
 *
 * DESIGN.md §5 wires reset-to-defaults to clearing the save, and the obvious
 * place to put that is the `reset` case of the reducer. It must not go there: a
 * reducer has to be a pure function of its arguments, and React invokes
 * reducers twice in development precisely to surface side effects hiding in
 * them. So the clear happens in this wrapper, which is a place a side effect is
 * allowed to live.
 */

import { useCallback, useReducer, useState } from 'react';
import { calculate } from './engine/calculate.ts';
import { defaultCompensationInput } from './state/defaults.ts';
import { inputReducer } from './state/reducer.ts';
import type { InputAction } from './state/reducer.ts';
import { clearSavedInput, loadSavedInput } from './state/storage.ts';
import { useAutosave } from './state/useAutosave.ts';
import type { CompensationInput } from './engine/types.ts';
import { CoreInputs } from './ui/CoreInputs.tsx';
import { Footer } from './ui/Footer.tsx';
import { HowThisWorks } from './ui/HowThisWorks.tsx';
import { InputSections } from './ui/InputSections.tsx';
import { MobileSummaryBar } from './ui/MobileSummaryBar.tsx';
import { ResultPanel } from './ui/ResultPanel.tsx';
import type { ValueMode } from './ui/valueMode.ts';

/**
 * Read the save once, and remember whether there was one.
 *
 * Both facts come from a single read so they cannot disagree, and it happens in
 * a `useState` initializer so it runs once per mount rather than on every
 * render.
 */
function initialState(): { input: CompensationInput; restored: boolean } {
  const saved = loadSavedInput();
  return { input: saved ?? defaultCompensationInput(), restored: saved !== null };
}

export default function App() {
  const [{ input: initialInput }] = useState(initialState);
  const [input, rawDispatch] = useReducer(inputReducer, initialInput);
  const [mode, setMode] = useState<ValueMode>('faceValue');
  const result = calculate(input);

  useAutosave(input);

  const dispatch = useCallback((action: InputAction) => {
    // Clearing before dispatching, not after: the autosave debounce is 500ms,
    // so the write of the fresh defaults lands well after this, and a clear
    // that ran afterwards would be racing it.
    if (action.type === 'reset') clearSavedInput();
    rawDispatch(action);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-ink">True Hourly</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">What you actually earn per hour</p>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl grow gap-6 px-4 py-6 pb-28 lg:grid-cols-12 lg:pb-6">
        <div className="min-w-0 lg:col-span-6">
          <div>
            <CoreInputs input={input} dispatch={dispatch} />
          </div>
          <InputSections input={input} result={result} dispatch={dispatch} mode={mode} />
        </div>

        <div className="min-w-0 lg:col-span-6">
          <ResultPanel
            input={input}
            result={result}
            dispatch={dispatch}
            mode={mode}
            onModeChange={setMode}
          />

          <div className="mt-4 ">
            <HowThisWorks />
          </div>
        </div>
      </main>

      <Footer />

      <MobileSummaryBar
        hourly={result.trueHourly[mode]}
        naive={result.baseHourlyNaive}
        modeLabel={mode === 'faceValue' ? 'face value' : 'salary-equivalent'}
        empty={result.totals.faceValue === 0}
      />
    </div>
  );
}
