/**
 * Weather alerts component tests
 *
 * Verifies that severe weather alerts are displayed with:
 * - Correct severity colors and icons
 * - Proper sorting (Extreme first)
 * - Alert details (headline, area, event type)
 */

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach } from 'vitest'

import { WeatherAlerts } from '../weather-alerts'

// Mock the server function
vi.mock('@/app/actions/weather', () => ({
  getAlerts: vi.fn(),
}))

const { getAlerts } = await import('@/app/actions/weather')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithQuery(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WeatherAlerts component', () => {
  it('renders null when no alerts', async () => {
    vi.mocked(getAlerts).mockResolvedValue([])

    const { container } = renderWithQuery(
      <WeatherAlerts lat={40.7128} lon={-74.006} />
    )

    // Should not render any card when no alerts
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(container.querySelector('[class*="Card"]')).not.toBeInTheDocument()
  })

  it('displays extreme alert in red with AlertTriangle icon', async () => {
    vi.mocked(getAlerts).mockResolvedValue([
      {
        id: 'tornado-1',
        event: 'Tornado Warning',
        severity: 'Extreme',
        headline: 'Tornado Warning issued for Dallas County',
        description: 'A tornado has been sighted...',
        onset: '2026-04-27T14:30:00-05:00',
        expires: '2026-04-27T15:30:00-05:00',
        areaDesc: 'Dallas',
      },
    ])

    renderWithQuery(<WeatherAlerts lat={32.7767} lon={-96.797} />)

    // Wait for query to resolve
    await screen.findByText('Tornado Warning')
    expect(screen.getByText('1 Weather Alert')).toBeInTheDocument()
    expect(screen.getByText('Extreme')).toBeInTheDocument()
    expect(screen.getByText('Tornado Warning issued for Dallas County')).toBeInTheDocument()
    expect(screen.getByText('Dallas')).toBeInTheDocument()
  })

  it('sorts alerts by severity (Extreme first)', async () => {
    vi.mocked(getAlerts).mockResolvedValue([
      {
        id: 'wind-1',
        event: 'Wind Advisory',
        severity: 'Moderate',
        headline: 'Wind Advisory issued',
        description: 'Gusty winds expected...',
        onset: '2026-04-27T12:00:00-05:00',
        expires: '2026-04-27T20:00:00-05:00',
        areaDesc: 'Area 1',
      },
      {
        id: 'tornado-1',
        event: 'Tornado Warning',
        severity: 'Extreme',
        headline: 'Tornado Warning - Imminent',
        description: 'A tornado has been sighted...',
        onset: '2026-04-27T14:30:00-05:00',
        expires: '2026-04-27T15:30:00-05:00',
        areaDesc: 'Area 2',
      },
      {
        id: 'storm-1',
        event: 'Severe Thunderstorm Warning',
        severity: 'Severe',
        headline: 'Severe Thunderstorm Warning issued',
        description: 'Large hail...',
        onset: '2026-04-27T14:00:00-05:00',
        expires: '2026-04-27T17:00:00-05:00',
        areaDesc: 'Area 3',
      },
    ])

    renderWithQuery(<WeatherAlerts lat={32.7767} lon={-96.797} />)

    await screen.findByText('3 Weather Alerts')

    const badges = screen.getAllByText(/Extreme|Severe|Moderate/)
    // First badge should be Extreme
    expect(badges[0].textContent).toBe('Extreme')
    // Second should be Severe
    expect(badges[1].textContent).toBe('Severe')
    // Third should be Moderate
    expect(badges[2].textContent).toBe('Moderate')
  })

  it('displays multiple alerts with correct color coding', async () => {
    vi.mocked(getAlerts).mockResolvedValue([
      {
        id: 'extreme-1',
        event: 'Tornado Warning',
        severity: 'Extreme',
        headline: 'Extreme Alert',
        description: 'desc',
        onset: '2026-04-27T14:30:00-05:00',
        expires: '2026-04-27T15:30:00-05:00',
        areaDesc: 'Area 1',
      },
      {
        id: 'severe-1',
        event: 'Severe Thunderstorm Warning',
        severity: 'Severe',
        headline: 'Severe Alert',
        description: 'desc',
        onset: '2026-04-27T14:00:00-05:00',
        expires: '2026-04-27T17:00:00-05:00',
        areaDesc: 'Area 2',
      },
    ])

    renderWithQuery(<WeatherAlerts lat={32.7767} lon={-96.797} />)

    await screen.findByText('2 Weather Alerts')
    expect(screen.getByText('Extreme')).toBeInTheDocument()
    expect(screen.getByText('Severe')).toBeInTheDocument()
    expect(screen.getByText('Extreme Alert')).toBeInTheDocument()
    expect(screen.getByText('Severe Alert')).toBeInTheDocument()
  })

  it('displays alert area description', async () => {
    vi.mocked(getAlerts).mockResolvedValue([
      {
        id: 'alert-1',
        event: 'Severe Thunderstorm Warning',
        severity: 'Severe',
        headline: 'Severe Thunderstorm Warning issued',
        description: 'Large hail and damaging winds...',
        onset: '2026-04-27T14:00:00-05:00',
        expires: '2026-04-27T17:00:00-05:00',
        areaDesc: 'New York County; Kings County; Queens County',
      },
    ])

    renderWithQuery(<WeatherAlerts lat={40.7128} lon={-74.006} />)

    await screen.findByText('Severe Thunderstorm Warning')
    expect(screen.getByText('New York County; Kings County; Queens County')).toBeInTheDocument()
  })
})
