// test/whatsapp.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractText, senderNumber, shouldHandleMessage } = require('../src/whatsapp');

test('senderNumber extracts the number from a plain JID', () => {
  assert.equal(senderNumber('27821234567@s.whatsapp.net'), '27821234567');
});

test('senderNumber strips a device suffix from a device-scoped JID', () => {
  assert.equal(senderNumber('27821234567:12@s.whatsapp.net'), '27821234567');
});

test('senderNumber does not crash on a group JID (fails closed against the allow-list)', () => {
  assert.equal(senderNumber('120363012345678901@g.us'), '120363012345678901');
});

test('extractText reads a plain conversation message', () => {
  const message = { conversation: 'Status' };
  assert.equal(extractText(message), 'Status');
});

test('extractText reads an extendedTextMessage', () => {
  const message = { extendedTextMessage: { text: 'Status' } };
  assert.equal(extractText(message), 'Status');
});

const ALLOWED = ['27821234567'];
const OWN_IDS = ['27829999999', '121268485488759'];

test('shouldHandleMessage: false when there is no message content', () => {
  const msg = { message: null, key: { fromMe: false, remoteJid: '27821234567@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), false);
});

test('shouldHandleMessage: true when not fromMe and sender is allow-listed', () => {
  const msg = { message: { conversation: 'Status' }, key: { fromMe: false, remoteJid: '27821234567@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), true);
});

test('shouldHandleMessage: false when not fromMe and sender is not allow-listed', () => {
  const msg = { message: { conversation: 'Status' }, key: { fromMe: false, remoteJid: '27820000000@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), false);
});

test('shouldHandleMessage: true for a fromMe message in the bridge\'s own self-chat (phone-number JID)', () => {
  const msg = { message: { conversation: 'Status' }, key: { fromMe: true, remoteJid: '27829999999@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), true);
});

test('shouldHandleMessage: true for a fromMe message in the bridge\'s own self-chat addressed by LID', () => {
  // Real observed shape: Baileys can deliver a self-chat message addressed by the
  // account's LID (linked-identity) rather than its phone-number JID.
  const msg = { message: { conversation: 'Status' }, key: { fromMe: true, remoteJid: '121268485488759@lid' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), true);
});

test('shouldHandleMessage: false for a fromMe message NOT in the self-chat (loop protection preserved)', () => {
  const msg = { message: { conversation: 'Status' }, key: { fromMe: true, remoteJid: '27821234567@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), false);
});

test('shouldHandleMessage: false for a fromMe message when no own identifiers are known yet', () => {
  const msg = { message: { conversation: 'Status' }, key: { fromMe: true, remoteJid: '27829999999@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: [], allowedNumbers: ALLOWED }), false);
});

test('shouldHandleMessage: self-chat match survives a device-suffixed remoteJid', () => {
  const msg = { message: { conversation: 'Status' }, key: { fromMe: true, remoteJid: '27829999999:12@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), true);
});

test('shouldHandleMessage: true when remoteJid is an unmatched LID but remoteJidAlt carries an allow-listed number', () => {
  // Real observed shape: WhatsApp addressed the message by the sender's LID
  // (unrecognizable), but Baileys' remoteJidAlt carried their actual phone-number
  // JID, which IS on the allow-list.
  const msg = {
    message: { conversation: 'Status' },
    key: { fromMe: false, remoteJid: '163797251682496@lid', remoteJidAlt: '27821234567@s.whatsapp.net' },
  };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), true);
});

test('shouldHandleMessage: false when neither remoteJid nor remoteJidAlt is allow-listed', () => {
  const msg = {
    message: { conversation: 'Status' },
    key: { fromMe: false, remoteJid: '163797251682496@lid', remoteJidAlt: '27820000000@s.whatsapp.net' },
  };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), false);
});

test('shouldHandleMessage: does not crash when remoteJidAlt is absent', () => {
  const msg = { message: { conversation: 'Status' }, key: { fromMe: false, remoteJid: '27821234567@s.whatsapp.net' } };
  assert.equal(shouldHandleMessage(msg, { ownIdentifiers: OWN_IDS, allowedNumbers: ALLOWED }), true);
});

test('sendWithRetry reports the send in the log so a silent failure cannot hide', async () => {
  const { sendWithRetry } = require('../src/whatsapp');
  const sent = [];
  const sock = { sendMessage: async (jid, body) => { sent.push([jid, body]); } };
  const logged = [];
  const realLog = console.log;
  console.log = (...a) => logged.push(a.join(' '));
  try {
    await sendWithRetry(sock, '27821234567@s.whatsapp.net', 'hello');
  } finally { console.log = realLog; }
  assert.equal(sent.length, 1);
  assert.ok(logged.some((l) => l.includes('Status reply sent to')));
});

test('sendWithRetry retries once when the send throws, then succeeds', async () => {
  const { sendWithRetry } = require('../src/whatsapp');
  let calls = 0;
  const sock = { sendMessage: async () => { calls += 1; if (calls === 1) throw new Error('smax-invalid (479)'); } };
  const realLog = console.log, realErr = console.error;
  console.log = () => {}; console.error = () => {};
  try {
    const ok = await sendWithRetry(sock, 'jid', 'hello', { attempts: 2, delayMs: 1 });
    assert.equal(ok, true);
  } finally { console.log = realLog; console.error = realErr; }
  assert.equal(calls, 2);
});

test('sendWithRetry gives up after the last attempt and rethrows', async () => {
  const { sendWithRetry } = require('../src/whatsapp');
  let calls = 0;
  const sock = { sendMessage: async () => { calls += 1; throw new Error('still bad'); } };
  const realLog = console.log, realErr = console.error;
  console.log = () => {}; console.error = () => {};
  try {
    await assert.rejects(() => sendWithRetry(sock, 'jid', 'hi', { attempts: 2, delayMs: 1 }), /still bad/);
  } finally { console.log = realLog; console.error = realErr; }
  assert.equal(calls, 2);
});
