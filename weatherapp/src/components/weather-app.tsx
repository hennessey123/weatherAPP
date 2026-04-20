'use client'

import { useState } from 'react'

import { LocationSearch } from '@/components/location-search'
import { WeatherDisplay } from '@/components/weather-display'
import { HourlyForecast } from '@/components/hourly-forecast'
import { DailyForecast } from '@/components/daily-forecast'
import type { GeocodeMatch } from '@/app/actions/geocode'

const DEFAULT_LOCATION: GeocodeMatch = {
  matchedAddress: 'Portland, OR',
  lat: 45.5152,
  lon: -122.6784,
}

export function WeatherApp() {
  const [location, setLocation] = useState<GeocodeMatch>(DEFAULT_LOCATION)

  return (
    <div className="w-full max-w-xl flex flex-col gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Weather</h1>
        <p className="text-sm text-muted-foreground">
          Search a US location to see the NWS forecast.
        </p>
      </div>
      <LocationSearch onSelect={setLocation} />
      <WeatherDisplay
        lat={location.lat}
        lon={location.lon}
        label={location.matchedAddress}
      />
      <HourlyForecast lat={location.lat} lon={location.lon} />
      <DailyForecast lat={location.lat} lon={location.lon} />
    </div>
  )
}
