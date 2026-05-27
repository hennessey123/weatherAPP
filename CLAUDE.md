# Weather App — Architecture & Ground Rules

## Stack
- **Next.js** (App Router) — React 19
- **shadcn/ui** — all UI components, no custom primitives
- **TanStack Query v5** — all client-side server state
- **Tailwind CSS v4** — styling
- **TypeScript** — strict mode

---

## 1. Server Functions for All Backend Logic

Every backend operation uses `'use server'` — no API routes, no route handlers.

```ts
// app/actions/weather.ts
'use server'

export async function getWeather(city: string) {
  const res = await fetch(`https://api.weather.com/...`)
  return res.json()
}
```

**Two ways server functions get called:**
- **Forms** — `<form action={serverFn}>`, receives `FormData`
- **Direct calls** — via TanStack Query `queryFn` / `mutationFn` from client components

Server functions are the only door to the backend. Never bypass them.

---

## 2. TanStack Query for All Client State

All server data flows through TanStack Query. Set `staleTime` thoughtfully — don't leave it at `0` (refetches constantly) or `Infinity` (never updates).

```tsx
// Reading data
const { data, isLoading } = useQuery({
  queryKey: ['weather', city],
  queryFn: () => getWeather(city),
  staleTime: 5 * 60 * 1000, // 5 min — weather doesn't change by the second
})

// Writing / triggering mutations
const save = useMutation({
  mutationFn: saveLocation,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
})
```

Query keys are the cache address. Design them like URL paths — specific enough to avoid collisions, general enough for targeted invalidation.

```ts
['weather', city]           // all weather for a city
['weather', city, 'hourly'] // just hourly forecast
```

---

## 3. NO useEffect — This Is the Core Rule

`useEffect` is a last resort, not a tool. Almost every use case has a better replacement.

### The Replacement Table

| You want to... | Don't do this | Do this instead |
|---|---|---|
| Fetch data on mount | `useEffect(() => fetch(...))` | `useQuery` |
| Refetch when a value changes | `useEffect([dep])` → fetch | `useQuery` with key that includes the dep |
| Run a mutation on user action | `useEffect` watching a flag | `useMutation` called in event handler |
| Derive a value from state/props | `useEffect` → `setState` | Compute inline or `useMemo` |
| Sync two pieces of state | `useEffect([a], () => setB(...))` | Remove the redundant state — derive B from A |
| Reset state when a prop changes | `useEffect([prop], () => reset())` | Put a `key={prop}` on the component |
| Subscribe to external store | `useEffect` + manual subscribe | `useSyncExternalStore` |
| DOM measurement / refs | Often `useEffect` | `useLayoutEffect` (sync) or a ref callback |
| One-time setup on mount | `useEffect([], ...)` | Move to Server Component, or use `useQuery` with `enabled` |

### Why This Architecture Makes useEffect Rare

In a typical React app, `useEffect` is used heavily because there's no clean way to fetch data or respond to async events. TanStack Query + Server Functions eliminate those use cases:

- **Data fetching** → `useQuery` handles loading, caching, deduplication, background refetch
- **Mutations** → `useMutation` handles optimistic updates, error states, invalidation
- **Server interaction** → Server functions are called directly, no client-side fetch boilerplate

The only valid `useEffect` uses are synchronizing with **non-React external systems**:
- Third-party widgets that imperatively manipulate the DOM
- `IntersectionObserver`, `ResizeObserver`, `MutationObserver`
- WebSocket connections (though prefer `useSyncExternalStore`)
- Non-React animation libraries

**If you write a `useEffect`, add a comment explaining why no alternative works.**

### Derive, Don't Sync

The biggest source of `useEffect` abuse is syncing derived state. Never store something that can be computed.

```tsx
// BAD — useEffect syncing derived state
const [filtered, setFiltered] = useState(items)
useEffect(() => {
  setFiltered(items.filter(i => i.active))
}, [items])

// GOOD — derive during render (free if cheap)
const filtered = items.filter(i => i.active)

// GOOD — memoize if genuinely expensive
const filtered = useMemo(() => items.filter(i => i.active), [items])
```

---

## 4. Rendering Architecture

**Server Components are the default.** Only add `'use client'` when you need interactivity.

| Concern | Where it lives |
|---|---|
| Data fetching for initial render | Server Component — just `await` it |
| Static layout, SEO content | Server Component |
| Forms, clicks, hover, animations | Client Component |
| TanStack Query hooks | Client Component |
| `useState`, `useRef` | Client Component |

Keep client boundaries as **small and as deep** in the tree as possible. A page can be a Server Component that passes data down to a small interactive island.

```tsx
// app/page.tsx — Server Component
export default async function Page() {
  const initialData = await getWeather('NYC') // runs on server
  return <WeatherCard initialData={initialData} />
}

// components/weather-card.tsx — Client Component
'use client'
export function WeatherCard({ initialData }) {
  const { data } = useQuery({
    queryKey: ['weather', 'NYC'],
    queryFn: () => getWeather('NYC'),
    initialData, // hydrate from server, then keep fresh
  })
  ...
}
```

---

## 5. State Ownership

Each piece of state has one home. Never duplicate.

| State type | Where it lives |
|---|---|
| Server data | TanStack Query cache |
| URL / navigation state | `searchParams` / `useRouter` |
| Local UI state (modals, tabs, toggles) | `useState` in the nearest component |
| Form input state | Uncontrolled via `FormData` or controlled `useState` |

If you find yourself copying TanStack Query data into `useState`, stop — you're creating a second source of truth that will drift.

---

## 6. shadcn/ui

Use it for everything. Don't build custom primitives when a shadcn component exists.

```bash
npx shadcn@latest add button card input skeleton
```

Customize via `className` and `cn()` utility — don't fork the component source unless absolutely necessary.

---

## 7. Severe Weather Alerts

The app fetches and displays active NWS alerts for any location via `getAlerts(lat, lon)`.

**Server function** (`app/actions/weather.ts`):
```ts
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

export async function getAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
  // Fetches from https://api.weather.gov/alerts/active?point=lat,lon
  // Returns array sorted by severity (Extreme first)
}
```

**Client component** (`components/weather-alerts.tsx`):
- Color-coded by severity: red (Extreme), orange (Severe), yellow (Moderate), blue (Minor)
- Icons: `AlertTriangle` for Extreme/Severe, `AlertCircle` for Moderate, `Info` for Minor
- Sorted by severity (Extreme first)
- Shows headline, affected area, event type
- Returns `null` if no alerts (clean UI when safe)
- Uses TanStack Query with 5-min staleTime

**Integration**:
- Appears between location search and weather display in weather-app.tsx
- Fetches whenever location changes
- Handles loading and error states gracefully

---

## 8. Test Suite

Run with `npm test` (Vitest). All 76 tests must pass before merging.

### Files

| File | Tests | What it covers |
|---|---|---|
| `__tests__/geocode.test.ts` | 10 | ZIP/city routing, input sanitization, error handling |
| `__tests__/geocode.location-accuracy.test.ts` | 35 | API call precision, coordinate passthrough, label assembly |
| `__tests__/geocode.ranking.test.ts` | 10 | Result sorting, deduplication, 8-result cap |
| `__tests__/weather.test.ts` | 21 | Hourly forecast (9), 7-day forecast (5), alerts (7) |

### Geocoding tests (55 total)

**geocode.test.ts — routing and sanitization**
- ZIP (5-digit) routes to ZCTA layer, city queries do not
- 3-digit and 4-digit prefixes use `LIKE` wildcard; 5-digit uses exact equality
- Reverse lookup enriches label; falls back to `"ZIP XXXXX"` when lookup is empty
- Failed fetch returns `[]`; 1-char and empty queries skip network
- SQL injection characters are stripped from city names

**geocode.location-accuracy.test.ts — API call precision**
- *ZIP WHERE clause*: exact 5-digit → `BASENAME='XXXXX'`; prefix → `BASENAME LIKE 'XXX%'`; leading zeros preserved
- *Coordinate passthrough*: lat/lon from ZCTA centroid appear verbatim in `geometry` param; tested across 3 individual ZIPs and multi-ZIP prefix
- *Known ZIP → label*: 8 well-known ZIPs verify final `"City, ST (ZIP)"` format and coordinates
- *City+state FIPS*: 13 query formats each assert correct FIPS code in `STATE=` clause
- *placeAtPoint fallback*: layer 4 tried first; layer 5 only if layer 4 empty; both empty → `"ZIP XXXXX"`

**geocode.ranking.test.ts — result sorting**
- Exact BASENAME match always ranks before partial match
- Within group, larger `AREALAND` ranks first
- Result set capped at 8 even if API returns more
- Same city from layers 4+5 deduplicated; same name in different states stays separate

### Weather tests (21 total)

**weather.test.ts — hourly forecast (9 tests)**
- Returns exactly 24 periods; slices if NWS provides more
- Data unchanged from NWS — no fabrication
- Coordinates routed to `/points/` with 4 decimal precision
- Errors throw with status code
- Handles fewer than 24 periods gracefully

**weather.test.ts — 7-day forecast (5 tests)**
- Returns all periods without truncation
- Data integrity verified (no invented fields)
- Coordinates routed correctly
- API errors propagate properly

**weather.test.ts — severe weather alerts (7 tests)**
- Returns empty array when no active alerts
- Displays multiple severity levels (Extreme, Severe, Moderate, Minor)
- Time windows (onset/expires) preserved correctly
- Coordinates to `/alerts/active` endpoint with 4 decimals
- Defaults to "Unknown" if severity missing
- Error handling and real-world Dallas tornado scenario

### Key implementation notes for tests

- `'use server'` files load via `vi.importActual` — directive ignored in Node.js
- `global.fetch` replaced per test via `vi.fn()`; `vi.restoreAllMocks()` in `beforeEach`
- `parseFloat` drops trailing zeros — avoid fixture lat/lon ending in `0`
- `placeAtPoint` tries both layers per ZIP (2 ZIPs × 2 layers = 4 calls); assert on unique coordinate set, not call count
