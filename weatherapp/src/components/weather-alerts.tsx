'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, AlertCircle, Info, Cloud } from 'lucide-react'

import { getAlerts } from '@/app/actions/weather'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function WeatherAlerts({
  lat,
  lon,
}: {
  lat: number
  lon: number
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts', lat.toFixed(4), lon.toFixed(4)],
    queryFn: () => getAlerts(lat, lon),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-base font-medium">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data || data.length === 0) {
    return null
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'Extreme':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          textColor: 'text-red-900',
          badgeColor: 'bg-red-100',
          Icon: AlertTriangle,
        }
      case 'Severe':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          textColor: 'text-orange-900',
          badgeColor: 'bg-orange-100',
          Icon: AlertTriangle,
        }
      case 'Moderate':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          textColor: 'text-yellow-900',
          badgeColor: 'bg-yellow-100',
          Icon: AlertCircle,
        }
      case 'Minor':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          textColor: 'text-blue-900',
          badgeColor: 'bg-blue-100',
          Icon: Info,
        }
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          textColor: 'text-gray-900',
          badgeColor: 'bg-gray-100',
          Icon: Cloud,
        }
    }
  }

  // Sort alerts by severity (Extreme first)
  const severityRank = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 }
  const sortedAlerts = [...data].sort(
    (a, b) => (severityRank[a.severity as keyof typeof severityRank] ?? 5) -
              (severityRank[b.severity as keyof typeof severityRank] ?? 5)
  )

  return (
    <Card className={sortedAlerts[0] && getSeverityStyles(sortedAlerts[0].severity).border}>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          {sortedAlerts.length} Weather Alert{sortedAlerts.length !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedAlerts.map((alert) => {
          const styles = getSeverityStyles(alert.severity)
          const Icon = styles.Icon

          return (
            <div
              key={alert.id}
              className={`rounded-lg border p-3 ${styles.bg} ${styles.border}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${styles.textColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${styles.badgeColor}`}>
                      {alert.severity}
                    </span>
                    <span className={`text-xs font-semibold ${styles.textColor}`}>
                      {alert.event}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${styles.textColor}`}>
                    {alert.headline}
                  </p>
                  {alert.areaDesc && (
                    <p className={`text-xs mt-1 ${styles.textColor} opacity-75`}>
                      {alert.areaDesc}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
