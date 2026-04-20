'use client'

import { useQuery } from '@tanstack/react-query'

import { getHourlyForecast } from '@/app/actions/weather'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { pickWeatherIcon } from '@/lib/weather-icon'

function formatHour(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

export function HourlyForecast({ lat, lon }: { lat: number; lon: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['forecast-hourly', lat.toFixed(4), lon.toFixed(4)],
    queryFn: () => getHourlyForecast(lat, lon),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          Next 24 hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-16 shrink-0" />
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load hourly forecast.
          </p>
        )}
        {data && (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6">
            {data.map((p) => {
              const Icon = pickWeatherIcon(p.shortForecast, p.isDaytime)
              const pop = p.probabilityOfPrecipitation?.value ?? 0
              return (
                <div
                  key={p.startTime}
                  className="flex flex-col items-center gap-1 shrink-0 w-14"
                >
                  <span className="text-xs text-muted-foreground">
                    {formatHour(p.startTime)}
                  </span>
                  <Icon
                    className="h-6 w-6 text-foreground/80"
                    strokeWidth={1.75}
                  />
                  <span className="text-sm font-medium">
                    {p.temperature}°
                  </span>
                  <span className="text-xs text-sky-600 dark:text-sky-400 h-4">
                    {pop >= 10 ? `${pop}%` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
