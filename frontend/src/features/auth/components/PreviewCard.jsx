import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * A small tilted white card floating beside the login form (Framer p0wwkrh66).
 * It's a picture of what the app does, not real data: nobody is logged in yet,
 * so there is nothing to load.
 *
 * ANIMATION (framer-motion), about 9 seconds in total, then it stops:
 *   1. Entrance: fades in and rises 32px into place (first ~1s).
 *   2. Float:    bobs up and down with a slight tilt, each bob smaller than the
 *                last ("damped" motion), so it settles gently instead of stopping dead.
 * `order` staggers the cards so they don't move in sync.
 * People who turned on "reduce motion" in their system settings see no animation.
 */
const DURATION = 9 // seconds, entrance + float
const TIMES = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1] // when each keyframe is reached (0 = start, 1 = end)
const LIFT = [32, -10, 0, -7, 0, -4, 0, -2, 0] // px: rise in, then smaller and smaller bobs
const TILT = [0, 1.2, 0, -0.8, 0, 0.5, 0, -0.2, 0] // degrees added to the card's own tilt

export default function PreviewCard({ top, left, rotate = 0, order = 0, className, children }) {
  const reduceMotion = useReducedMotion()
  const delay = 0.3 + order * 0.15

  return (
    <motion.div
      className={cn('absolute rounded-[14px] border bg-card text-foreground shadow-xl shadow-black/20', className)}
      style={{ top, left, rotate }}
      initial={reduceMotion ? false : { opacity: 0, y: LIFT[0] }}
      animate={
        reduceMotion
          ? undefined
          : { opacity: 1, y: LIFT, rotate: TILT.map((extra) => rotate + extra) }
      }
      transition={{
        opacity: { duration: 0.6, delay, ease: 'easeOut' },
        y: { duration: DURATION, times: TIMES, delay, ease: 'easeInOut' },
        rotate: { duration: DURATION, times: TIMES, delay, ease: 'easeInOut' },
      }}
    >
      {children}
    </motion.div>
  )
}
