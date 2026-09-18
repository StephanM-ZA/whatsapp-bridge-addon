// src/buildStatusMessage.js
const { gateIcon, batteryIcon, airQualityIcon, purifierIcon } = require('./icons');
const { showerCall, powerCheck, sunopsis, airQuip } = require('./quips');
const { defaults } = require('./copyDefaults');

const ENTITIES = {
  gate: 'binary_sensor.gate_open_confirmed',
  battery: 'sensor.solarman_battery_soc_2',
  gridConnected: 'sensor.solarman_grid_connected_status_2',
  gridPower: 'sensor.solarman_total_grid_power_2',
  solarForecastRemaining: 'sensor.solcast_pv_forecast_forecast_remaining_today',
  // Solarbot slot 2 is the main geyser, slot 1 the second one (2026-09-18:
  // this was the other way round here while the dashboard had it right, so
  // the same tank read "Main" in WhatsApp and "Boys" on the dashboard).
  mainGeyser: 'sensor.solarbot_110493863532580_geyser_2_internal_temp',
  secondGeyser: 'sensor.solarbot_110493863532580_geyser_1_internal_temp',
  pm25: 'sensor.nobito_pm2_5',
  co2: 'sensor.nobito_carbon_dioxide',
  purifier1: 'fan.xiaomi_cpa4_6940_air_purifier',
  purifier2: 'fan.xiaomi_cpa4_b5e2_air_purifier',
  weather: 'weather.forecast_home',
};

const NA = '⚪ N/A';
const UNREACHABLE_MESSAGE = "⚠️ Home Assistant isn't responding right now — try again in a bit.";

const CONDITION_LABELS = {
  sunny: 'Sunny',
  'clear-night': 'Clear Night',
  partlycloudy: 'Partly Cloudy',
  cloudy: 'Cloudy',
  fog: 'Foggy',
  rainy: 'Rainy',
  pouring: 'Pouring',
  lightning: 'Lightning',
  'lightning-rainy': 'Lightning & Rain',
  snowy: 'Snowy',
  'snowy-rainy': 'Snow & Rain',
  hail: 'Hail',
  windy: 'Windy',
  'windy-variant': 'Windy',
  exceptional: 'Exceptional',
};

function conditionLabel(condition, table) {
  const labels = table || CONDITION_LABELS;
  if (labels[condition]) {
    return labels[condition];
  }
  return condition
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTimestamp(date) {
  const day = DAYS[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${day}, ${dd} ${mon} ${yyyy} — ${hh}:${min}`;
}

async function safeGetState(haClient, entityId) {
  try {
    const result = await haClient.getState(entityId);
    if (!result || ['unavailable', 'unknown', 'none'].includes(result.state)) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

// weather.get_forecasts is a service call, not a state attribute (HA moved
// forecasts off the entity itself), so it needs its own safe wrapper — and a
// feature-detect on callService, since older/simpler HA client doubles in
// tests only implement getState/ping.
async function safeGetForecast(haClient, entityId) {
  try {
    if (typeof haClient.callService !== 'function') {
      return null;
    }
    const result = await haClient.callService(
      'weather',
      'get_forecasts',
      { entity_id: entityId, type: 'daily' },
      { returnResponse: true }
    );
    const today = result?.service_response?.[entityId]?.forecast?.[0];
    if (!today || typeof today.temperature !== 'number' || typeof today.templow !== 'number') {
      return null;
    }
    return today;
  } catch {
    return null;
  }
}

async function buildStatusMessage(haClient, thresholds, now = new Date(), copy = defaults()) {
  const reachable = await haClient.ping();
  if (!reachable) {
    return copy.strings.unreachable;
  }

  const keys = Object.keys(ENTITIES);
  const fetched = await Promise.all(keys.map((key) => safeGetState(haClient, ENTITIES[key])));
  const states = Object.fromEntries(keys.map((key, i) => [key, fetched[i]]));
  const todayForecast = await safeGetForecast(haClient, ENTITIES.weather);

  // One renderer per section. Each returns its own lines and knows nothing
  // about dividers or order - those belong to the document, not to the
  // section, which is what makes reordering and disabling safe.
  const S = {};
  copy.sections.forEach((sec) => { S[sec.id] = sec; });
  const NA_TEXT = copy.strings.na;

  const RENDER = {
    weather(L) {
      const out = [];
      if (!states.weather) return [`${L.weather}: ${NA_TEXT}`];
      const temp = states.weather.attributes.temperature;
      const condition = states.weather.state;
      out.push(`${L.weather}: *${temp}°C, ${conditionLabel(condition, copy.conditionLabels)}*`);
      if (todayForecast) {
        out.push(`${L.lowHigh}: *${todayForecast.templow}°C / ${todayForecast.temperature}°C*`);
      }
      out.push('');
      out.push(`_${L.sunopsis}: ${sunopsis(condition, copy.quips.sunopsis)}_`);
      return out;
    },

    gate(L) {
      if (!states.gate) return [`${L.gate}: ${NA_TEXT}`];
      const closed = states.gate.state === 'off';
      return [`${L.gate}: *${closed ? L.closed : L.open}* ${gateIcon(closed)}`];
    },

    battery(L) {
      if (!states.battery) return [`${L.battery}: ${NA_TEXT}`];
      const pct = parseFloat(states.battery.state);
      const gridConnected = states.gridConnected ? states.gridConnected.state === 'On-Grid' : true;
      const gridPowerW = states.gridPower ? parseFloat(states.gridPower.state) : 0;
      const forecastKwh = states.solarForecastRemaining
        ? parseFloat(states.solarForecastRemaining.state) : 0;
      const powerLine = powerCheck(gridConnected, gridPowerW, forecastKwh, {
        importThresholdW: thresholds.gridImportThresholdW,
        highForecastKwh: thresholds.solarForecastHighKwh,
        copy: copy.quips.powerCheck,
      });
      return [
        `${L.battery}: *${pct}%* ${batteryIcon(pct, thresholds.batteryLowPct)}`,
        '',
        `_${L.powerCheck}: ${powerLine}_`,
      ];
    },

    geysers(L) {
      const out = [];
      const main = states.mainGeyser ? parseFloat(states.mainGeyser.state) : null;
      const second = states.secondGeyser ? parseFloat(states.secondGeyser.state) : null;
      out.push(main === null ? `${L.main}: ${NA_TEXT}`
        : `${L.main}: *${main}°C* ${main >= thresholds.showerTempC ? '🟢' : '🔴'}`);
      out.push(second === null ? `${L.second}: ${NA_TEXT}`
        : `${L.second}: *${second}°C* ${second >= thresholds.showerTempC ? '🟢' : '🔴'}`);
      if (main !== null && second !== null) {
        out.push('');
        out.push(`_${L.showerCall}: ${showerCall(main, second, thresholds.showerTempC, copy.quips.showerCall)}_`);
      }
      return out;
    },

    // PM2.5/CO2 both read from the same Nobito sensor and both turn red at or
    // above their threshold - higher is worse for air quality, the opposite
    // direction from batteryIcon, where red means below its threshold.
    air(L) {
      const out = [];
      const pm = states.pm25 ? parseFloat(states.pm25.state) : null;
      const co2 = states.co2 ? parseFloat(states.co2.state) : null;
      out.push(pm === null ? `${L.pm25}: ${NA_TEXT}`
        : `${L.pm25}: *${pm} µg/m³* ${airQualityIcon(pm, thresholds.pm25Threshold)}`);
      out.push(co2 === null ? `${L.co2}: ${NA_TEXT}`
        : `${L.co2}: *${co2} ppm* ${airQualityIcon(co2, thresholds.co2Threshold)}`);
      if (pm !== null && co2 !== null) {
        out.push('');
        out.push(`_${L.airCheck}: ${airQuip(pm, co2, thresholds.pm25Threshold, thresholds.co2Threshold, copy.quips.airCheck)}_`);
      }
      return out;
    },

    purifiers(L) {
      const out = [];
      [['purifier1', L.p1], ['purifier2', L.p2]].forEach(([key, label]) => {
        if (!states[key]) { out.push(`${label}: ${NA_TEXT}`); return; }
        const { icon, label: mode } = purifierIcon(states[key].state, states[key].attributes.preset_mode);
        out.push(`${label}: *${mode}* ${icon}`);
      });
      return out;
    },
  };

  const lines = [];
  lines.push(copy.strings.title);
  lines.push(`${copy.strings.timestampPrefix} ${formatTimestamp(now)}`);
  lines.push(copy.strings.headerRule);
  lines.push('');

  // Dividers go BETWEEN sections, never after the last one, so switching a
  // section off closes the gap instead of leaving a rule hanging at the end.
  const blocks = copy.sections
    .filter((sec) => sec.enabled !== false && RENDER[sec.id])
    .map((sec) => RENDER[sec.id](sec.labels || {}));

  blocks.forEach((block, i) => {
    lines.push(...block);
    if (i < blocks.length - 1) {
      lines.push(copy.strings.divider);
      lines.push('');
    }
  });

  return lines.join('\n');
}

module.exports = { buildStatusMessage, ENTITIES };
