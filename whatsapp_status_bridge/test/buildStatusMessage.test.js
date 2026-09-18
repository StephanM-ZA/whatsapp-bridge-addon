// test/buildStatusMessage.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStatusMessage } = require('../src/buildStatusMessage');
const { defaults } = require('../src/copyDefaults');

const THRESHOLDS = {
  batteryLowPct: 20,
  pm25Threshold: 22,
  co2Threshold: 800,
  showerTempC: 35,
  gridImportThresholdW: 100,
  solarForecastHighKwh: 10,
};

const FIXED_NOW = new Date('2026-09-04T14:32:00');

const DEFAULT_FORECAST_TODAY = { temperature: 24, templow: 15 };

function fakeHaClient(states, { forecastToday = DEFAULT_FORECAST_TODAY } = {}) {
  return {
    ping: async () => true,
    getState: async (entityId) => {
      if (!(entityId in states)) throw new Error(`unexpected entity ${entityId}`);
      return states[entityId];
    },
    callService: async (domain, service, serviceData) => {
      if (domain === 'weather' && service === 'get_forecasts') {
        if (!forecastToday) throw new Error('forecast unavailable');
        return { service_response: { [serviceData.entity_id]: { forecast: [forecastToday] } } };
      }
      throw new Error(`unexpected service call ${domain}.${service}`);
    },
  };
}

const HAPPY_PATH_STATES = {
  'binary_sensor.gate_open_confirmed': { state: 'off', attributes: {} },
  'sensor.solarman_battery_soc_2': { state: '82', attributes: {} },
  'sensor.solarman_grid_connected_status_2': { state: 'On-Grid', attributes: {} },
  'sensor.solarman_total_grid_power_2': { state: '500', attributes: {} },
  'sensor.solcast_pv_forecast_forecast_remaining_today': { state: '2', attributes: {} },
  'sensor.solarbot_110493863532580_geyser_2_internal_temp': { state: '45', attributes: {} },
  'sensor.solarbot_110493863532580_geyser_1_internal_temp': { state: '30', attributes: {} },
  'sensor.nobito_pm2_5': { state: '12', attributes: {} },
  'sensor.nobito_carbon_dioxide': { state: '650', attributes: {} },
  'fan.xiaomi_cpa4_6940_air_purifier': { state: 'on', attributes: { preset_mode: 'Auto' } },
  'fan.xiaomi_cpa4_b5e2_air_purifier': { state: 'on', attributes: { preset_mode: 'Auto' } },
  'weather.forecast_home': { state: 'sunny', attributes: { temperature: 24 } },
};

test('happy path renders every section with the right icons and quips', async () => {
  const haClient = fakeHaClient(HAPPY_PATH_STATES);
  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /🏠 \*Home Status\*/);
  assert.match(message, /Low\/High: \*15°C \/ 24°C\*/);
  assert.match(message, /Gate: \*Closed\* 🟢/);
  assert.match(message, /Battery: \*82%\* 🟢/);
  assert.match(message, /On Eskom — treating ourselves to some grid power today/);
  assert.match(message, /Main Geyser: \*45°C\* 🟢/);
  assert.match(message, /Second Geyser: \*30°C\* 🔴/);
  assert.match(message, /Main Geyser — the other one's still sulking in the cold 🥶/);
  assert.match(message, /PM2\.5: \*12 µg\/m³\* 🟢/);
  assert.match(message, /CO2: \*650 ppm\* 🟢/);
  assert.match(message, /Air Check: Crisp as a mountain breeze in here — nothing to see, folks 🌬️✨/);
  assert.match(message, /Air Purifier 1: \*Auto\* 🟢/);
  assert.match(message, /Air Purifier 2: \*Auto\* 🟢/);
  assert.match(message, /Sunny and smug about it/);
});

test('a failing forecast call still renders current weather, just without the Low/High line', async () => {
  const haClient = fakeHaClient(HAPPY_PATH_STATES, { forecastToday: null });

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /Weather: \*24°C, Sunny\*/);
  assert.doesNotMatch(message, /Low\/High/);
});

test('a haClient without callService (older test double) still renders weather, just without Low/High', async () => {
  const haClient = {
    ping: async () => true,
    getState: async (entityId) => HAPPY_PATH_STATES[entityId],
  };

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /Weather: \*24°C, Sunny\*/);
  assert.doesNotMatch(message, /Low\/High/);
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
  assert.doesNotMatch(message, /Air Check/);
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
    'sensor.solarbot_110493863532580_geyser_2_internal_temp': { state: 'unavailable', attributes: {} },
  };
  const haClient = fakeHaClient(states);

  const message = await buildStatusMessage(haClient, THRESHOLDS, FIXED_NOW);

  assert.match(message, /♨️ Main Geyser: ⚪ N\/A/);
  assert.match(message, /♨️ Second Geyser: \*30°C\* 🔴/);
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

  assert.match(message, /Air Purifier 1: \*Off\* ⚪/);
});


// ---- the editable copy document actually drives the message ---------------
//
// The tests above prove the DEFAULTS still render exactly what they always
// did. These prove the document is really in charge - without them the whole
// refactor could be inert and every test would still pass.

test('renaming a label changes the message', async () => {
  const copy = defaults();
  copy.sections.find((s) => s.id === 'gate').labels.gate = '🛡️ Front Gate';
  const msg = await buildStatusMessage(fakeHaClient(HAPPY_PATH_STATES), THRESHOLDS, FIXED_NOW, copy);
  assert.ok(msg.includes('🛡️ Front Gate:'));
  assert.ok(!msg.includes('🚪 Gate:'));
});

test('disabling a section removes it, and leaves no orphan divider', async () => {
  const copy = defaults();
  copy.sections.find((s) => s.id === 'gate').enabled = false;
  const msg = await buildStatusMessage(fakeHaClient(HAPPY_PATH_STATES), THRESHOLDS, FIXED_NOW, copy);
  assert.ok(!msg.includes('Gate:'));
  assert.ok(!msg.trimEnd().endsWith(copy.strings.divider));
  // one fewer section means one fewer divider
  const dividers = msg.split('\n').filter((l) => l === copy.strings.divider).length;
  assert.equal(dividers, copy.sections.filter((s) => s.enabled !== false).length - 1);
});

test('reordering sections reorders the message', async () => {
  const copy = defaults();
  const ids = ['purifiers', 'weather', 'gate', 'battery', 'geysers', 'air'];
  copy.sections = ids.map((id) => defaults().sections.find((s) => s.id === id));
  const msg = await buildStatusMessage(fakeHaClient(HAPPY_PATH_STATES), THRESHOLDS, FIXED_NOW, copy);
  const body = msg.split('\n').slice(4).join('\n');   // past the header
  assert.ok(body.indexOf('Air Purifier 1') < body.indexOf('Weather:'));
});

test('a rewritten quip is the one that appears', async () => {
  // The fixture is 45C and 30C against a 35C threshold, so this is the
  // mainOnly branch - overriding bothReady would pass whatever the code did.
  const copy = defaults();
  copy.quips.showerCall.mainOnly = 'Main only. Second is sulking.';
  const msg = await buildStatusMessage(fakeHaClient(HAPPY_PATH_STATES), THRESHOLDS, FIXED_NOW, copy);
  assert.ok(msg.includes('Main only. Second is sulking.'));
  assert.ok(!msg.includes("still sulking in the cold"));
});

test('the OTHER quip branches are reachable too', async () => {
  const copy = defaults();
  copy.quips.showerCall.bothReady = 'Both hot.';
  const hot = { ...HAPPY_PATH_STATES,
    'sensor.solarbot_110493863532580_geyser_1_internal_temp': { state: '50', attributes: {} } };
  const msg = await buildStatusMessage(fakeHaClient(hot), THRESHOLDS, FIXED_NOW, copy);
  assert.ok(msg.includes('Both hot.'));
});

test('the header and divider are editable', async () => {
  const copy = defaults();
  copy.strings.title = '🏡 *Casa*';
  copy.strings.divider = '~~~~~';
  const msg = await buildStatusMessage(fakeHaClient(HAPPY_PATH_STATES), THRESHOLDS, FIXED_NOW, copy);
  assert.ok(msg.startsWith('🏡 *Casa*'));
  assert.ok(msg.includes('~~~~~'));
  assert.ok(!msg.includes('──────────'));
});

test('the unreachable message is editable too', async () => {
  const copy = defaults();
  copy.strings.unreachable = 'HA is asleep.';
  const down = { ping: async () => false };
  assert.equal(await buildStatusMessage(down, THRESHOLDS, FIXED_NOW, copy), 'HA is asleep.');
});

test('a single enabled section produces no dividers at all', async () => {
  const copy = defaults();
  copy.sections.forEach((s) => { s.enabled = s.id === 'gate'; });
  const msg = await buildStatusMessage(fakeHaClient(HAPPY_PATH_STATES), THRESHOLDS, FIXED_NOW, copy);
  assert.ok(!msg.includes(copy.strings.divider));
  assert.ok(msg.includes('Gate:'));
});
