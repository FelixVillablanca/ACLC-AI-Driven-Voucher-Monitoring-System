import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Loader2 } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { useDismiss } from '@/hooks/useDismiss'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getHealthDay } from '../api'
import { DAY_TONE, formatMs, serviceLabel } from '../utils'

/**
 * "Uptime · last 30 days" (Framer m80KDanOj): one bar per day (green ok, amber slow, red down,
 * grey = nothing recorded). Clicking a bar opens SH7: what was unhealthy that day, for how long,
 * how slow, and the incident if there was one ("Open incident →").
 *   uptime: { percent, days: [{ date, status, bad_minutes }] }   onOpenIncident(id)
 */
export default function UptimeStrip({ uptime, onOpenIncident }) {
  const [day, setDay] = useState(null)
  const ref = useRef(null)
  useDismiss(Boolean(day), ref, () => setDay(null))

  const days = uptime.days
  const worst = [...days].reverse().find((d) => d.status === 'slow' || d.status === 'down')

  return (
    <section ref={ref} aria-labelledby="uptime-title" className="relative flex flex-col gap-3 rounded-xl border bg-card px-[18px] py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="uptime-title" className="text-card-title">
          Uptime · last 30 days
        </h2>
        {uptime.percent != null ? (
          <Pill tone={uptime.percent >= 99.9 ? 'success' : 'warning'}>{uptime.percent}%</Pill>
        ) : (
          <Pill tone="neutral">No history yet</Pill>
        )}
      </div>

      <div className="flex h-9 items-end gap-[3px]" role="list" aria-label="One bar per day">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            role="listitem"
            onClick={() => setDay(day?.date === d.date ? null : d)}
            disabled={d.status === 'no_data'}
            aria-label={`${format(parseISO(d.date), 'MMM d')}: ${dayText(d)}`}
            className={cn(
              'h-full flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default',
              DAY_TONE[d.status],
              day?.date === d.date && 'ring-2 ring-foreground ring-offset-1',
            )}
          />
        ))}
      </div>
      <div className="text-caption flex justify-between gap-2">
        <span>{format(parseISO(days[0].date), 'MMM d')}</span>
        {worst && (
          <button type="button" onClick={() => setDay(worst)} className="text-badge rounded text-warning outline-none hover:underline">
            {format(parseISO(worst.date), 'MMM d')} · {worst.status === 'down' ? 'down' : 'slow'} {worst.bad_minutes} min
          </button>
        )}
        <span>Today</span>
      </div>

      {day && <DayDetails key={day.date} day={day} onOpenIncident={onOpenIncident} />}
    </section>
  )
}

function dayText(d) {
  if (d.status === 'no_data') return 'nothing recorded'
  if (d.status === 'ok') return 'working all day'
  return `${d.status === 'down' ? 'not working' : 'slow'} for about ${d.bad_minutes} minutes`
}

/** SH7: the callout under the strip. */
function DayDetails({ day, onOpenIncident }) {
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null,
  })

  useEffect(() => {
    let alive = true
    getHealthDay(day.date)
      .then((data) => alive && setState({ status: 'success', data, error: null }))
      .catch((error) => alive && setState({ status: 'error', data: null, error }))
    return () => {
      alive = false
    }
  }, [day.date])

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border bg-muted px-3.5 py-3" role="region" aria-label={`Details for ${day.date}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-strong">{format(parseISO(day.date), 'EEEE, MMM d')}</p>
        {day.status === 'ok' ? (
          <Pill tone="success">Working all day</Pill>
        ) : (
          <Pill tone={day.status === 'down' ? 'danger' : 'warning'}>
            {day.status === 'down' ? 'Down' : 'Slow'} · {day.bad_minutes} min
          </Pill>
        )}
      </div>
      {state.status === 'loading' && (
        <p className="text-caption flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading that day…
        </p>
      )}
      {state.status === 'error' && <p className="text-caption text-danger">Couldn’t load that day: {state.error.message}</p>}
      {state.status === 'success' && (
        <>
          {state.data.stretches.length === 0 ? (
            <p className="text-caption">Every check that day was healthy ({state.data.checks} checks).</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {state.data.stretches.map((s, i) => (
                <li key={i} className="text-caption">
                  <span className="text-body-strong text-foreground">
                    {formatDate(s.from, 'h:mm a')} to {formatDate(s.to, 'h:mm a')}
                  </span>{' '}
                  · {serviceLabel(s.service)} {s.status === 'danger' ? 'not working' : 'slow'} ({s.minutes} min)
                  {s.avg_latency_ms != null &&
                    s.service === 'web' &&
                    ` · pages took ${formatMs(s.avg_latency_ms)}${state.data.normal_latency_ms != null ? ` (normally ${formatMs(state.data.normal_latency_ms)})` : ''}`}
                </li>
              ))}
            </ul>
          )}
          {state.data.incidents.map((inc) => (
            <button
              key={inc.id}
              type="button"
              onClick={() => onOpenIncident(inc.id)}
              className="text-auth-link self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Open incident {inc.code}: {inc.title} →
            </button>
          ))}
        </>
      )}
    </div>
  )
}
