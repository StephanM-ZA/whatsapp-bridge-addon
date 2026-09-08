// src/redactLogs.js
'use strict';

// libsignal, inside Baileys, dumps an entire SessionEntry through console.log
// whenever it rotates a Signal session:
//
//     Closing session: SessionEntry {
//       currentRatchet: {
//         ephemeralKeyPair: { privKey: <Buffer 60 f4 1f 43 99 6e ...> }
//       },
//       ...
//
// That privKey is a real Signal session private key, in plaintext, in the
// add-on log - observed three times in eight hours on 2026-09-08. It matters
// more here than it would elsewhere: this system's logs travel inside Home
// Assistant backups, which sync off-device to Google Drive.
//
// Baileys' own pino logger is already held at 'warn', but libsignal calls
// console.log directly, so no Baileys option can reach it. The event itself is
// worth keeping - knowing a session rotated is useful when replies start
// failing - so the line survives and only the key material is dropped.

const SESSION_LINE = /^Closing (open )?session/;

// A SessionEntry, identified by shape rather than by name: libsignal has
// renamed this record before, and matching the constructor name would fail
// silently the next time it does.
function looksLikeKeyMaterial(arg) {
  if (!arg || typeof arg !== 'object') return false;
  return 'currentRatchet' in arg || '_chains' in arg || 'indexInfo' in arg;
}

const REDACTED = '[key material redacted]';

function install(target) {
  const sink = target || console;
  // Kept unbound and re-applied, so uninstall() restores the exact function
  // that was there before. Storing sink.log.bind(sink) instead put a bound
  // COPY back on uninstall - the logger still worked, but anything holding a
  // reference to the original no longer matched it. Caught by its own test.
  const original = sink.log;
  const emit = (...args) => original.apply(sink, args);
  sink.log = function (...args) {
    // Only say something was redacted when something actually was: the
    // prekey-bundle line carries no object, and tagging it would claim a
    // removal that never happened.
    if (typeof args[0] === 'string' && SESSION_LINE.test(args[0])) {
      const rest = args.slice(1);
      const head = args[0].replace(/:\s*$/, '');
      return rest.length ? emit(head, REDACTED) : emit(head);
    }
    if (args.some(looksLikeKeyMaterial)) {
      return emit(...args.map((a) => (looksLikeKeyMaterial(a) ? REDACTED : a)));
    }
    return emit(...args);
  };
  return function uninstall() { sink.log = original; };
}

module.exports = { install, looksLikeKeyMaterial, REDACTED };
