/**
 * The disclaimer, and the privacy claim restated where someone looking for it
 * would go.
 *
 * The disclaimer is not boilerplate here. This app produces a dollar figure
 * about someone's pay from a single marginal rate they typed, and the gap
 * between "a useful way to compare two offers" and "a tax calculation" is
 * exactly the gap a person about to resign should not misjudge.
 */

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-xs text-ink-muted">
        <p>
          <strong className="text-ink">This is an estimate, not advice.</strong> True Hourly is a
          comparison tool: it restates a compensation package as a rate per hour actually worked,
          using one combined marginal tax rate that you choose. It is not tax, legal, investment or
          financial advice, it does not calculate your actual tax, and it cannot tell you what
          anything will be worth. Statutory limits are for the 2026 tax year and apply to the United
          States. Check anything that matters with someone qualified, and check the benefit figures
          themselves against your own plan documents.
        </p>
        <p>
          <strong className="text-ink">Your numbers stay here.</strong> Everything is calculated in
          your browser. Your inputs are saved only in this browser&rsquo;s local storage so the page
          remembers them when you come back, and they are never uploaded, logged or sent anywhere —
          there is no server to send them to. &ldquo;Reset to defaults&rdquo; erases the saved copy.
        </p>
      </div>
    </footer>
  );
}
