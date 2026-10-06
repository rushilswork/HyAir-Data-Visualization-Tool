// Open-Meteo Air Quality API: free, no key, CORS-enabled. https://open-meteo.com/en/docs/air-quality-api
const BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const CURRENT = 'us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone'

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Air quality service returned ${res.status}`)
  return res.json()
}

/** Latest reading for many places in one request. Returns an array aligned with `places`. */
export async function fetchCurrent(places) {
  const lat = places.map((p) => p.lat).join(',')
  const lon = places.map((p) => p.lon).join(',')
  const json = await getJson(`${BASE}?latitude=${lat}&longitude=${lon}&current=${CURRENT}&timezone=auto`)
  const list = Array.isArray(json) ? json : [json]
  return places.map((p, i) => ({ ...p, current: list[i]?.current ?? null, units: list[i]?.current_units }))
}

/** Hourly series: 3 days of history + 3 days of forecast for one place. */
export async function fetchHourly(place) {
  const json = await getJson(
    `${BASE}?latitude=${place.lat}&longitude=${place.lon}&hourly=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&past_days=3&forecast_days=3&timezone=auto`,
  )
  return json.hourly
}
