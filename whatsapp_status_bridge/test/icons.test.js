const test = require('node:test');
const assert = require('node:assert/strict');
const { gateIcon, batteryIcon, airQualityIcon, purifierIcon } = require('../src/icons');

test('gateIcon: closed is green, open is red', () => {
  assert.equal(gateIcon(true), '🟢');
  assert.equal(gateIcon(false), '🔴');
});

test('batteryIcon: green at/above threshold, red below', () => {
  assert.equal(batteryIcon(82), '🟢');
  assert.equal(batteryIcon(20), '🟢');
  assert.equal(batteryIcon(19), '🔴');
  assert.equal(batteryIcon(19, 25), '🔴');
  assert.equal(batteryIcon(26, 25), '🟢');
});

test('airQualityIcon: green below threshold, red at/above', () => {
  assert.equal(airQualityIcon(12, 22), '🟢');
  assert.equal(airQualityIcon(21.9, 22), '🟢');
  assert.equal(airQualityIcon(22, 22), '🔴');
  assert.equal(airQualityIcon(650, 800), '🟢');
  assert.equal(airQualityIcon(800, 800), '🔴');
});

test('purifierIcon: off wins even with a stale Favorite preset_mode', () => {
  assert.deepEqual(purifierIcon('off', 'Favorite'), { icon: '⚪', label: 'Off' });
});

test('purifierIcon: on + Auto is green', () => {
  assert.deepEqual(purifierIcon('on', 'Auto'), { icon: '🟢', label: 'Auto' });
});

test('purifierIcon: on + Favorite is red', () => {
  assert.deepEqual(purifierIcon('on', 'Favorite'), { icon: '🔴', label: 'Favorite' });
});
