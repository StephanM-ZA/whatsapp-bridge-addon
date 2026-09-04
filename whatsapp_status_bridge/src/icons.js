const DEFAULT_BATTERY_LOW_PCT = 20;

function gateIcon(isClosed) {
  return isClosed ? '🟢' : '🔴';
}

function batteryIcon(pct, lowThreshold = DEFAULT_BATTERY_LOW_PCT) {
  return pct >= lowThreshold ? '🟢' : '🔴';
}

function airQualityIcon(value, threshold) {
  return value < threshold ? '🟢' : '🔴';
}

// State must be checked before preset_mode: a powered-off Xiaomi purifier
// keeps reporting its last preset_mode forever (see CLAUDE.md memory
// ha-xiaomi-purifier-off-swallows-commands), so checking preset_mode first
// would show a stale "Favorite" as red even when the unit is off.
function purifierIcon(state, presetMode) {
  if (state !== 'on') {
    return { icon: '⚪', label: 'Off' };
  }
  if (presetMode === 'Favorite') {
    return { icon: '🔴', label: 'Favorite' };
  }
  return { icon: '🟢', label: 'Auto' };
}

module.exports = { gateIcon, batteryIcon, airQualityIcon, purifierIcon };
