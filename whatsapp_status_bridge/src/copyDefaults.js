// src/copyDefaults.js
'use strict';

// Every piece of wording and structure the status message is built from.
//
// This is the FALLBACK as well as the starting point: whatever the editor
// writes to /data/copy.json is merged over this, so a partial or damaged
// document still produces a sensible message, and a string added here in a
// later release appears without anyone having to re-save anything.
//
// The split is deliberate. Wording, ordering and whether a section appears at
// all are DATA and live here. Which entity a section reads, and the thresholds
// that decide a red icon from a green one, stay in code - those are wiring and
// arithmetic, not copy, and getting them wrong breaks the message rather than
// just reading oddly.
const DEFAULTS = {
  version: 1,

  strings: {
    title: '🏠 *Home Status*',
    timestampPrefix: '📅',
    headerRule: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    divider: '──────────',
    na: '⚪ N/A',
    unreachable: "⚠️ Home Assistant isn't responding right now — try again in a bit.",
  },

  // Order here is the order in the message. Drop `enabled` to false to leave a
  // section out entirely; the dividers close up on their own.
  sections: [
    { id: 'weather', enabled: true,
      labels: { weather: '☀️ Weather', lowHigh: '🌡️ Low/High', sunopsis: '😎 Sunopsis' } },
    { id: 'gate', enabled: true,
      labels: { gate: '🚪 Gate', closed: 'Closed', open: 'Open' } },
    { id: 'battery', enabled: true,
      labels: { battery: '🔋 Battery', powerCheck: '⚡ Power Check' } },
    { id: 'geysers', enabled: true,
      labels: { main: '♨️ Main Geyser', second: '♨️ Second Geyser', showerCall: '🚿 Shower Call' } },
    { id: 'air', enabled: true,
      labels: { pm25: '😷 PM2.5', co2: '🌬️ CO2', airCheck: '🫁 Air Check' } },
    { id: 'purifiers', enabled: true,
      labels: { p1: '💨 Air Purifier 1', p2: '💨 Air Purifier 2' } },
  ],

  // The witty lines. Which one is chosen stays in code; what each one SAYS is
  // yours.
  quips: {
    showerCall: {
      bothReady: "Either one, champ — both are fired up 🔥🔥 flip a coin 🪙",
      mainOnly: "Main Geyser — the other one's still sulking in the cold 🥶",
      secondOnly: "Second Geyser — Main's still finding itself 🐢",
      neither: "Nobody's ready. Cold shower o'clock 🥶🚿",
    },
    powerCheck: {
      offGrid: "Battery Only — Eskom's on a coffee break ☕, we're flying solo",
      importing: 'On Eskom — treating ourselves to some grid power today',
      highSolar: 'Tons of solar left today — fire up whatever you want, guilt-free',
      steady: "Solar's holding its own — steady as she goes",
    },
    airCheck: {
      both: "Dust AND stuffiness — the full combo. Open a window, close the debate 🪟🔥",
      pm25: 'Particulates are throwing a party in here uninvited 🎉😤',
      co2: 'Getting a bit stuffy — crack a window before everyone starts yawning in sync 🥱',
      clean: 'Crisp as a mountain breeze in here — nothing to see, folks 🌬️✨',
    },
    sunopsis: {
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
      fallback: "Weather's doing... something. Go look outside. 🤷",
    },
  },

  conditionLabels: {
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
  },
};

const SECTION_IDS = DEFAULTS.sections.map((s) => s.id);

// Deep clone so a caller mutating what it got back cannot poison the fallback -
// which would turn "reset to defaults" into "reset to whatever broke it".
function defaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

module.exports = { defaults, SECTION_IDS };
