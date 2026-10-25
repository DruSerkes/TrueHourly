import { CARD } from './styles.ts';

export function HowThisWorks() {
  return (
    <details className={CARD}>
      <summary className="cursor-pointer">
        <h2 className="inline text-sm font-semibold text-ink">How this works</h2>
      </summary>

      <div className="mt-3 space-y-4 border-t border-line pt-3 text-sm text-ink-muted">
        <section>
          <h3 className="font-semibold text-ink">Time off makes you worth more per hour</h3>
          <p className="mt-1">
            Your salary is the same whether you take five days off or twenty-five. So paid time off
            is not extra money, it's the same money for fewer hours worked, and that raises your
            hourly rate from the bottom of the fraction rather than the top.
          </p>
          <p className="mt-2">
            This is why you will not find a dollar value for PTO anywhere in the breakdown. Adding
            one while also dividing by a full year of hours would count it twice. What the app does
            instead is work out the hours you actually work:
          </p>
          <p className="mt-2 rounded-md border border-line bg-surface-2 p-2 font-mono text-xs text-ink">
            hours per week × (52 weeks − time off − holidays)
          </p>
          <p className="mt-2">
            Forty-five hours a week with twenty days of PTO and eleven holidays is 2,061 hours a
            year, not the 2,080 every salary comparison assumes. If you work sixty-hour weeks it is
            2,748, which is the biggest reason two identical salaries are not identical jobs.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-ink">Not every dollar is taxed the same way</h3>
          <p className="mt-1">
            A dollar of salary and a dollar of health premium are not worth the same to you, because
            only one of them is taxed. The app sorts every dollar in your package into exactly one
            of three groups:
          </p>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="font-medium text-ink">Taxable: counted at face value</dt>
              <dd>
                Base salary, bonus, RSUs when they vest. The ordinary case: a dollar is a dollar.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Tax-free: counted at more than face value</dt>
              <dd>
                Your employer's share of health premiums, HSA contributions, free meals, commuter
                benefits. You never pay tax on these, so they are worth more than the same amount of
                salary: at a 32% marginal rate, a $14,000 premium is worth about $20,600 of pay,
                because you would have to earn $20,600 to buy it yourself. That is what the
                "salary-equivalent" toggle shows.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Tax-deferred: counted at face value</dt>
              <dd>
                Your employer's 401(k) match and profit sharing. It is real money, but you can't
                spend it until 59½ and it is taxed as ordinary income when you finally do, so the
                app refuses to inflate it the way it inflates a tax-free benefit. Treating a match
                as though it were tax-free is a common error in offer spreadsheets, and it flatters
                the offers with the biggest matches.
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 className="font-semibold text-ink">Guesses are labelled as guesses</h3>
          <p className="mt-1">
            Anything the app worked out rather than was told is marked{' '}
            <span className="rounded border border-dashed border-line-strong px-1 text-xs text-ink-muted">
              est.
            </span>{' '}
            in the breakdown, and private-company equity is counted as <strong>$0</strong> in the
            headline with its possible values shown separately.
          </p>
        </section>
      </div>
    </details>
  );
}
