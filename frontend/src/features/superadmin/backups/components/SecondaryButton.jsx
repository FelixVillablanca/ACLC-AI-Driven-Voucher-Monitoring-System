/** White 40px button with a border ("Cancel", "Close"). */
export default function SecondaryButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="text-body-strong h-10 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {children}
    </button>
  )
}
