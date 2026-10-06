import test from 'node:test'
import assert from 'node:assert/strict'
import { naqiSubIndex, naqi, bandFor, aqiFor, parseUpload, toCsv } from '../js/aqi.js'

test('NAQI sub-index hits band edges', () => {
  assert.equal(naqiSubIndex('pm2_5', 0), 0)
  assert.equal(naqiSubIndex('pm2_5', 30), 50)
  assert.equal(naqiSubIndex('pm2_5', 60), 100)
  assert.equal(naqiSubIndex('pm2_5', 45), 75) // halfway through 30-60
  assert.equal(naqiSubIndex('pm2_5', 9999), 500) // capped
})

test('NAQI converts CO from ug/m3 to mg/m3', () => {
  assert.equal(naqiSubIndex('carbon_monoxide', 1000), 50) // 1 mg/m3
  assert.equal(naqiSubIndex('carbon_monoxide', 2000), 100)
})

test('NAQI handles missing / invalid input', () => {
  assert.equal(naqiSubIndex('pm10', null), null)
  assert.equal(naqiSubIndex('pm10', NaN), null)
  assert.equal(naqiSubIndex('pm10', -5), null)
  assert.equal(naqiSubIndex('nope', 5), null)
  assert.equal(naqi({}), null)
})

test('NAQI overall is the worst pollutant', () => {
  const r = naqi({ pm2_5: 20, pm10: 300, nitrogen_dioxide: 10 })
  assert.equal(r.dominant, 'pm10')
  assert.equal(r.aqi, naqiSubIndex('pm10', 300))
})

test('bands and fallbacks', () => {
  assert.equal(bandFor(50).label, 'Good')
  assert.equal(bandFor(51).label, 'Moderate')
  assert.equal(bandFor(999).label, 'Hazardous')
  assert.equal(bandFor(150, 'in').label, 'Moderate')
  assert.equal(bandFor(null).label, 'No data')
  assert.equal(aqiFor({ us_aqi: 88, pm2_5: 40 }, 'us').aqi, 88)
})

test('upload parser accepts valid rows and reports bad ones', () => {
  const { rows, errors } = parseUpload([
    '# comment',
    '17.4,78.5,90,30,60,3,10,400,5,Hyderabad',
    '17.4,78.5,abc,30,60,3,10,400,5,Bad',
    '95,78.5,90,30,60,3,10,400,5,OutOfRange',
    '1,2,3',
    '',
  ].join('\n'))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Hyderabad')
  assert.equal(rows[0].current.pm2_5, 30)
  assert.equal(errors.length, 3)
})

test('csv escaping', () => {
  assert.equal(toCsv([['a,b', 'c"d', 1]]), '"a,b","c""d",1')
})
