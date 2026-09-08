// src/quips.js
//
// Which line is chosen lives here; what each line SAYS comes from the copy
// document, so the wording is editable without touching this logic. Each
// function takes an optional group of strings and falls back to the built-in
// set, which keeps every existing caller - and every existing test - working
// unchanged.
const { defaults } = require('./copyDefaults');

const Q = defaults().quips;   // resolved once, not per call

const DEFAULT_SHOWER_TEMP_C = 35;
const DEFAULT_IMPORT_THRESHOLD_W = 100;
const DEFAULT_HIGH_FORECAST_KWH = 10;

function showerCall(mainTemp, secondTemp, threshold = DEFAULT_SHOWER_TEMP_C, copy) {
  const q = copy || Q.showerCall;
  const mainReady = mainTemp >= threshold;
  const secondReady = secondTemp >= threshold;

  if (mainReady && secondReady) return q.bothReady;
  if (mainReady) return q.mainOnly;
  if (secondReady) return q.secondOnly;
  return q.neither;
}

function powerCheck(gridConnected, gridPowerW, solarForecastRemainingKwh, opts = {}) {
  const q = opts.copy || Q.powerCheck;
  const importThresholdW = opts.importThresholdW ?? DEFAULT_IMPORT_THRESHOLD_W;
  const highForecastKwh = opts.highForecastKwh ?? DEFAULT_HIGH_FORECAST_KWH;

  if (!gridConnected) return q.offGrid;
  if (gridPowerW >= importThresholdW) return q.importing;
  if (solarForecastRemainingKwh >= highForecastKwh) return q.highSolar;
  return q.steady;
}

function sunopsis(condition, copy) {
  const q = copy || Q.sunopsis;
  return q[condition] || q.fallback;
}

function airQuip(pm25, co2, pm25Threshold, co2Threshold, copy) {
  const q = copy || Q.airCheck;
  const pm25Bad = pm25 >= pm25Threshold;
  const co2Bad = co2 >= co2Threshold;

  if (pm25Bad && co2Bad) return q.both;
  if (pm25Bad) return q.pm25;
  if (co2Bad) return q.co2;
  return q.clean;
}

module.exports = { showerCall, powerCheck, sunopsis, airQuip };
