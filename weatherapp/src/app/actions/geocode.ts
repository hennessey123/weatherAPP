'use server'

export type GeocodeMatch = {
  matchedAddress: string
  lat: number
  lon: number
}

const FIPS_TO_STATE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP',
  '72': 'PR', '78': 'VI',
}

const STATE_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(FIPS_TO_STATE).map(([fips, abbr]) => [abbr, fips]),
)

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI',
  idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'puerto rico': 'PR',
}

type TigerFeature = {
  attributes: {
    BASENAME: string
    NAME: string
    STATE: string
    CENTLAT: string
    CENTLON: string
    AREALAND: string
  }
}

function parseQuery(raw: string): { city: string; stateFips: string | null } {
  const lower = raw.trim().toLowerCase()
  if (!lower) return { city: '', stateFips: null }

  // "city, state" form
  const comma = lower.split(',').map((s) => s.trim())
  if (comma.length === 2 && comma[1]) {
    const abbr =
      comma[1].length === 2
        ? comma[1].toUpperCase()
        : STATE_NAME_TO_ABBR[comma[1]]
    const fips = abbr ? STATE_TO_FIPS[abbr] : null
    return { city: comma[0], stateFips: fips ?? null }
  }

  // "city state" — last token is a 2-letter state abbr
  const tokens = lower.split(/\s+/)
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1]
    if (last.length === 2) {
      const fips = STATE_TO_FIPS[last.toUpperCase()]
      if (fips) return { city: tokens.slice(0, -1).join(' '), stateFips: fips }
    }
    // trailing state name (up to 3 words)
    for (const n of [3, 2]) {
      if (tokens.length > n) {
        const tail = tokens.slice(-n).join(' ')
        if (STATE_NAME_TO_ABBR[tail]) {
          return {
            city: tokens.slice(0, -n).join(' '),
            stateFips: STATE_TO_FIPS[STATE_NAME_TO_ABBR[tail]],
          }
        }
      }
    }
  }

  return { city: lower, stateFips: null }
}

// Strip anything that isn't a letter, digit, space, hyphen, period, or apostrophe.
// Prevents SQL injection into the ArcGIS WHERE clause.
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9 .'\-]/g, '').trim()
}

async function queryTigerLayer(
  layer: 4 | 5,
  city: string,
  stateFips: string | null,
): Promise<Array<GeocodeMatch & { area: number; exact: boolean }>> {
  const url = new URL(
    `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/${layer}/query`,
  )
  const safeCity = sanitize(city).replace(/'/g, "''")
  if (!safeCity) return []

  const clauses = [`UPPER(BASENAME) LIKE UPPER('${safeCity}%')`]
  if (stateFips) clauses.push(`STATE='${stateFips}'`)

  url.searchParams.set('where', clauses.join(' AND '))
  url.searchParams.set(
    'outFields',
    'BASENAME,NAME,STATE,CENTLAT,CENTLON,AREALAND',
  )
  url.searchParams.set('returnGeometry', 'false')
  url.searchParams.set('f', 'json')
  url.searchParams.set('resultRecordCount', '50')

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []

  const data = (await res.json()) as { features?: TigerFeature[] }
  return (data.features ?? []).map((f) => {
    const a = f.attributes
    const state = FIPS_TO_STATE[a.STATE] ?? a.STATE
    return {
      matchedAddress: `${a.NAME}, ${state}`,
      lat: parseFloat(a.CENTLAT),
      lon: parseFloat(a.CENTLON),
      area: parseFloat(a.AREALAND) || 0,
      exact: a.BASENAME.toLowerCase() === city.toLowerCase(),
    }
  })
}

export async function searchLocations(query: string): Promise<GeocodeMatch[]> {
  const { city, stateFips } = parseQuery(query)
  if (city.length < 2) return []

  const [incorporated, cdp] = await Promise.all([
    queryTigerLayer(4, city, stateFips),
    queryTigerLayer(5, city, stateFips),
  ])

  const seen = new Set<string>()
  const merged = [...incorporated, ...cdp].filter((m) => {
    if (seen.has(m.matchedAddress)) return false
    seen.add(m.matchedAddress)
    return true
  })

  // Rank: exact basename matches first, then larger places (area as pop proxy).
  merged.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1
    return b.area - a.area
  })

  return merged.slice(0, 8).map(({ matchedAddress, lat, lon }) => ({
    matchedAddress,
    lat,
    lon,
  }))
}
