/**
 * Hourly forecast tests to verify data integrity
 *
 * These tests ensure getHourlyForecast returns authentic NWS data without
 * hallucination or fabrication:
 * - No invented forecast periods
 * - Exact 24-hour slice, no padding
 * - Data structure matches NWS response schema
 * - Coordinates routed correctly to NWS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../weather', async () => {
  const actual = await vi.importActual<typeof import('../weather')>('../weather')
  return actual
})

import { getHourlyForecast, getForecast, getAlerts } from '../weather'

// ─── helpers ──────────────────────────────────────────────────────────────────

function mockNwsFetch(handler: (url: string) => object) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString()
    const body = handler(url)
    return {
      ok: true,
      json: async () => body,
    } as Response
  })
}

function forecastPeriod(num: number, name: string) {
  return {
    number: num,
    name,
    startTime: `2026-04-27T${String(num).padStart(2, '0')}:00:00-04:00`,
    endTime: `2026-04-27T${String(num + 1).padStart(2, '0')}:00:00-04:00`,
    temperature: 70 + num,
    temperatureUnit: 'F',
    windSpeed: `${10 + num} mph`,
    windDirection: 'N',
    shortForecast: `Period ${num}`,
    detailedForecast: `Detailed forecast for period ${num}`,
    icon: 'https://example.com/icon.png',
    isDaytime: num >= 6 && num < 18,
  }
}

beforeEach(() => vi.restoreAllMocks())

// ─── Suite 1: Exact slice to 24 periods ───────────────────────────────────────

describe('hourly forecast returns exactly 24 periods', () => {
  it('returns 24 when NWS provides exactly 24', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/points/')) {
        return {
          properties: {
            forecast: 'https://example.com/forecast',
            forecastHourly: 'https://example.com/hourly',
          },
        }
      }
      if (url.includes('/hourly')) {
        return {
          properties: {
            periods: Array.from({ length: 24 }, (_, i) => forecastPeriod(i + 1, `Hour ${i + 1}`)),
          },
        }
      }
      return { properties: { periods: [] } }
    })

    const result = await getHourlyForecast(40.7128, -74.0060)
    expect(result).toHaveLength(24)
    expect(result[0].number).toBe(1)
    expect(result[23].number).toBe(24)
  })

  it('slices to 24 when NWS provides more than 24', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/points/')) {
        return {
          properties: {
            forecast: 'https://example.com/forecast',
            forecastHourly: 'https://example.com/hourly',
          },
        }
      }
      if (url.includes('/hourly')) {
        // NWS typically returns 156 periods (7 days)
        return {
          properties: {
            periods: Array.from({ length: 156 }, (_, i) => forecastPeriod(i + 1, `Hour ${i + 1}`)),
          },
        }
      }
      return { properties: { periods: [] } }
    })

    const result = await getHourlyForecast(40.7128, -74.0060)
    expect(result).toHaveLength(24)
    expect(result[0].number).toBe(1)
    expect(result[23].number).toBe(24)
    // Verify periods 25+ are NOT included
    expect(result.some((p) => p.number > 24)).toBe(false)
  })

  it('returns fewer than 24 when NWS provides fewer', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/points/')) {
        return {
          properties: {
            forecast: 'https://example.com/forecast',
            forecastHourly: 'https://example.com/hourly',
          },
        }
      }
      if (url.includes('/hourly')) {
        return {
          properties: {
            periods: Array.from({ length: 12 }, (_, i) => forecastPeriod(i + 1, `Hour ${i + 1}`)),
          },
        }
      }
      return { properties: { periods: [] } }
    })

    const result = await getHourlyForecast(40.7128, -74.0060)
    expect(result).toHaveLength(12)
  })
})

// ─── Suite 2: Data integrity — no fabrication ────────────────────────────────

describe('hourly forecast data structure integrity', () => {
  it('returns data unchanged from NWS (no invention)', async () => {
    const nwsPeriods = Array.from({ length: 24 }, (_, i) => ({
      number: i + 1,
      name: `Hour ${i + 1}`,
      startTime: `2026-04-27T${String(i).padStart(2, '0')}:00:00-04:00`,
      endTime: `2026-04-27T${String(i + 1).padStart(2, '0')}:00:00-04:00`,
      temperature: 65 + i,
      temperatureUnit: 'F',
      windSpeed: `${5 + i} mph`,
      windDirection: 'NE',
      shortForecast: `Condition ${i}`,
      detailedForecast: `Full details for hour ${i + 1}`,
      icon: `https://example.com/icon${i}.png`,
      isDaytime: i >= 6 && i < 18,
    }))

    mockNwsFetch((url) => {
      if (url.includes('/points/')) {
        return {
          properties: {
            forecast: 'https://example.com/forecast',
            forecastHourly: 'https://example.com/hourly',
          },
        }
      }
      if (url.includes('/hourly')) {
        return {
          properties: { periods: nwsPeriods },
        }
      }
      return { properties: { periods: [] } }
    })

    const result = await getHourlyForecast(40.7128, -74.0060)

    // Verify each returned period matches NWS input exactly
    result.forEach((period, idx) => {
      expect(period.number).toBe(nwsPeriods[idx].number)
      expect(period.temperature).toBe(nwsPeriods[idx].temperature)
      expect(period.shortForecast).toBe(nwsPeriods[idx].shortForecast)
      expect(period.windSpeed).toBe(nwsPeriods[idx].windSpeed)
      expect(period.icon).toBe(nwsPeriods[idx].icon)
    })
  })

  it('requires all required fields in response', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/points/')) {
        return {
          properties: {
            forecast: 'https://example.com/forecast',
            forecastHourly: 'https://example.com/hourly',
          },
        }
      }
      if (url.includes('/hourly')) {
        return {
          properties: {
            periods: [
              {
                number: 1,
                name: 'Hour 1',
                startTime: '2026-04-27T00:00:00-04:00',
                endTime: '2026-04-27T01:00:00-04:00',
                temperature: 70,
                temperatureUnit: 'F',
                windSpeed: '10 mph',
                windDirection: 'N',
                shortForecast: 'Sunny',
                detailedForecast: 'Sunny conditions',
                icon: 'https://example.com/icon.png',
                isDaytime: true,
              },
            ],
          },
        }
      }
      return { properties: { periods: [] } }
    })

    const result = await getHourlyForecast(40.7128, -74.0060)
    const period = result[0]

    // Verify no undefined fields — all required properties present
    expect(period.number).toBeDefined()
    expect(period.name).toBeDefined()
    expect(period.temperature).toBeDefined()
    expect(period.shortForecast).toBeDefined()
    expect(period.icon).toBeDefined()
  })
})

// ─── Suite 3: Coordinate routing ──────────────────────────────────────────────

describe('coordinates routed correctly to NWS', () => {
  it('calls /points with lat/lon formatted to 4 decimals', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/points/')) {
        expect(url).toContain('/points/40.7128,-74.0060')
        return {
          ok: true,
          json: async () => ({
            properties: {
              forecast: 'https://example.com/forecast',
              forecastHourly: 'https://example.com/hourly',
            },
          }),
        } as Response
      }
      if (url.includes('/hourly')) {
        return {
          ok: true,
          json: async () => ({
            properties: { periods: [forecastPeriod(1, 'Hour 1')] },
          }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    global.fetch = fetchMock
    await getHourlyForecast(40.7128, -74.006)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('handles rounding correctly (5 decimal places round to 4)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/points/')) {
        // 40.712846 rounded to 4 decimals = 40.7128
        expect(url).toContain('/points/40.7128,-74.0060')
        return {
          ok: true,
          json: async () => ({
            properties: {
              forecast: 'https://example.com/forecast',
              forecastHourly: 'https://example.com/hourly',
            },
          }),
        } as Response
      }
      if (url.includes('/hourly')) {
        return {
          ok: true,
          json: async () => ({
            properties: { periods: [forecastPeriod(1, 'Hour 1')] },
          }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    global.fetch = fetchMock
    await getHourlyForecast(40.712846, -74.00597)
    expect(fetchMock).toHaveBeenCalled()
  })
})

// ─── Suite 4: Error handling ───────────────────────────────────────────────────

describe('error handling', () => {
  it('throws and includes status code on non-ok response', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/points/')) {
        return { ok: false, status: 404, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    await expect(getHourlyForecast(40.7128, -74.0060)).rejects.toThrow(
      /NWS 404/,
    )
  })

  it('throws on hourly forecast API error', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/points/')) {
        return {
          ok: true,
          json: async () => ({
            properties: {
              forecast: 'https://example.com/forecast',
              forecastHourly: 'https://example.com/hourly',
            },
          }),
        } as Response
      }
      if (url.includes('/hourly')) {
        return { ok: false, status: 500, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    await expect(getHourlyForecast(40.7128, -74.0060)).rejects.toThrow(
      /NWS 500/,
    )
  })
})

// ─── Suite 5: 7-day forecast — no data manipulation ────────────────────────────

describe('7-day forecast (getForecast)', () => {
  it('returns all periods from NWS without truncation', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/points/')) {
        return {
          properties: {
            forecast: 'https://example.com/forecast',
            forecastHourly: 'https://example.com/hourly',
          },
        }
      }
      if (url.includes('/forecast') && !url.includes('Hourly')) {
        // NWS returns ~14 periods for 7 days (day/night alternating)
        return {
          properties: {
            periods: Array.from({ length: 14 }, (_, i) => forecastPeriod(i + 1, `Period ${i + 1}`)),
          },
        }
      }
      return { properties: { periods: [] } }
    })

    const result = await getForecast(40.7128, -74.0060)
    expect(result).toHaveLength(14)
  })

  it('returns data unchanged from NWS — no fabrication', async () => {
    const nwsPeriods = Array.from({ length: 7 }, (_, i) => ({
      number: i + 1,
      name: `Day ${i + 1}`,
      startTime: `2026-04-${27 + i}T06:00:00-04:00`,
      endTime: `2026-04-${28 + i}T06:00:00-04:00`,
      temperature: 70 + i * 5,
      temperatureUnit: 'F',
      windSpeed: `${10 + i * 2} mph`,
      windDirection: 'NE',
      shortForecast: `Forecast day ${i + 1}`,
      detailedForecast: `Detailed forecast for day ${i + 1}`,
      icon: `https://example.com/day${i}.png`,
      isDaytime: true,
    }))

    mockNwsFetch((url) => {
      if (url.includes('/points/')) {
        return {
          properties: {
            forecast: 'https://example.com/forecast',
            forecastHourly: 'https://example.com/hourly',
          },
        }
      }
      if (url.includes('/forecast') && !url.includes('Hourly')) {
        return { properties: { periods: nwsPeriods } }
      }
      return { properties: { periods: [] } }
    })

    const result = await getForecast(40.7128, -74.0060)

    result.forEach((period, idx) => {
      expect(period.number).toBe(nwsPeriods[idx].number)
      expect(period.temperature).toBe(nwsPeriods[idx].temperature)
      expect(period.windSpeed).toBe(nwsPeriods[idx].windSpeed)
      expect(period.shortForecast).toBe(nwsPeriods[idx].shortForecast)
    })
  })

  it('calls /points with correct coordinates', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/points/')) {
        expect(url).toContain('/points/34.0522,-118.2437')
        return {
          ok: true,
          json: async () => ({
            properties: {
              forecast: 'https://example.com/forecast',
              forecastHourly: 'https://example.com/hourly',
            },
          }),
        } as Response
      }
      if (url.includes('/forecast')) {
        return {
          ok: true,
          json: async () => ({
            properties: { periods: [forecastPeriod(1, 'Period 1')] },
          }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    global.fetch = fetchMock
    await getForecast(34.0522, -118.2437)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('throws on points API error', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/points/')) {
        return { ok: false, status: 403, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    await expect(getForecast(40.7128, -74.0060)).rejects.toThrow(/NWS 403/)
  })

  it('throws on forecast API error', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/points/')) {
        return {
          ok: true,
          json: async () => ({
            properties: {
              forecast: 'https://example.com/forecast',
              forecastHourly: 'https://example.com/hourly',
            },
          }),
        } as Response
      }
      if (url.includes('/forecast') && !url.includes('Hourly')) {
        return { ok: false, status: 502, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    await expect(getForecast(40.7128, -74.0060)).rejects.toThrow(/NWS 502/)
  })
})

// ─── Suite 6: Severe weather alerts ────────────────────────────────────────────

describe('severe weather alerts (getAlerts)', () => {
  it('returns empty array when no alerts', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/alerts/active')) {
        return { features: [] }
      }
      return { features: [] }
    })

    const result = await getAlerts(40.7128, -74.0060)
    expect(result).toEqual([])
  })

  it('returns multiple alerts with correct severity levels', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/alerts/active')) {
        return {
          features: [
            {
              properties: {
                id: 'alert-1',
                event: 'Tornado Warning',
                severity: 'Extreme',
                headline: 'Tornado Warning issued for New York County',
                description: 'A tornado warning has been issued...',
                onset: '2026-04-27T14:30:00-04:00',
                expires: '2026-04-27T15:30:00-04:00',
                areaDesc: 'New York County',
              },
            },
            {
              properties: {
                id: 'alert-2',
                event: 'Severe Thunderstorm Warning',
                severity: 'Severe',
                headline: 'Severe Thunderstorm Warning issued',
                description: 'Large hail and damaging winds expected...',
                onset: '2026-04-27T14:00:00-04:00',
                expires: '2026-04-27T17:00:00-04:00',
                areaDesc: 'Kings County; Queens County',
              },
            },
            {
              properties: {
                id: 'alert-3',
                event: 'Wind Advisory',
                severity: 'Moderate',
                headline: 'Wind Advisory issued',
                description: 'Gusty winds expected...',
                onset: '2026-04-27T12:00:00-04:00',
                expires: '2026-04-27T20:00:00-04:00',
                areaDesc: 'New York County; Kings County',
              },
            },
          ],
        }
      }
      return { features: [] }
    })

    const result = await getAlerts(40.7128, -74.0060)
    expect(result).toHaveLength(3)

    // Verify Extreme (tornado)
    const tornado = result.find((a) => a.event === 'Tornado Warning')
    expect(tornado).toBeDefined()
    expect(tornado?.severity).toBe('Extreme')
    expect(tornado?.headline).toContain('Tornado Warning')

    // Verify Severe (thunderstorm)
    const thunderstorm = result.find((a) => a.event === 'Severe Thunderstorm Warning')
    expect(thunderstorm).toBeDefined()
    expect(thunderstorm?.severity).toBe('Severe')

    // Verify Moderate (wind advisory)
    const windAdvisor = result.find((a) => a.event === 'Wind Advisory')
    expect(windAdvisor).toBeDefined()
    expect(windAdvisor?.severity).toBe('Moderate')
  })

  it('handles alerts with time windows correctly', async () => {
    const now = '2026-04-27T14:30:00-04:00'
    const oneHourLater = '2026-04-27T15:30:00-04:00'

    mockNwsFetch((url) => {
      if (url.includes('/alerts/active')) {
        return {
          features: [
            {
              properties: {
                id: 'tornado-1',
                event: 'Tornado Warning',
                severity: 'Extreme',
                headline: 'Tornado Warning - Imminent',
                description: 'A tornado has been sighted...',
                onset: now,
                expires: oneHourLater,
                areaDesc: 'Manhattan',
              },
            },
          ],
        }
      }
      return { features: [] }
    })

    const result = await getAlerts(40.7128, -74.0060)
    expect(result[0].onset).toBe(now)
    expect(result[0].expires).toBe(oneHourLater)
  })

  it('routes coordinates with 4-decimal precision', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/alerts/active')) {
        expect(url).toContain('point=34.0522,-118.2437')
        return {
          ok: true,
          json: async () => ({ features: [] }),
        } as Response
      }
      return { ok: true, json: async () => ({ features: [] }) } as Response
    })

    global.fetch = fetchMock
    await getAlerts(34.0522, -118.2437)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('defaults to Unknown severity if missing', async () => {
    mockNwsFetch((url) => {
      if (url.includes('/alerts/active')) {
        return {
          features: [
            {
              properties: {
                id: 'unknown-alert',
                event: 'Unknown Event',
                severity: null,
                headline: 'Unknown alert with no severity',
                description: 'Description',
                onset: '2026-04-27T14:00:00-04:00',
                expires: '2026-04-27T16:00:00-04:00',
                areaDesc: 'Some area',
              },
            },
          ],
        }
      }
      return { features: [] }
    })

    const result = await getAlerts(40.7128, -74.0060)
    expect(result[0].severity).toBe('Unknown')
  })

  it('throws on API error', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/alerts/active')) {
        return { ok: false, status: 503, json: async () => ({}) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    await expect(getAlerts(40.7128, -74.0060)).rejects.toThrow(/NWS 503/)
  })

  it('simulates real-world severe weather scenario', async () => {
    // Scenario: Tornado warning followed by severe thunderstorm warning
    mockNwsFetch((url) => {
      if (url.includes('/alerts/active')) {
        return {
          features: [
            {
              properties: {
                id: 'wtus45kdmx.dc74c64fa4b3c37.5e234f93c4c7.000.0001.2604271630-000300',
                event: 'Tornado Warning',
                severity: 'Extreme',
                headline:
                  'Tornado Warning issued April 27 at 2:30 PM CDT until April 27 at 3:15 PM CDT by NWS',
                description:
                  'A TORNADO HAS BEEN SIGHTED AND IS LOCATED 8 MILES NORTH OF DALLAS...MOVING NORTHEAST AT 45 MPH...THIS IS AN EXTREMELY DANGEROUS AND RARE SITUATION. FLYING DEBRIS WILL BE DEADLY TO THOSE CAUGHT WITHOUT SHELTER. AIRBORNE PROJECTILES FROM THE WINDSTORM WILL ADD TO THE CARNAGE. PERSONS NOT IN A BASEMENT WITH THICK CONCRETE WALLS WILL HAVE LITTLE PROTECTION AGAINST THE WINDS EXUDING THIS VORTEX.',
                onset: '2026-04-27T14:30:00-05:00',
                expires: '2026-04-27T15:15:00-05:00',
                areaDesc: 'Dallas; Collin',
              },
            },
            {
              properties: {
                id: 'wtus45kdmx.dc74c64fa4b3c37.5e234f93c4c8.000.0001.2604271650-000200',
                event: 'Severe Thunderstorm Warning',
                severity: 'Severe',
                headline:
                  'Severe Thunderstorm Warning issued April 27 at 2:50 PM CDT until April 27 at 5:00 PM CDT by NWS',
                description:
                  'A SEVERE THUNDERSTORM WARNING REMAINS IN EFFECT UNTIL 500 PM CDT FOR DENTON...TARRANT AND COLLIN COUNTIES. HAZARD...DAMAGING WINDS...LARGE HAIL AND ISOLATED TORNADOES. IMPACTS...POWER OUTAGES AND EXTENSIVE DAMAGE TO ROOFS...SIDING AND TREES ARE LIKELY.',
                onset: '2026-04-27T14:50:00-05:00',
                expires: '2026-04-27T17:00:00-05:00',
                areaDesc: 'Tarrant; Denton; Collin',
              },
            },
            {
              properties: {
                id: 'wous45kdmx.dc74c64fa4b3c37.5e234f93c4c9.000.0001.2604271700-000100',
                event: 'Flash Flood Watch',
                severity: 'Moderate',
                headline: 'Flash Flood Watch issued April 27 at 3:00 PM CDT until April 28 at 7:00 AM CDT by NWS',
                description:
                  'FLASH FLOOD WATCH REMAINS IN EFFECT THROUGH TUESDAY MORNING FOR THE ENTIRE AREA. RAINFALL RATES UP TO 2 INCHES PER HOUR ARE POSSIBLE.',
                onset: '2026-04-27T15:00:00-05:00',
                expires: '2026-04-28T07:00:00-05:00',
                areaDesc: 'Entire watchable area',
              },
            },
          ],
        }
      }
      return { features: [] }
    })

    const result = await getAlerts(32.7767, -96.797)
    expect(result).toHaveLength(3)

    // Verify alert ordering: all critical alerts present
    const extremeAlerts = result.filter((a) => a.severity === 'Extreme')
    const severeAlerts = result.filter((a) => a.severity === 'Severe')
    const moderateAlerts = result.filter((a) => a.severity === 'Moderate')

    expect(extremeAlerts).toHaveLength(1)
    expect(extremeAlerts[0].event).toBe('Tornado Warning')

    expect(severeAlerts).toHaveLength(1)
    expect(severeAlerts[0].event).toBe('Severe Thunderstorm Warning')

    expect(moderateAlerts).toHaveLength(1)
    expect(moderateAlerts[0].event).toBe('Flash Flood Watch')

    // Verify all alerts have required fields populated
    result.forEach((alert) => {
      expect(alert.id).toBeDefined()
      expect(alert.event).toBeDefined()
      expect(alert.severity).toBeDefined()
      expect(alert.headline).toBeDefined()
      expect(alert.onset).toBeDefined()
      expect(alert.expires).toBeDefined()
    })
  })
})
