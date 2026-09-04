// src/whatsapp.js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { buildStatusMessage } = require('./buildStatusMessage');

function extractText(message) {
  return (message.conversation || message.extendedTextMessage?.text || '').trim();
}

function senderNumber(remoteJid) {
  return remoteJid.split('@')[0].split(':')[0];
}

// Baileys links directly to the bridge's own WhatsApp account, so a message the
// account owner sends to their own self-chat arrives with fromMe:true — the same
// flag used on every other message the account sends anywhere else (needed to
// avoid the bridge replying to its own echoed messages in a loop). This checks
// remoteJid to allow only the self-chat case through, so loop protection for
// every other fromMe message is unaffected.
//
// Baileys 7's dual PN/LID addressing means a message can arrive addressed by
// either a JID's phone-number form or its separate LID (linked-identity) form.
// remoteJidAlt carries the other form when Baileys knows it, so a sender is
// checked against both — ownIdentifiers likewise carries both of the bridge's
// own forms so a self-chat message matches regardless of which form it used.
function shouldHandleMessage(msg, { ownIdentifiers, allowedNumbers }) {
  if (!msg.message) return false;

  const senderIds = [msg.key.remoteJid, msg.key.remoteJidAlt]
    .filter(Boolean)
    .map(senderNumber);

  if (msg.key.fromMe) {
    return senderIds.some((id) => ownIdentifiers.includes(id));
  }
  return senderIds.some((id) => allowedNumbers.includes(id));
}

async function startBridge({ authDir, allowedNumbers, haClient, thresholds }) {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'warn' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      console.log('Scan this QR code with WhatsApp (Linked Devices > Link a Device):');
      qrcode.generate(update.qr, { small: true });
    }
    if (update.connection === 'close') {
      const statusCode = update.lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);
      sock.ev.removeAllListeners();
      if (shouldReconnect) {
        setTimeout(() => {
          startBridge({ authDir, allowedNumbers, haClient, thresholds }).catch((err) => {
            console.error('Reconnect attempt failed:', err);
          });
        }, 5000);
      }
    }
    if (update.connection === 'open') {
      console.log('WhatsApp bridge connected.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const ownIdentifiers = [
      sock.user ? senderNumber(sock.user.id) : null,
      sock.user?.lid ? senderNumber(sock.user.lid) : null,
    ].filter(Boolean);
    for (const msg of messages) {
      if (!shouldHandleMessage(msg, { ownIdentifiers, allowedNumbers })) continue;

      const jid = msg.key.remoteJid;
      const text = extractText(msg.message);
      if (text.toLowerCase() !== 'status') continue;

      try {
        const reply = await buildStatusMessage(haClient, thresholds);
        await sock.sendMessage(jid, { text: reply });
      } catch (err) {
        console.error('Failed to build/send status reply:', err);
      }
    }
  });

  return sock;
}

module.exports = { startBridge, extractText, senderNumber, shouldHandleMessage };
