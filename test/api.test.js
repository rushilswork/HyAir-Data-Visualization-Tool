import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { fetchCurrent } from '../js/api.js'

const places = [{ name: 'A', lat: 17.385, lon: 78.4867 }, { name: 'B', lat: 28.6139, lon: 77.209 }]
let calls

beforeEach(() => {
  calls = 0
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  }
  globalThis.fetch = async () => {
    calls++
    return {
      ok: true,
      json: async () => [{ current: { us_aqi: 50 + calls }, current_units: {} }, { current: { us_aqi: 90 }, current_units: {} }],
    }
  }
})

test('second call within the TTL is served from the cache', async () => {
  const first = await fetchCurrent(places)
  const second = await fetchCurrent(places)
  assert.equal(calls, 1)
  assert.equal(second[0].current.us_aqi, first[0].current.us_aqi)
  assert.equal(second[1].name, 'B') // place fields are preserved
})

test('fresh: true bypasses the cache', async () => {
  await fetchCurrent(places)
  const again = await fetchCurrent(places, { fresh: true })
  assert.equal(calls, 2)
  assert.equal(again[0].current.us_aqi, 52)
})

test('different places do not share a cache entry', async () => {
  await fetchCurrent(places)
  await fetchCurrent([places[0]])
  assert.equal(calls, 2)
})

test('works when sessionStorage is unavailable', async () => {
  globalThis.sessionStorage = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  }
  const r = await fetchCurrent(places)
  assert.equal(r.length, 2)
  assert.equal(calls, 1)
})

test('API failure surfaces as an error', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  await assert.rejects(fetchCurrent(places), /503/)
})
