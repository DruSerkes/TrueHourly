/**
 * The page.
 *
 * Three things only: hold the input, run the engine, lay out the two halves.
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
 */

import { useReducer, useState } from 'react';
import { calculate } from './engine/calculate.ts';
import { defaultCompensationInput } from './state/defaults.ts';
import { inputReducer } from './state/reducer.ts';
import { CoreInputs } from './ui/CoreInputs.tsx';
import { MobileSummaryBar } from './ui/MobileSummaryBar.tsx';
import { ResultPanel } from './ui/ResultPanel.tsx';
import type { ValueMode } from './ui/Breakdown.tsx';

export default function App() {
  const [input, dispatch] = useReducer(inputReducer, undefined, defaultCompensationInput);
  const [mode, setMode] = useState<ValueMode>('faceValue');
  const result = calculate(input);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-ink">True Hourly</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            What you actually earn per hour, once employer-paid benefits and the hours you really
            work are both in the arithmetic.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Everything runs in your browser. No account, no server, no analytics on what you type —
            your salary never leaves this page.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 pb-24 lg:grid-cols-12 lg:pb-6">
        <div className="lg:col-span-6">
          <CoreInputs input={input} dispatch={dispatch} />
        </div>

        <div className="lg:col-span-6">
          <ResultPanel
            input={input}
            result={result}
            dispatch={dispatch}
            mode={mode}
            onModeChange={setMode}
          />
        </div>
      </main>

      <MobileSummaryBar
        hourly={result.trueHourly[mode]}
        naive={result.baseHourlyNaive}
        modeLabel={mode === 'faceValue' ? 'face value' : 'salary-equivalent'}
      />
    </div>
  );
}
