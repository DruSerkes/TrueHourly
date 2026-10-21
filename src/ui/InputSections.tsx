/**
 * The seven collapsible sections, in order.
 *
 * The order is not alphabetical and not the order of the type definition. It is
 * roughly how much the section is likely to move the answer: bonus and equity
 * first because they are the biggest numbers outside salary, then the employer
 * money, then the time inputs, then the small perks, then the tax assumption
 * last because it only restates what is already there.
 *
 * All seven are collapsed by default, which is the whole point of progressive
 * disclosure — but each header states its own current contribution, so a
 * restored save shows at a glance where the numbers are without opening
 * anything.
 */

import { CashSection } from './sections/CashSection.tsx';
import { EquitySection } from './sections/EquitySection.tsx';
import { HealthSection } from './sections/HealthSection.tsx';
import { PerksSection } from './sections/PerksSection.tsx';
import { RetirementSection } from './sections/RetirementSection.tsx';
import { TaxSection } from './sections/TaxSection.tsx';
import { TimeLeaveSection } from './sections/TimeLeaveSection.tsx';
import type { InputSectionProps } from './sections/props.ts';

export function InputSections(props: InputSectionProps) {
  return (
    <section aria-labelledby="everything-else" className="mt-6">
      <h2 className="text-lg font-semibold text-ink" id="everything-else">
        Everything else
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Optional, and worth more than it looks. Each section shows what it is currently adding, so
        you can tell what you have filled in without opening it.
      </p>

      <div className="mt-3 space-y-3">
        <CashSection {...props} />
        <EquitySection {...props} />
        <RetirementSection {...props} />
        <HealthSection {...props} />
        <TimeLeaveSection {...props} />
        <PerksSection {...props} />
        <TaxSection {...props} />
      </div>
    </section>
  );
}
