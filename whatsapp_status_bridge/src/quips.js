// src/quips.js
const DEFAULT_SHOWER_TEMP_C = 35;
const DEFAULT_IMPORT_THRESHOLD_W = 100;
const DEFAULT_HIGH_FORECAST_KWH = 10;

function showerCall(mainTemp, boysTemp, threshold = DEFAULT_SHOWER_TEMP_C) {
  const mainReady = mainTemp >= threshold;
  const boysReady = boysTemp >= threshold;

  if (mainReady && boysReady) {
    return "Either one, champ — both are fired up 🔥🔥 flip a coin 🪙";
  }
  if (mainReady) {
    return "Main Geyser — Boys is still sulking in the cold 🥶";
  }
  if (boysReady) {
    return "Boys Geyser — Main's still finding itself 🐢";
  }
  return "Nobody's ready. Cold shower o'clock 🥶🚿";
}

function powerCheck(gridConnected, gridPowerW, solarForecastRemainingKwh, opts = {}) {
  const importThresholdW = opts.importThresholdW ?? DEFAULT_IMPORT_THRESHOLD_W;
  const highForecastKwh = opts.highForecastKwh ?? DEFAULT_HIGH_FORECAST_KWH;

  if (!gridConnected) {
    return "Battery Only — Eskom's on a coffee break ☕, we're flying solo";
  }
  if (gridPowerW >= importThresholdW) {
    return "On Eskom — treating ourselves to some grid power today";
  }
  if (solarForecastRemainingKwh >= highForecastKwh) {
    return "Tons of solar left today — fire up whatever you want, guilt-free";
  }
  return "Solar's holding its own — steady as she goes";
}

const SUNOPSIS_BY_CONDITION = {
  sunny: 'Sunny and smug about it. SPF up, excuses down. ☀️😎',
  'clear-night': "Clear skies — perfect for pretending you'll stargaze. 🌌",
  partlycloudy: "Partly cloudy, because the sky can't commit either. ⛅",
  cloudy: 'Overcast and moody, much like Mondays. ☁️',
  fog: 'Foggy — nature hiding your unswept driveway. 🌫️',
  rainy: "Rainy — the sky's having a good cry. 🌧️",
  pouring: "Pouring — Noah's calling, wants his ark back. 🌊",
  lightning: "The sky's throwing a full tantrum. ⚡",
  'lightning-rainy': "The sky's throwing a full tantrum. ⚡",
  snowy: 'Snow?! In South Africa?? Go check your sensors. 🥶',
  'snowy-rainy': 'Snow?! In South Africa?? Go check your sensors. 🥶',
  hail: "The sky's lobbing ice cubes at your car. 🧊",
  windy: 'Hold onto your hats and the gate. 💨',
  'windy-variant': 'Hold onto your hats and the gate. 💨',
  exceptional: "Something weird's up out there — check the news. 📰",
};

function sunopsis(condition) {
  return SUNOPSIS_BY_CONDITION[condition] || "Weather's doing... something. Go look outside. 🤷";
}

module.exports = { showerCall, powerCheck, sunopsis };
