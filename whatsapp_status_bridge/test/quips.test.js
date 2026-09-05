// test/quips.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { showerCall, powerCheck, sunopsis } = require('../src/quips');

test('showerCall: only Main ready', () => {
  assert.equal(showerCall(45, 30), "Main Geyser — the other one's still sulking in the cold 🥶");
});

test('showerCall: only Second ready', () => {
  assert.equal(showerCall(30, 45), "Second Geyser — Main's still finding itself 🐢");
});

test('showerCall: both ready', () => {
  assert.equal(showerCall(45, 45), "Either one, champ — both are fired up 🔥🔥 flip a coin 🪙");
});

test('showerCall: neither ready', () => {
  assert.equal(showerCall(30, 25), "Nobody's ready. Cold shower o'clock 🥶🚿");
});

test('showerCall: respects a custom threshold', () => {
  assert.equal(showerCall(40, 20, 38), "Main Geyser — the other one's still sulking in the cold 🥶");
});

test('powerCheck: grid disconnected is battery only regardless of other values', () => {
  assert.equal(
    powerCheck(false, 0, 20),
    "Battery Only — Eskom's on a coffee break ☕, we're flying solo"
  );
});

test('powerCheck: grid connected and importing is on Eskom', () => {
  assert.equal(
    powerCheck(true, 500, 20),
    "On Eskom — treating ourselves to some grid power today"
  );
});

test('powerCheck: grid connected, minimal import, high forecast', () => {
  assert.equal(
    powerCheck(true, 10, 15),
    "Tons of solar left today — fire up whatever you want, guilt-free"
  );
});

test('powerCheck: grid connected, minimal import, modest forecast', () => {
  assert.equal(
    powerCheck(true, 10, 2),
    "Solar's holding its own — steady as she goes"
  );
});

test('powerCheck: respects custom thresholds', () => {
  assert.equal(
    powerCheck(true, 150, 5, { importThresholdW: 200, highForecastKwh: 3 }),
    "Tons of solar left today — fire up whatever you want, guilt-free"
  );
});

test('sunopsis: known condition', () => {
  assert.equal(sunopsis('sunny'), 'Sunny and smug about it. SPF up, excuses down. ☀️😎');
});

test('sunopsis: unknown condition falls back gracefully', () => {
  assert.equal(sunopsis('some-new-condition'), "Weather's doing... something. Go look outside. 🤷");
});
