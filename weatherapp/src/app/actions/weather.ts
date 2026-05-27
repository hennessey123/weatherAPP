'use server'

export type ForecastPeriod = {
  number: number
  name: string
  startTime: string
  endTime: string
  temperature: number
  temperatureUnit: string
  windSpeed: string
  windDirection: string
  shortForecast: string
  detailedForecast: string
  icon: string
  isDaytime: boolean
  probabilityOfPrecipitation?: { value: number | null }
}

const UA = 'weatherapp (github.com/fultonbrowne)'

async function nws<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`NWS ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

async function getForecastUrls(
  lat: number,
  lon: number,
): Promise<{ forecast: string; forecastHourly: string }> {
  const la = lat.toFixed(4)
  const lo = lon.toFixed(4)
  const points = await nws<{
    properties: { forecast: string; forecastHourly: string }
  }>(`https://api.weather.gov/points/${la},${lo}`)
  return points.properties
}

export async function getForecast(
  lat: number,
  lon: number,
): Promise<ForecastPeriod[]> {
  const { forecast } = await getForecastUrls(lat, lon)
  const data = await nws<{ properties: { periods: ForecastPeriod[] } }>(forecast)
  return data.properties.periods
}

export async function getHourlyForecast(
  lat: number,
  lon: number,
): Promise<ForecastPeriod[]> {
  const { forecastHourly } = await getForecastUrls(lat, lon)
  const data = await nws<{ properties: { periods: ForecastPeriod[] } }>(
    forecastHourly,
  )
  return data.properties.periods.slice(0, 24)
}

export type WeatherAlert = {
  id: string
  event: string
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'
  headline: string
  description: string
  onset: string
  expires: string
  areaDesc: string
}

export async function getAlerts(
  lat: number,
  lon: number,
): Promise<WeatherAlert[]> {
  const la = lat.toFixed(4)
  const lo = lon.toFixed(4)
  const url = `https://api.weather.gov/alerts/active?point=${la},${lo}`
  const data = await nws<{
    features?: Array<{
      properties: {
        id: string
        event: string
        severity: string
        headline: string
        description: string
        onset: string
        expires: string
        areaDesc: string
      }
    }>
  }>(url)

  return (data.features ?? []).map((f) => ({
    id: f.properties.id,
    event: f.properties.event,
    severity: (f.properties.severity || 'Unknown') as WeatherAlert['severity'],
    headline: f.properties.headline,
    description: f.properties.description,
    onset: f.properties.onset,
    expires: f.properties.expires,
    areaDesc: f.properties.areaDesc,
  }))
}
