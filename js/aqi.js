// Pure AQI helpers (no DOM) so they can be unit-tested in Node and reused in the browser.

export const BANDS = {
  us: [
    { max: 50, label: 'Good', color: '#2ecc71', advice: 'Air quality is satisfactory. Enjoy outdoor activities.' },
    { max: 100, label: 'Moderate', color: '#f1c40f', advice: 'Unusually sensitive people should consider limiting prolonged outdoor exertion.' },
    { max: 150, label: 'Unhealthy for sensitive groups', color: '#e67e22', advice: 'Children, older adults and people with asthma or heart disease should reduce outdoor exertion.' },
    { max: 200, label: 'Unhealthy', color: '#e74c3c', advice: 'Everyone may begin to feel effects. Limit prolonged outdoor exertion; consider a mask outdoors.' },
    { max: 300, label: 'Very unhealthy', color: '#9b59b6', advice: 'Health alert: avoid outdoor exertion and keep windows closed.' },
    { max: Infinity, label: 'Hazardous', color: '#7e0023', advice: 'Emergency conditions. Stay indoors with filtered air.' },
  ],
  in: [
    { max: 50, label: 'Good', color: '#2ecc71', advice: 'Minimal impact.' },
    { max: 100, label: 'Satisfactory', color: '#9acd32', advice: 'Minor breathing discomfort to sensitive people.' },
    { max: 200, label: 'Moderate', color: '#f1c40f', advice: 'Breathing discomfort for people with lung, heart disease, children and older adults.' },
    { max: 300, label: 'Poor', color: '#e67e22', advice: 'Breathing discomfort on prolonged exposure. Limit outdoor activity.' },
    { max: 400, label: 'Very poor', color: '#e74c3c', advice: 'Respiratory illness on prolonged exposure. Avoid outdoor activity.' },
    { max: Infinity, label: 'Severe', color: '#7e0023', advice: 'Affects healthy people and seriously impacts those with existing disease. Stay indoors.' },
  ],
}

// Indian National AQI breakpoints: [concLow, concHigh, indexLow, indexHigh].
// Concentrations are µg/m³ except CO (mg/m³). PM values are meant to be 24h averages and
// O3 an 8h average; this app feeds in the latest hourly value, so treat NAQI as an estimate.
const NAQI = {
  pm2_5: [[0, 30, 0, 50], [30, 60, 50, 100], [60, 90, 100, 200], [90, 120, 200, 300], [120, 250, 300, 400], [250, 500, 400, 500]],
  pm10: [[0, 50, 0, 50], [50, 100, 50, 100], [100, 250, 100, 200], [250, 350, 200, 300], [350, 430, 300, 400], [430, 600, 400, 500]],
  nitrogen_dioxide: [[0, 40, 0, 50], [40, 80, 50, 100], [80, 180, 100, 200], [180, 280, 200, 300], [280, 400, 300, 400], [400, 800, 400, 500]],
  ozone: [[0, 50, 0, 50], [50, 100, 50, 100], [100, 168, 100, 200], [168, 208, 200, 300], [208, 748, 300, 400], [748, 1000, 400, 500]],
  sulphur_dioxide: [[0, 40, 0, 50], [40, 80, 50, 100], [80, 380, 100, 200], [380, 800, 200, 300], [800, 1600, 300, 400], [1600, 2400, 400, 500]],
  carbon_monoxide: [[0, 1, 0, 50], [1, 2, 50, 100], [2, 10, 100, 200], [10, 17, 200, 300], [17, 34, 300, 400], [34, 50, 400, 500]],
}

export const POLLUTANTS = {
  us_aqi: { label: 'AQI', unit: '', who: null },
  pm2_5: { label: 'PM2.5', unit: 'µg/m³', who: 15 },
  pm10: { label: 'PM10', unit: 'µg/m³', who: 45 },
  nitrogen_dioxide: { label: 'NO₂', unit: 'µg/m³', who: 25 },
  sulphur_dioxide: { label: 'SO₂', unit: 'µg/m³', who: 40 },
  ozone: { label: 'O₃', unit: 'µg/m³', who: 100 },
  carbon_monoxide: { label: 'CO', unit: 'µg/m³', who: 4000 },
}

/** Sub-index for one pollutant under the Indian NAQI (null when the value is missing). */
export function naqiSubIndex(pollutant, value) {
  const table = NAQI[pollutant]
  if (!table || value == null || Number.isNaN(value) || value < 0) return null
  const v = pollutant === 'carbon_monoxide' ? value / 1000 : value // µg/m³ → mg/m³
  const last = table[table.length - 1]
  if (v >= last[1]) return last[3]
  const row = table.find(([, hi]) => v <= hi)
  const [cLo, cHi, iLo, iHi] = row
  return Math.round(iLo + ((v - cLo) / (cHi - cLo)) * (iHi - iLo))
}

/** Overall NAQI = worst sub-index. Returns {aqi, dominant} or null when no data. */
export function naqi(reading) {
  let best = null
  for (const key of Object.keys(NAQI)) {
    const idx = naqiSubIndex(key, reading[key])
    if (idx != null && (best == null || idx > best.aqi)) best = { aqi: idx, dominant: key }
  }
  return best
}

export function bandFor(aqi, standard = 'us') {
  if (aqi == null || Number.isNaN(aqi)) return { label: 'No data', color: '#7f8c8d', advice: 'No data available.' }
  return BANDS[standard].find((b) => aqi <= b.max)
}

/** AQI + dominant pollutant for a reading under the chosen standard. */
export function aqiFor(reading, standard = 'us') {
  if (standard === 'in') return naqi(reading) ?? { aqi: null, dominant: null }
  // Open-Meteo already returns the US AQI; find the pollutant that drives it from PM mostly.
  return { aqi: reading.us_aqi ?? null, dominant: dominantUs(reading) }
}

function dominantUs(r) {
  // Rough attribution using WHO-relative load: whichever pollutant most exceeds its guideline.
  let best = null
  for (const key of ['pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'carbon_monoxide']) {
    if (r[key] == null) continue
    const ratio = r[key] / POLLUTANTS[key].who
    if (best == null || ratio > best.ratio) best = { key, ratio }
  }
  return best?.key ?? null
}

/** Parse the legacy upload format: lat,lon,aqi,pm25,pm10,so2,o3,co,no2,city. Returns {rows, errors}. */
export function parseUpload(text) {
  const rows = []
  const errors = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return
    const p = line.split(',').map((s) => s.trim())
    const nums = p.slice(0, 9).map(Number)
    const city = p.slice(9).join(',')
    if (p.length < 10 || nums.some(Number.isNaN)) return errors.push(`Line ${i + 1}: expected 10 columns (9 numbers + city)`)
    const [lat, lon, aqi, pm2_5, pm10, sulphur_dioxide, ozone, carbon_monoxide, nitrogen_dioxide] = nums
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return errors.push(`Line ${i + 1}: latitude/longitude out of range`)
    rows.push({ name: city || `Point ${rows.length + 1}`, lat, lon, current: { us_aqi: aqi, pm2_5, pm10, sulphur_dioxide, ozone, carbon_monoxide, nitrogen_dioxide } })
  })
  return { rows, errors }
}

export function toCsv(rows) {
  const esc = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s)
  return rows.map((r) => r.map((c) => esc(String(c ?? ''))).join(',')).join('\n')
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Whichever of dark or white text is more readable on the given background colour. */
export function textOn(bg, dark = '#10161f') {
  return contrastRatio(bg, dark) >= contrastRatio(bg, '#ffffff') ? dark : '#ffffff'
}
