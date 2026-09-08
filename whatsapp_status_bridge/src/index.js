// src/index.js
// Installed before anything else loads: libsignal starts dumping Signal
// session private keys through console.log as soon as Baileys connects.
require('./redactLogs').install();

const { createHaClient } = require('./haClient');
const { startBridge } = require('./whatsapp');
const { startServer } = require('./server');
const { load } = require('./copyStore');
const { buildStatusMessage } = require('./buildStatusMessage');

const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
const ALLOWED_NUMBERS = (process.env.ALLOWED_NUMBERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const AUTH_DIR = process.env.AUTH_DIR || '/data/baileys_auth';

const thresholds = {
  batteryLowPct: Number(process.env.BATTERY_LOW_PCT || 20),
  pm25Threshold: Number(process.env.PM25_THRESHOLD || 22),
  co2Threshold: Number(process.env.CO2_THRESHOLD || 800),
  showerTempC: Number(process.env.SHOWER_TEMP_C || 35),
  gridImportThresholdW: Number(process.env.GRID_IMPORT_THRESHOLD_W || 100),
  solarForecastHighKwh: Number(process.env.SOLAR_FORECAST_HIGH_KWH || 10),
};

if (!SUPERVISOR_TOKEN) {
  console.error('SUPERVISOR_TOKEN is not set — this add-on must run under Supervisor with homeassistant_api: true.');
  process.exit(1);
}

if (ALLOWED_NUMBERS.length === 0) {
  console.error('ALLOWED_NUMBERS is empty — set allowed_numbers in the add-on configuration before starting.');
  process.exit(1);
}

const haClient = createHaClient(SUPERVISOR_TOKEN);

// The editor renders its preview through the SAME builder the bridge uses,
// against live Home Assistant state. A preview that went through a second
// code path would eventually disagree with the message, which is the one
// thing a preview must never do.
startServer({
  dataDir: AUTH_DIR.replace(/\/baileys_auth$/, ''),
  port: Number(process.env.INGRESS_PORT || 8099),
  renderPreview: (doc) => buildStatusMessage(haClient, thresholds, new Date(), doc),
});

startBridge({ authDir: AUTH_DIR, allowedNumbers: ALLOWED_NUMBERS, haClient, thresholds, dataDir: AUTH_DIR.replace(/\/baileys_auth$/, '') }).catch((err) => {
  console.error('Fatal error starting WhatsApp bridge:', err);
  process.exit(1);
});
