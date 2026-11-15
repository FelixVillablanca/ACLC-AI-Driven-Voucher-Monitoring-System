/**
 * The glowing circles behind the login card (Framer p0wwkrh66).
 * Positions are copied from the 1200×800 frame, on a "stage" centred on the screen.
 * Purely decorative, so screen readers skip it (aria-hidden).
 */
const RINGS = [
  // [size, top, left, extra classes]
  [1240, -220, -20, 'bg-primary/10'],
  [860, -30, 170, 'bg-primary/[0.14]'],
  [560, 120, 320, 'bg-[rgb(99_102_241/0.22)]'],
  [700, 50, 250, 'border border-on-dark-border'],
  [1040, -120, 80, 'border border-dashed border-on-dark-border opacity-70'],
  [520, -260, 900, 'bg-[rgb(129_140_248/0.16)]'],
]

export default function LoginBackdrop({ children }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2"
    >
      {RINGS.map(([size, top, left, classes]) => (
        <div
          key={`${size}-${top}`}
          className={`absolute rounded-full ${classes}`}
          style={{ width: size, height: size, top, left }}
        />
      ))}
      {children}
    </div>
  )
}
