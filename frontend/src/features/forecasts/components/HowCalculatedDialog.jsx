import ModalShell from '@/components/common/ModalShell'

/**
 * "ⓘ How it's calculated" (Framer sjtX1kKqt header button). Plain words, real method: a straight-line trend
 * (linear regression) in Laravel until Phase 5's AI model takes over.
 */
export default function HowCalculatedDialog({ minMonths, onClose }) {
  return (
    <ModalShell
      title="How the forecast is calculated"
      subtitle="A trend line through past spending, not a guess"
      width={540}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 overflow-y-auto px-6 py-5">
        <Step n="1" title="Past spending per month">
          We add up the vouchers that got their final approval each month, up to the last 24 finished months. The current month isn’t
          finished, so it isn’t used yet.
        </Step>
        <Step n="2" title="A straight trend line">
          A line is drawn as close as possible to all those months (this is called <em>linear regression</em>). If spending grew about
          ₱10,000 a month, the line keeps growing by that much.
        </Step>
        <Step n="3" title="The forecast and its range">
          The line is continued into the next months. The range is where spending should land about 4 times out of 5 if the trend continues.
          A wide range means the past months jumped around a lot, so the <strong>confidence</strong> is lower.
        </Step>
        <Step n="4" title="Fit (R²)">
          R² shows how well the line follows the past months: 1.00 is a perfect fit, 0 means the months don’t follow a line at all.
        </Step>
        <Step n="5" title="Risk">
          What’s still expected until the end of the fiscal year (the rest of this month’s forecast plus the next months) is compared with
          the department’s budget left. More than what’s left is <strong>Over</strong>; 85% or more is <strong>Tight</strong>.
        </Step>
        <p className="text-caption rounded-lg bg-muted px-3 py-2.5">
          It needs at least {minMonths} months of approved spending. It’s worked out again on the 1st of every month (or when you press
          Recalculate). One-off purchases and seasons aren’t predicted by a straight line, so check “What’s driving it” too. The AI model
          planned for later will replace this method.
        </p>
      </div>
      <div className="flex justify-end border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="text-auth-button h-[38px] rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Got it
        </button>
      </div>
    </ModalShell>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-3">
      <span className="text-badge flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">{n}</span>
      <div className="flex flex-col gap-0.5">
        <p className="text-body-strong">{title}</p>
        <p className="text-body text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
