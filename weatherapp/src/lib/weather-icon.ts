import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react'

export function pickWeatherIcon(
  shortForecast: string,
  isDaytime: boolean,
): LucideIcon {
  const f = shortForecast.toLowerCase()
  if (f.includes('thunder') || f.includes('lightning')) return CloudLightning
  if (f.includes('snow') || f.includes('sleet') || f.includes('flurries'))
    return CloudSnow
  if (f.includes('drizzle')) return CloudDrizzle
  if (f.includes('rain') || f.includes('shower')) return CloudRain
  if (f.includes('fog') || f.includes('haze') || f.includes('smoke'))
    return CloudFog
  if (f.includes('wind')) return Wind
  if (f.includes('partly') || f.includes('mostly cloudy')) return CloudSun
  if (f.includes('cloud') || f.includes('overcast')) return Cloud
  return isDaytime ? Sun : Moon
}
