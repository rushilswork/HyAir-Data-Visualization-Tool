import { CITIES } from './cities.js'
import { fetchCurrent, fetchHourly } from './api.js'
import { POLLUTANTS, aqiFor, bandFor, parseUpload, toCsv, BANDS } from './aqi.js'

const $ = (id) => document.getElementById(id)
const state = {
  places: [], // [{name, lat, lon, current, custom?}]
  metric: 'aqi',
  standard: 'us',
  selected: null, // index into places
  compare: null,
  hours: 72,
  source: 'live',
  hourly: null,
  hourlyFor: null,
}
let map, markerLayer, heatLayer, charts = {}, hourlyToken = 0

Chart.defaults.color = '#9fb0c4'
Chart.defaults.borderColor = 'rgba(255,255,255,0.08)'
Chart.defaults.font.family = 'Inter, system-ui, sans-serif'

/* ---------- helpers ---------- */
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v
    else if (k === 'style') Object.assign(node.style, v)
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v)
  }
  for (const kid of kids) node.append(kid)
  return node
}

function toast(message, type = 'info') {
  const t = el('div', { class: `toast ${type}`, role: 'status' }, message)
  $('toasts').append(t)
  setTimeout(() => t.remove(), 4000)
}

// Pollutant colours are judged against the WHO 24h guideline: <=1x good ... >4x bad.
function pollutantBand(key, value) {
  if (value == null) return bandFor(null)
  const r = value / POLLUTANTS[key].who
  const pick = r <= 1 ? 0 : r <= 2 ? 1 : r <= 3 ? 2 : r <= 4 ? 3 : r <= 6 ? 4 : 5
  return { ...BANDS.us[pick], label: ['Within guideline', 'Up to 2x guideline', 'Up to 3x guideline', 'Up to 4x guideline', 'Up to 6x guideline', 'Over 6x guideline'][pick] }
}

function metricValue(place, metric = state.metric) {
  if (!place.current) return null
  if (metric === 'aqi') return aqiFor(place.current, state.standard).aqi
  return place.current[metric] ?? null
}

function metricBand(place) {
  const v = metricValue(place)
  return state.metric === 'aqi' ? bandFor(v, state.standard) : pollutantBand(state.metric, v)
}

const fmt = (v) => (v == null ? '-' : Number.isInteger(v) ? v : Math.round(v * 10) / 10)

/* ---------- URL state ---------- */
function writeUrl() {
  const p = new URLSearchParams()
  if (state.selected != null) {
    const place = state.places[state.selected]
    p.set('city', place.id ?? `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`)
  }
  if (state.metric !== 'aqi') p.set('metric', state.metric)
  if (state.standard !== 'us') p.set('std', state.standard)
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname)
}

/* ---------- map ---------- */
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([21.5, 79], 5)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)
  map.on('click', async (e) => {
    const { lat, lng } = e.latlng
    try {
      const [pt] = await fetchCurrent([{ name: `Pin ${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lon: lng, custom: true }])
      if (!pt.current) throw new Error('No data for this location')
      addCustom(pt)
    } catch (err) {
      toast(`Couldn't load that spot: ${err.message}`, 'error')
    }
  })
}

function addCustom(pt) {
  state.places = state.places.filter((p) => !p.custom).concat(pt)
  state.selected = state.places.length - 1
  render()
  map.flyTo([pt.lat, pt.lon], Math.max(map.getZoom(), 8), { duration: 0.8 })
}

function renderMap() {
  markerLayer.clearLayers()
  state.places.forEach((place, i) => {
    const band = metricBand(place)
    const v = metricValue(place)
    const icon = L.divIcon({
      className: 'aq-marker-wrap',
      html: `<div class="aq-marker${i === state.selected ? ' sel' : ''}" style="background:${band.color}">${fmt(v === null ? null : Math.round(v))}</div>`,
      iconSize: [44, 44],
    })
    const m = L.marker([place.lat, place.lon], { icon, title: `${place.name}: ${band.label}`, keyboard: true })
    m.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev)
      select(i, true)
    })
    markerLayer.addLayer(m)
  })
  if (heatLayer) {
    map.removeLayer(heatLayer)
    heatLayer = null
  }
  if ($('heat').checked && L.heatLayer) {
    const pts = state.places
      .filter((p) => metricValue(p) != null)
      .map((p) => [p.lat, p.lon, state.metric === 'aqi' ? Math.min(metricValue(p) / 300, 1) : Math.min(metricValue(p) / POLLUTANTS[state.metric].who / 5, 1)])
    heatLayer = L.heatLayer(pts, { radius: 55, blur: 40, maxZoom: 7, gradient: { 0.2: '#2ecc71', 0.4: '#f1c40f', 0.6: '#e67e22', 0.8: '#e74c3c', 1: '#7e0023' } }).addTo(map)
  }
  renderLegend()
}

function renderLegend() {
  const box = $('legend')
  box.replaceChildren()
  const bands = state.metric === 'aqi' ? BANDS[state.standard] : [0, 1, 2, 3, 4, 5].map((i) => pollutantBand(state.metric, POLLUTANTS[state.metric].who * [0.5, 1.5, 2.5, 3.5, 5, 7][i]))
  bands.forEach((b) => box.append(el('span', {}, el('i', { style: { background: b.color } }), b.label)))
}

/* ---------- panels ---------- */
function select(i, fly) {
  state.selected = i
  state.hourly = null
  render()
  const p = state.places[i]
  if (fly) map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), 8), { duration: 0.8 })
  loadHourly()
}

function renderDetail() {
  const p = state.places[state.selected]
  if (!p) return
  const { aqi, dominant } = aqiFor(p.current ?? {}, state.standard)
  const band = bandFor(aqi, state.standard)
  $('d-name').textContent = p.name
  $('d-aqi').textContent = fmt(aqi)
  $('d-band').textContent = band.label
  $('d-badge').style.background = band.color
  $('d-badge').style.color = ['#f1c40f', '#9acd32', '#2ecc71'].includes(band.color) ? '#10161f' : '#fff'
  $('d-advice').textContent = band.advice + (dominant ? ` Main driver: ${POLLUTANTS[dominant].label}.` : '')
  const grid = $('d-poll')
  grid.replaceChildren()
  for (const key of Object.keys(POLLUTANTS).filter((k) => k !== 'us_aqi')) {
    const v = p.current?.[key]
    const b = pollutantBand(key, v)
    grid.append(
      el('div', { class: 'poll', title: b.label },
        el('span', { class: 'dot', style: { background: b.color } }),
        el('span', { class: 'pl' }, POLLUTANTS[key].label),
        el('b', {}, fmt(v)),
        el('small', {}, POLLUTANTS[key].unit)),
    )
  }
  renderRadar()
}

function renderCompareOptions() {
  const sel = $('compare')
  const keep = state.compare
  sel.replaceChildren(el('option', { value: '' }, '- none -'))
  state.places.forEach((p, i) => {
    if (i !== state.selected) sel.append(el('option', { value: String(i) }, p.name))
  })
  sel.value = keep != null && keep !== state.selected ? String(keep) : ''
  if (sel.value === '') state.compare = null
}

function radarData(p) {
  const keys = Object.keys(POLLUTANTS).filter((k) => k !== 'us_aqi')
  return keys.map((k) => (p.current?.[k] != null ? Math.round((p.current[k] / POLLUTANTS[k].who) * 100) : 0))
}

function renderRadar() {
  const keys = Object.keys(POLLUTANTS).filter((k) => k !== 'us_aqi')
  const sets = [{ label: state.places[state.selected].name, data: radarData(state.places[state.selected]), borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.25)' }]
  if (state.compare != null && state.places[state.compare]) {
    sets.push({ label: state.places[state.compare].name, data: radarData(state.places[state.compare]), borderColor: '#f72585', backgroundColor: 'rgba(247,37,133,0.2)' })
  }
  draw('radar', {
    type: 'radar',
    data: { labels: keys.map((k) => POLLUTANTS[k].label), datasets: sets },
    options: {
      maintainAspectRatio: false,
      scales: { r: { beginAtZero: true, ticks: { backdropColor: 'transparent', callback: (v) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' } } },
      plugins: { legend: { display: sets.length > 1 }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw}% of WHO guideline` } } },
    },
  })
}

function renderRanking() {
  const order = state.places.map((p, i) => ({ p, i, v: metricValue(p) })).filter((r) => r.v != null).sort((a, b) => a.v - b.v)
  const body = document.querySelector('#ranking tbody')
  body.replaceChildren()
  order.forEach((r, rank) => {
    const band = metricBand(r.p)
    const tr = el('tr', { tabindex: '0', class: r.i === state.selected ? 'sel' : '', onclick: () => select(r.i, true), onkeydown: (e) => (e.key === 'Enter' ? select(r.i, true) : null) },
      el('td', {}, String(rank + 1)),
      el('td', {}, r.p.name),
      el('td', { style: { background: band.color, color: ['#f1c40f', '#9acd32', '#2ecc71'].includes(band.color) ? '#10161f' : '#fff', fontWeight: '700' } }, String(fmt(Math.round(r.v)))),
      el('td', {}, band.label))
    body.append(tr)
  })
  const metricLabel = state.metric === 'aqi' ? 'AQI' : POLLUTANTS[state.metric].label
  document.querySelector('#ranking th:nth-child(3)').textContent = metricLabel
  draw('bars', {
    type: 'bar',
    data: {
      labels: order.map((r) => r.p.name),
      datasets: [{ label: metricLabel, data: order.map((r) => Math.round(r.v)), backgroundColor: order.map((r) => metricBand(r.p).color), borderRadius: 6 }],
    },
    options: { maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  })
}

/* ---------- trend + best time ---------- */
async function loadHourly() {
  const p = state.places[state.selected]
  if (!p) return
  const token = ++hourlyToken
  $('t-title').textContent = `Trend - ${p.name}`
  try {
    const h = await fetchHourly(p)
    if (token !== hourlyToken) return // a newer selection superseded this one
    state.hourly = h
    renderTrend()
  } catch (err) {
    if (token === hourlyToken) toast(`Couldn't load trend: ${err.message}`, 'error')
  }
}

function hourlyValues(h) {
  return state.metric === 'aqi' ? hourlyAqi(h) : h[state.metric]
}

function hourlyAqi(h) {
  if (state.standard === 'us') return h.us_aqi
  return h.time.map((_, i) => {
    const r = {}
    for (const k of Object.keys(POLLUTANTS)) if (h[k]) r[k] = h[k][i]
    return aqiFor(r, 'in').aqi
  })
}

function renderTrend() {
  const h = state.hourly
  if (!h) return
  const p = state.places[state.selected]
  const nowIso = (p.current?.time ?? '').slice(0, 13)
  let nowIdx = h.time.findIndex((t) => t.startsWith(nowIso))
  if (nowIdx < 0) nowIdx = 72
  const half = state.hours / 2
  const from = Math.max(0, nowIdx - half)
  const to = Math.min(h.time.length, nowIdx + half + 1)
  const labels = h.time.slice(from, to).map((t) => t.replace('T', ' ').slice(5, 16))
  const values = hourlyValues(h).slice(from, to)
  const label = state.metric === 'aqi' ? (state.standard === 'us' ? 'US AQI' : 'NAQI (est.)') : POLLUTANTS[state.metric].label
  const nowLine = {
    id: 'nowLine',
    afterDraw(chart) {
      const x = chart.scales.x.getPixelForValue(nowIdx - from)
      const { top, bottom } = chart.chartArea
      const ctx = chart.ctx
      ctx.save()
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = '#ffffff99'
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x, bottom)
      ctx.stroke()
      ctx.restore()
    },
  }
  draw('trend', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label, data: values, tension: 0.35, pointRadius: 0, borderWidth: 2.5, fill: true,
        borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.12)',
        segment: { borderDash: (ctx) => (ctx.p0DataIndex + from >= nowIdx ? [6, 4] : undefined) },
      }],
    },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true } } },
    plugins: [nowLine],
  })

  // Best time outdoors: lowest AQI between 05:00 and 21:00 over the next 24h.
  const aqiSeries = hourlyAqi(h)
  let best = null
  for (let i = nowIdx; i < Math.min(nowIdx + 24, h.time.length); i++) {
    const hour = Number(h.time[i].slice(11, 13))
    if (hour < 5 || hour > 21 || aqiSeries[i] == null) continue
    if (best == null || aqiSeries[i] < best.v) best = { v: aqiSeries[i], t: h.time[i] }
  }
  $('d-best').textContent = best ? `Best time outdoors in the next 24h: ${best.t.slice(11, 16)} (AQI ~${Math.round(best.v)})` : ''
}

/* ---------- charts ---------- */
function draw(id, config) {
  charts[id]?.destroy()
  charts[id] = new Chart($(id), config)
}

/* ---------- render ---------- */
function render() {
  renderCompareOptions()
  renderMap()
  renderRanking()
  if (state.selected != null) renderDetail()
  if (state.hourly) renderTrend()
  writeUrl()
}

/* ---------- data ---------- */
async function loadLive(initialSelect) {
  try {
    const places = await fetchCurrent(CITIES.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })))
    const custom = state.places.filter((p) => p.custom)
    state.places = places.filter((p) => p.current).concat(custom)
    state.source = 'live'
    if (state.selected >= state.places.length) state.selected = 0
    $('reset').hidden = true
    $('updated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    if (initialSelect != null) {
      const idx = state.places.findIndex((p) => p.id === initialSelect)
      state.selected = idx >= 0 ? idx : 0
    } else if (state.selected == null) state.selected = 0
    render()
    loadHourly()
  } catch (err) {
    $('updated').textContent = 'Offline'
    toast(`Couldn't load live data: ${err.message}. Check your connection.`, 'error')
  }
}

function handleUpload(file) {
  if (!file) return
  if (file.size > 1_000_000) return toast('File too large (max 1 MB).', 'error')
  const reader = new FileReader()
  reader.onload = () => {
    const { rows, errors } = parseUpload(String(reader.result))
    if (!rows.length) return toast(errors[0] ?? 'No valid rows found.', 'error')
    state.places = rows
    state.source = 'upload'
    state.selected = 0
    state.hourly = null
    $('reset').hidden = false
    $('updated').textContent = `Showing ${rows.length} uploaded points`
    map.fitBounds(L.latLngBounds(rows.map((r) => [r.lat, r.lon])).pad(0.3))
    render()
    loadHourly()
    toast(errors.length ? `Loaded ${rows.length} rows, skipped ${errors.length} (${errors[0]})` : `Loaded ${rows.length} rows`, errors.length ? 'info' : 'success')
  }
  reader.onerror = () => toast('Could not read that file.', 'error')
  reader.readAsText(file)
}

function locate() {
  if (!('geolocation' in navigator)) return toast('Geolocation is not supported by this browser.', 'error')
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const [pt] = await fetchCurrent([{ name: 'My location', lat: coords.latitude, lon: coords.longitude, custom: true }])
        if (!pt.current) throw new Error('No data for your location')
        addCustom(pt)
        loadHourly()
      } catch (err) {
        toast(err.message, 'error')
      }
    },
    (err) => toast(err.code === 1 ? 'Location permission denied.' : 'Could not get your location.', 'error'),
    { timeout: 10000 },
  )
}

function exportCsv() {
  const rows = [['name', 'lat', 'lon', 'aqi', ...Object.keys(POLLUTANTS).filter((k) => k !== 'us_aqi')]]
  state.places.forEach((p) => rows.push([p.name, p.lat, p.lon, aqiFor(p.current ?? {}, state.standard).aqi, ...Object.keys(POLLUTANTS).filter((k) => k !== 'us_aqi').map((k) => p.current?.[k])]))
  const a = el('a', { href: URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' })), download: `hyair-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(a.href)
}

/* ---------- boot ---------- */
function boot() {
  const params = new URLSearchParams(location.search)
  const metrics = $('metric')
  metrics.append(el('option', { value: 'aqi' }, 'Air Quality Index'))
  for (const [k, v] of Object.entries(POLLUTANTS)) if (k !== 'us_aqi') metrics.append(el('option', { value: k }, v.label))
  if (params.get('metric') in POLLUTANTS) state.metric = params.get('metric')
  if (['us', 'in'].includes(params.get('std'))) state.standard = params.get('std')
  metrics.value = state.metric
  $('standard').value = state.standard

  initMap()
  metrics.addEventListener('change', (e) => { state.metric = e.target.value; render(); loadHourly() })
  $('standard').addEventListener('change', (e) => { state.standard = e.target.value; render() })
  $('heat').addEventListener('change', renderMap)
  $('locate').addEventListener('click', locate)
  $('upload').addEventListener('change', (e) => { handleUpload(e.target.files[0]); e.target.value = '' })
  $('reset').addEventListener('click', () => loadLive())
  $('csv').addEventListener('click', exportCsv)
  $('share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copied', 'success') } catch { toast('Copy failed - copy it from the address bar.', 'error') }
  })
  $('compare').addEventListener('change', (e) => { state.compare = e.target.value === '' ? null : Number(e.target.value); renderRadar() })
  $('range').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-h]')
    if (!b) return
    state.hours = Number(b.dataset.h)
    document.querySelectorAll('#range button').forEach((x) => x.classList.toggle('on', x === b))
    renderTrend()
  })

  const city = params.get('city')
  const m = city?.match(/^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$/)
  loadLive(m ? null : city).then(async () => {
    if (m) {
      const [pt] = await fetchCurrent([{ name: `Pin ${Number(m[1]).toFixed(2)}, ${Number(m[3]).toFixed(2)}`, lat: Number(m[1]), lon: Number(m[3]), custom: true }])
      if (pt.current) addCustom(pt), loadHourly()
    }
  })
  setInterval(() => { if (state.source === 'live') loadLive() }, 10 * 60 * 1000)
}

boot()
