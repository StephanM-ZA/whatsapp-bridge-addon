// src/buildStatusMessage.js
const { gateIcon, batteryIcon, airQualityIcon, purifierIcon } = require('./icons');
const { showerCall, powerCheck, sunopsis } = require('./quips');

const ENTITIES = {
  gate: 'binary_sensor.gate_open_confirmed',
  battery: 'sensor.solarman_battery_soc_2',
  gridConnected: 'sensor.solarman_grid_connected_status_2',
  gridPower: 'sensor.solarman_total_grid_power_2',
  solarForecastRemaining: 'sensor.solcast_pv_forecast_forecast_remaining_today',
  mainGeyser: 'sensor.solarbot_110493863532580_geyser_1_internal_temp',
  secondGeyser: 'sensor.solarbot_110493863532580_geyser_2_internal_temp',
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

function conditionLabel(condition) {
  if (CONDITION_LABELS[condition]) {
    return CONDITION_LABELS[condition];
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

async function buildStatusMessage(haClient, thresholds, now = new Date()) {
  const reachable = await haClient.ping();
  if (!reachable) {
    return UNREACHABLE_MESSAGE;
  }

  const keys = Object.keys(ENTITIES);
  const fetched = await Promise.all(keys.map((key) => safeGetState(haClient, ENTITIES[key])));
  const states = Object.fromEntries(keys.map((key, i) => [key, fetched[i]]));

  const lines = [];
  lines.push("🏠 *Home Status*");
  lines.push(`📅 ${formatTimestamp(now)}`);
  lines.push('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
  lines.push('');

  if (states.weather) {
    const temp = states.weather.attributes.temperature;
    const condition = states.weather.state;
    lines.push(`☀️ Weather: *${temp}°C, ${conditionLabel(condition)}*`);
    lines.push('');
    lines.push(`_😎 Sunopsis: ${sunopsis(condition)}_`);
  } else {
    lines.push(`☀️ Weather: ${NA}`);
  }
  lines.push('──────────');
  lines.push('');

  if (states.gate) {
    const closed = states.gate.state === 'off';
    lines.push(`🚪 Gate: *${closed ? 'Closed' : 'Open'}* ${gateIcon(closed)}`);
  } else {
    lines.push(`🚪 Gate: ${NA}`);
  }
  lines.push('──────────');
  lines.push('');

  if (states.battery) {
    const pct = parseFloat(states.battery.state);
    lines.push(`🔋 Battery: *${pct}%* ${batteryIcon(pct, thresholds.batteryLowPct)}`);
    lines.push('');
    const gridConnected = states.gridConnected ? states.gridConnected.state === 'On-Grid' : true;
    const gridPowerW = states.gridPower ? parseFloat(states.gridPower.state) : 0;
    const forecastKwh = states.solarForecastRemaining ? parseFloat(states.solarForecastRemaining.state) : 0;
    const powerLine = powerCheck(gridConnected, gridPowerW, forecastKwh, {
      importThresholdW: thresholds.gridImportThresholdW,
      highForecastKwh: thresholds.solarForecastHighKwh,
    });
    lines.push(`_⚡ Power Check: ${powerLine}_`);
  } else {
    lines.push(`🔋 Battery: ${NA}`);
  }
  lines.push('──────────');
  lines.push('');

  if (states.mainGeyser) {
    const mainTemp = parseFloat(states.mainGeyser.state);
    lines.push(`♨️ Main Geyser: *${mainTemp}°C* ${mainTemp >= thresholds.showerTempC ? '🟢' : '🔴'}`);
  } else {
    lines.push(`♨️ Main Geyser: ${NA}`);
  }
  if (states.secondGeyser) {
    const secondTemp = parseFloat(states.secondGeyser.state);
    lines.push(`♨️ Second Geyser: *${secondTemp}°C* ${secondTemp >= thresholds.showerTempC ? '🟢' : '🔴'}`);
  } else {
    lines.push(`♨️ Second Geyser: ${NA}`);
  }
  if (states.mainGeyser && states.secondGeyser) {
    const mainTemp = parseFloat(states.mainGeyser.state);
    const secondTemp = parseFloat(states.secondGeyser.state);
    lines.push('');
    lines.push(`_🚿 Shower Call: ${showerCall(mainTemp, secondTemp, thresholds.showerTempC)}_`);
  }
  lines.push('──────────');
  lines.push('');

  // PM2.5/CO2 both read from the same Nobito sensor and both turn red at/above
  // their threshold — higher is worse for air quality, the opposite direction
  // from batteryIcon, where red means below its threshold.
  if (states.pm25) {
    const val = parseFloat(states.pm25.state);
    lines.push(`😷 PM2.5: *${val} µg/m³* ${airQualityIcon(val, thresholds.pm25Threshold)}`);
  } else {
    lines.push(`😷 PM2.5: ${NA}`);
  }
  if (states.co2) {
    const val = parseFloat(states.co2.state);
    lines.push(`🌬️ CO2: *${val} ppm* ${airQualityIcon(val, thresholds.co2Threshold)}`);
  } else {
    lines.push(`🌬️ CO2: ${NA}`);
  }
  lines.push('──────────');
  lines.push('');

  if (states.purifier1) {
    const { icon, label } = purifierIcon(states.purifier1.state, states.purifier1.attributes.preset_mode);
    lines.push(`💨 Air Purifier 1: *${label}* ${icon}`);
  } else {
    lines.push(`💨 Air Purifier 1: ${NA}`);
  }
  if (states.purifier2) {
    const { icon, label } = purifierIcon(states.purifier2.state, states.purifier2.attributes.preset_mode);
    lines.push(`💨 Air Purifier 2: *${label}* ${icon}`);
  } else {
    lines.push(`💨 Air Purifier 2: ${NA}`);
  }

  return lines.join('\n');
}

module.exports = { buildStatusMessage, ENTITIES };
