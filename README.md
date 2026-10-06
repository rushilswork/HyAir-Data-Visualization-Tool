# HyAir - Live Air Quality Map

Interactive air quality explorer for 14 Indian cities, built with plain ES modules (no build step).

**Features**
- Live readings (PM2.5, PM10, NO₂, SO₂, O₃, CO, AQI) from the free [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), no API key needed
- **US AQI** and an estimated **India NAQI** (CPCB breakpoints), switchable
- Colour-coded map, optional heat layer, city rankings and bar chart
- Click anywhere on the map, or use *My location*, to get air quality for that exact spot
- 3-day history + 3-day forecast trend, and a "best time outdoors" hint
- Pollutant radar with city-to-city comparison (as % of WHO guideline)
- Health advice for each AQI band, an [AQI guide](guide.html), CSV export, shareable links (`?city=delhi&metric=pm2_5&std=in`)
- Upload your own data (`lat,lon,aqi,pm2.5,pm10,so2,o3,co,no2,city`, see [sample-upload.csv](sample-upload.csv))
- Responsive, keyboard accessible, no secrets in the client

## Run

ES modules need http (not `file://`):

```bash
npx serve .
```

```bash
npm test
```

## Notes on the data
Values are **modelled** (CAMS, ~11 km grid), not single ground-sensor readings. NAQI is computed from hourly values although the official index uses 24h/8h averages, so it is an estimate.

## Layout
| File | Purpose |
|---|---|
| `js/aqi.js` | Pure AQI logic: NAQI, bands, upload parser (unit-tested) |
| `js/api.js` | Open-Meteo client |
| `js/app.js` | Map, charts, UI |
| `js/cities.js` | City list |
| `test/` | `node:test` unit tests |

Pages deploy as-is on GitHub Pages. Hyderabad-first roots, now for all of India.
