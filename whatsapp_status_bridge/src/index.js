// src/index.js
const { createHaClient } = require('./haClient');
const { startBridge } = require('./whatsapp');

const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
const ALLOWED_NUMBERS = (process.env.ALLOWED_NUMBERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const AUTH_DIR = process.env.AUTH_DIR || '/data/baileys_auth';
const LINK_PHONE_NUMBER = (process.env.LINK_PHONE_NUMBER || '').trim() || null;

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

startBridge({ authDir: AUTH_DIR, allowedNumbers: ALLOWED_NUMBERS, haClient, thresholds, linkPhoneNumber: LINK_PHONE_NUMBER }).catch((err) => {
  console.error('Fatal error starting WhatsApp bridge:', err);
  process.exit(1);
});
