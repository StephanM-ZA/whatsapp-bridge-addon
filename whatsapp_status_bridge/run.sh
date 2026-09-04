#!/usr/bin/with-contenv bash
set -e

source /usr/lib/bashio/bashio.sh

export ALLOWED_NUMBERS="$(bashio::config 'allowed_numbers')"
export LINK_PHONE_NUMBER="$(bashio::config 'link_phone_number')"
export BATTERY_LOW_PCT="$(bashio::config 'battery_low_pct')"
export PM25_THRESHOLD="$(bashio::config 'pm25_threshold')"
export CO2_THRESHOLD="$(bashio::config 'co2_threshold')"
export SHOWER_TEMP_C="$(bashio::config 'shower_temp_c')"
export GRID_IMPORT_THRESHOLD_W="$(bashio::config 'grid_import_threshold_w')"
export SOLAR_FORECAST_HIGH_KWH="$(bashio::config 'solar_forecast_high_kwh')"
export AUTH_DIR="/data/baileys_auth"

exec node /app/src/index.js
