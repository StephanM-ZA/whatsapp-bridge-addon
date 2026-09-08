// src/copyStore.js
'use strict';

const fs = require('fs');
const path = require('path');
const { defaults, SECTION_IDS } = require('./copyDefaults');

// Load, validate and persist the editable copy document.
//
// The rule this file exists to enforce: A BAD DOCUMENT MUST NEVER STOP THE
// BRIDGE ANSWERING. The whole point of making copy editable is that someone
// edits it, and someone editing it will eventually save something wrong. So a
// document that fails validation is refused at SAVE time with a reason, and a
// document that is somehow bad at LOAD time (hand-edited file, half-written
// after a power cut, written by an older version) is merged over the defaults
// rather than used as-is. Either way a status message still goes out.

const FILE = 'copy.json';

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function allStrings(obj) {
  return isPlainObject(obj) && Object.values(obj).every((v) => typeof v === 'string');
}

// Returns [] when the document is usable, otherwise the reasons it is not.
// Reasons are phrased for the person in the editor, not for a log.
function validate(doc) {
  const errors = [];
  if (!isPlainObject(doc)) return ['The document must be an object.'];

  if (doc.strings !== undefined && !allStrings(doc.strings)) {
    errors.push('Every entry under "strings" must be text.');
  }
  if (doc.conditionLabels !== undefined && !allStrings(doc.conditionLabels)) {
    errors.push('Every entry under "conditionLabels" must be text.');
  }

  if (doc.quips !== undefined) {
    if (!isPlainObject(doc.quips)) {
      errors.push('"quips" must be an object.');
    } else {
      for (const [group, entries] of Object.entries(doc.quips)) {
        if (!allStrings(entries)) errors.push(`Every entry under "quips.${group}" must be text.`);
      }
    }
  }

  if (doc.sections !== undefined) {
    if (!Array.isArray(doc.sections)) {
      errors.push('"sections" must be a list.');
    } else {
      const seen = new Set();
      doc.sections.forEach((s, i) => {
        if (!isPlainObject(s)) { errors.push(`Section ${i + 1} must be an object.`); return; }
        if (!SECTION_IDS.includes(s.id)) {
          errors.push(`Section ${i + 1} has an unknown id "${s.id}". Known: ${SECTION_IDS.join(', ')}.`);
        }
        if (seen.has(s.id)) errors.push(`Section "${s.id}" appears more than once.`);
        seen.add(s.id);
        if (s.enabled !== undefined && typeof s.enabled !== 'boolean') {
          errors.push(`Section "${s.id}": "enabled" must be true or false.`);
        }
        if (s.labels !== undefined && !allStrings(s.labels)) {
          errors.push(`Section "${s.id}": every label must be text.`);
        }
      });
      // Refusing an empty list is a kindness, not a technical need: it saves
      // cleanly and then the message is just a header, which reads as a bug.
      if (doc.sections.length && !doc.sections.some((s) => s.enabled !== false)) {
        errors.push('At least one section must stay enabled.');
      }
    }
  }
  return errors;
}

// Merge a partial document over the defaults. Sections are merged BY ID rather
// than by position, so the saved order wins while a section the document does
// not mention keeps its default labels instead of vanishing.
function merge(userDoc) {
  const base = defaults();
  if (!isPlainObject(userDoc)) return base;

  const out = base;
  out.strings = { ...base.strings, ...(isPlainObject(userDoc.strings) ? userDoc.strings : {}) };
  out.conditionLabels = {
    ...base.conditionLabels,
    ...(isPlainObject(userDoc.conditionLabels) ? userDoc.conditionLabels : {}),
  };

  if (isPlainObject(userDoc.quips)) {
    for (const [group, entries] of Object.entries(userDoc.quips)) {
      if (isPlainObject(entries)) out.quips[group] = { ...(base.quips[group] || {}), ...entries };
    }
  }

  if (Array.isArray(userDoc.sections)) {
    const byId = new Map(base.sections.map((s) => [s.id, s]));
    const ordered = [];
    for (const s of userDoc.sections) {
      const known = byId.get(s && s.id);
      if (!known) continue;                       // unknown id: dropped, not fatal
      ordered.push({
        id: known.id,
        enabled: typeof s.enabled === 'boolean' ? s.enabled : known.enabled,
        labels: { ...known.labels, ...(isPlainObject(s.labels) ? s.labels : {}) },
      });
      byId.delete(known.id);
    }
    // Anything the document never mentioned keeps its place at the end, so a
    // section added in a later release appears instead of silently going missing.
    out.sections = ordered.concat([...byId.values()]);
  }
  return out;
}

function filePath(dataDir) {
  return path.join(dataDir, FILE);
}

// Never throws. A missing file is the normal first-run case; a corrupt one is
// reported and then ignored in favour of the defaults.
function load(dataDir) {
  const p = filePath(dataDir);
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch {
    return { doc: defaults(), source: 'defaults' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`copy.json could not be parsed (${err.message}); using the built-in copy.`);
    return { doc: defaults(), source: 'defaults', error: err.message };
  }
  const errors = validate(parsed);
  if (errors.length) {
    console.error(`copy.json is not valid (${errors.join(' ')}); using the built-in copy.`);
    return { doc: defaults(), source: 'defaults', error: errors.join(' ') };
  }
  return { doc: merge(parsed), source: 'file' };
}

// Written to a temporary file and renamed, so an interrupted save leaves the
// previous document intact rather than a half-written one the bridge would
// then refuse on next boot.
function save(dataDir, doc) {
  const errors = validate(doc);
  if (errors.length) return { ok: false, errors };
  fs.mkdirSync(dataDir, { recursive: true });
  const p = filePath(dataDir);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
  fs.renameSync(tmp, p);
  return { ok: true, doc: merge(doc) };
}

function reset(dataDir) {
  try { fs.unlinkSync(filePath(dataDir)); } catch { /* already absent */ }
  return { ok: true, doc: defaults() };
}

module.exports = { load, save, reset, validate, merge, filePath };
