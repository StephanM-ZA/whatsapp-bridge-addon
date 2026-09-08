// test/redactLogs.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { install, looksLikeKeyMaterial, REDACTED } = require('../src/redactLogs');

// The SHAPE libsignal printed into the add-on log on 2026-09-08. The values
// are invented on purpose: this repo is public, and a fixture copied from a
// real session dump would put real key bytes into it - which is the exact
// thing this module exists to prevent.
function sessionEntry() {
  return {
    _chains: { 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA': { chainType: 2 } },
    registrationId: 1234567890,
    currentRatchet: {
      ephemeralKeyPair: {
        pubKey: Buffer.from([0x01, 0x02, 0x03]),
        privKey: Buffer.from([0x0a, 0x0b, 0x0c]),
      },
    },
    indexInfo: { baseKeyType: 2 },
  };
}

function capture(fn) {
  const lines = [];
  const sink = { log: (...args) => lines.push(args) };
  const uninstall = install(sink);
  fn(sink);
  uninstall();
  return lines;
}

test('a session dump keeps its line but loses the key material', () => {
  const lines = capture((sink) => sink.log('Closing session:', sessionEntry()));
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], 'Closing session');
  assert.equal(lines[0][1], REDACTED);
  assert.ok(!JSON.stringify(lines).includes('privKey'));
});

test('the prekey-bundle variant survives, and is not falsely tagged', () => {
  const lines = capture((sink) =>
    sink.log('Closing open session in favor of incoming prekey bundle'));
  assert.ok(String(lines[0][0]).startsWith('Closing open session'));
  // nothing was removed, so nothing should claim to have been
  assert.equal(lines[0].length, 1);
});

test('key material is dropped even when the line does not announce itself', () => {
  const lines = capture((sink) => sink.log('something unexpected', sessionEntry()));
  assert.equal(lines[0][0], 'something unexpected');
  assert.equal(lines[0][1], REDACTED);
});

test('ordinary logging is untouched', () => {
  const lines = capture((sink) => {
    sink.log('WhatsApp bridge connected.');
    sink.log('Status reply sent to 27821234567@s.whatsapp.net.');
  });
  assert.deepEqual(lines[0], ['WhatsApp bridge connected.']);
  assert.deepEqual(lines[1], ['Status reply sent to 27821234567@s.whatsapp.net.']);
});

test('uninstall restores the original logger', () => {
  const sink = { log: () => 'original' };
  const original = sink.log;
  const uninstall = install(sink);
  assert.notEqual(sink.log, original);
  uninstall();
  assert.equal(sink.log, original);
});

test('looksLikeKeyMaterial ignores plain values', () => {
  assert.equal(looksLikeKeyMaterial(null), false);
  assert.equal(looksLikeKeyMaterial('a string'), false);
  assert.equal(looksLikeKeyMaterial({ harmless: true }), false);
  assert.equal(looksLikeKeyMaterial(sessionEntry()), true);
});
