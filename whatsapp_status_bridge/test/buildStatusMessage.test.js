// test/buildStatusMessage.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStatusMessage } = require('../src/buildStatusMessage');

const THRESHOLDS = {
  batteryLowPct: 20,
  pm25Threshold: 22,
  co2Threshold: 800,
  showerTempC: 35,
  gridImportThresholdW: 100,
  solarForecastHighKwh: 10,
};

const FIXED_NOW = new Date('2026-09-04T14:32:00');

function fakeHaClient(states) {
  return {
    ping: async () => true,
    getState: async (entityId) => {
      if (!(entityId in states)) throw new Error(`unexpected entity ${entityId}`);
      return states[entityId];
    },
  };
}

const HAPPY_PATH_STATES = {
  'binary_sensor.gate_open_confirmed': { state: 'off', attributes: {} },
  'sensor.solarman_battery_soc_2': { state: '82', attributes: {} },
  'sensor.solarman_grid_connected_status_2': { state: 'On-Grid', attributes: {} },
  'sensor.solarman_total_grid_power_2': { state: '500', attributes: {} },
  'sensor.solcast_pv_forecast_forecast_remaining_today': { state: '2', attributes: {} },
  'sensor.solarbot_110493863532580_geyser_1_internal_temp': { state: '45', attributes: {} },
  'sensor.solarbot_110493863532580_geyser_2_internal_temp': { state: '30', attributes: {} },
  'sensor.nobito_pm2_5': { state: '12', attributes: {} },
  'sensor.nobito_carbon_dioxide': { state: '650', attributes: {} },
  'fan.xiaomi_cpa4_6940_air_purifier': { state: 'on', attributes: { preset_mode: 'Auto' } },
  'fan.xiaomi_cpa4_b5e2_air_purifier': { state: 'on', attributes: { preset_mode: 'Auto' } },
  'weather.forecast_home': { state: 'sunny', attributes: { temperature: 24 } },
};

test('happy path renders every section with the right icons and quips', async () => {
  const haClient = fakeHaClient(HAPPY_PATH_STATES);
  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /Marais' Home Status/);
  assert.match(message, /Gate: \*Closed\* 🟢/);
  assert.match(message, /Battery: \*82%\* 🟢/);
  assert.match(message, /On Eskom — treating ourselves to some grid power today/);
  assert.match(message, /Main Geyser: \*45°C\* 🟢/);
  assert.match(message, /Boys Geyser: \*30°C\* 🔴/);
  assert.match(message, /Main Geyser — Boys is still sulking in the cold 🥶/);
  assert.match(message, /PM2\.5: \*12 µg\/m³\* 🟢/);
  assert.match(message, /CO2: \*650 ppm\* 🟢/);
  assert.match(message, /Blake Air Purifier: \*Auto\* 🟢/);
  assert.match(message, /Hayden Air Purifier: \*Auto\* 🟢/);
  assert.match(message, /Sunny and smug about it/);
});

test('an unavailable single entity renders N/A on its own line without failing the rest', async () => {
  const states = { ...HAPPY_PATH_STATES };
  delete states['sensor.nobito_pm2_5'];
  const haClient = {
    ping: async () => true,
    getState: async (entityId) => {
      if (entityId === 'sensor.nobito_pm2_5') throw new Error('unavailable');
      return HAPPY_PATH_STATES[entityId];
    },
  };

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /PM2\.5: ⚪ N\/A/);
  assert.match(message, /Gate: \*Closed\* 🟢/);
});

test('HA entirely unreachable returns a short explicit failure message, not a partial reply', async () => {
  const haClient = { ping: async () => false, getState: async () => { throw new Error('unreachable'); } };

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.equal(message, "⚠️ Home Assistant isn't responding right now — try again in a bit.");
});

test('grid down (Off-Grid) renders the Battery Only power check line', async () => {
  const states = {
    ...HAPPY_PATH_STATES,
    'sensor.solarman_grid_connected_status_2': { state: 'Off-Grid', attributes: {} },
  };
  const haClient = fakeHaClient(states);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /Battery Only — Eskom's on a coffee break/);
});

test('grid connected (On-Grid) with high import renders the On Eskom power check line', async () => {
  const haClient = fakeHaClient(HAPPY_PATH_STATES);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /On Eskom — treating ourselves to some grid power today/);
});

test('grid status unavailable falls back to the missing-entity default (treated as connected)', async () => {
  const states = {
    ...HAPPY_PATH_STATES,
    'sensor.solarman_grid_connected_status_2': { state: 'unavailable', attributes: {} },
    'sensor.solarman_total_grid_power_2': { state: '10', attributes: {} },
    'sensor.solcast_pv_forecast_forecast_remaining_today': { state: '2', attributes: {} },
  };
  const haClient = fakeHaClient(states);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  // Low import + low forecast + treated-as-connected => "holding its own", not Battery Only.
  assert.match(message, /Solar's holding its own — steady as she goes/);
  assert.doesNotMatch(message, /Battery Only/);
});

test('an unavailable (not just missing) entity renders N/A, not NaN', async () => {
  const states = {
    ...HAPPY_PATH_STATES,
    'sensor.nobito_pm2_5': { state: 'unavailable', attributes: {} },
  };
  const haClient = fakeHaClient(states);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /😷 PM2\.5: ⚪ N\/A/);
  assert.doesNotMatch(message, /NaN/);
});

test('one geyser unavailable renders that geyser as N/A, keeps the other reading, and skips Shower Call', async () => {
  const states = {
    ...HAPPY_PATH_STATES,
    'sensor.solarbot_110493863532580_geyser_1_internal_temp': { state: 'unavailable', attributes: {} },
  };
  const haClient = fakeHaClient(states);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /♨️ Main Geyser: ⚪ N\/A/);
  assert.match(message, /♨️ Boys Geyser: \*30°C\* 🔴/);
  assert.doesNotMatch(message, /Shower Call/);
});

test('a non-sunny weather condition renders a human-readable label, not the raw slug', async () => {
  const states = {
    ...HAPPY_PATH_STATES,
    'weather.forecast_home': { state: 'partlycloudy', attributes: { temperature: 18 } },
  };
  const haClient = fakeHaClient(states);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /Weather: \*18°C, Partly Cloudy\*/);
  assert.doesNotMatch(message, /partlycloudy/);
});

test('a powered-off purifier with a stale Favorite preset_mode shows Off, not red', async () => {
  const states = {
    ...HAPPY_PATH_STATES,
    'fan.xiaomi_cpa4_6940_air_purifier': { state: 'off', attributes: { preset_mode: 'Favorite' } },
  };
  const haClient = fakeHaClient(states);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /Blake Air Purifier: \*Off\* ⚪/);
});
