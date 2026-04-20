'use client'

import { useQuery } from '@tanstack/react-query'

import { getForecast, type ForecastPeriod } from '@/app/actions/weather'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { pickWeatherIcon } from '@/lib/weather-icon'

type Day = {
  key: string
  label: string
  high: number | null
  low: number | null
  dayPeriod: ForecastPeriod | null
  summary: string
}

function dateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string, index: number): string {
  if (index === 0) return 'Today'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}

function groupByDay(periods: ForecastPeriod[]): Day[] {
  const buckets = new Map<string, ForecastPeriod[]>()
  for (const p of periods) {
    const k = dateKey(p.startTime)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k)!.push(p)
  }
  const days: Day[] = []
  let i = 0
  for (const [key, group] of buckets) {
    const day = group.find((p) => p.isDaytime) ?? null
    const night = group.find((p) => !p.isDaytime) ?? null
    const anchor = group[0]
    days.push({
      key,
      label: dayLabel(anchor.startTime, i),
      high: day?.temperature ?? null,
      low: night?.temperature ?? null,
      dayPeriod: day,
      summary: (day ?? night)?.shortForecast ?? '',
    })
    i++
  }
  return days.slice(0, 7)
}

export function DailyForecast({ lat, lon }: { lat: number; lon: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['forecast', lat.toFixed(4), lon.toFixed(4)],
    queryFn: () => getForecast(lat, lon),
    staleTime: 10 * 60 * 1000,
  })

  const days = data ? groupByDay(data) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          Next 7 days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load weekly forecast.
          </p>
        )}
        {days.length > 0 && (
          <ul className="divide-y">
            {days.map((d) => {
              const Icon = pickWeatherIcon(
                d.summary,
                d.dayPeriod?.isDaytime ?? true,
              )
              return (
                <li
                  key={d.key}
                  className="grid grid-cols-[3.5rem_2rem_1fr_auto] items-center gap-3 py-2.5"
                >
                  <span className="text-sm font-medium">{d.label}</span>
                  <Icon
                    className="h-5 w-5 text-foreground/80"
                    strokeWidth={1.75}
                  />
                  <span className="text-sm text-muted-foreground truncate">
                    {d.summary}
                  </span>
                  <span className="text-sm tabular-nums">
                    <span className="font-medium">
                      {d.high !== null ? `${d.high}°` : '—'}
                    </span>
                    <span className="text-muted-foreground">
                      {' / '}
                      {d.low !== null ? `${d.low}°` : '—'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
