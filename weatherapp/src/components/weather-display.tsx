'use client'

import { useQuery } from '@tanstack/react-query'

import { getForecast } from '@/app/actions/weather'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { pickWeatherIcon } from '@/lib/weather-icon'

export function WeatherDisplay({
  lat,
  lon,
  label,
}: {
  lat: number
  lon: number
  label: string
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['forecast', lat.toFixed(4), lon.toFixed(4)],
    queryFn: () => getForecast(lat, lon),
    staleTime: 10 * 60 * 1000,
  })

  const current = data?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load forecast. NWS only covers the US.
          </p>
        )}
        {current && (() => {
          const Icon = pickWeatherIcon(current.shortForecast, current.isDaytime)
          return (
            <div className="flex items-start gap-5">
              <Icon
                className="h-16 w-16 text-foreground/80 shrink-0"
                strokeWidth={1.5}
              />
              <div className="flex flex-col gap-1">
                <div className="text-sm text-muted-foreground">
                  {current.name}
                </div>
                <div className="text-4xl font-semibold tracking-tight">
                  {current.temperature}°{current.temperatureUnit}
                </div>
                <div className="text-sm">{current.shortForecast}</div>
                <div className="text-sm text-muted-foreground">
                  Wind {current.windSpeed} {current.windDirection}
                </div>
              </div>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
