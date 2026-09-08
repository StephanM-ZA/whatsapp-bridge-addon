// test/copyStore.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load, save, reset, validate, merge } = require('../src/copyStore');
const { defaults } = require('../src/copyDefaults');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wa-copy-'));
}

// ---- the rule that matters: a bad document never stops the bridge ----------

test('a missing file yields the defaults, not an error', () => {
  const { doc, source } = load(tmpdir());
  assert.equal(source, 'defaults');
  assert.equal(doc.strings.title, defaults().strings.title);
});

test('unparseable JSON falls back to defaults instead of throwing', () => {
  const d = tmpdir();
  fs.writeFileSync(path.join(d, 'copy.json'), '{ this is not json');
  const realErr = console.error; console.error = () => {};
  try {
    const { doc, source, error } = load(d);
    assert.equal(source, 'defaults');
    assert.ok(error);
    assert.equal(doc.strings.title, defaults().strings.title);
  } finally { console.error = realErr; }
});

test('a structurally invalid document falls back to defaults', () => {
  const d = tmpdir();
  fs.writeFileSync(path.join(d, 'copy.json'), JSON.stringify({ sections: 'not a list' }));
  const realErr = console.error; console.error = () => {};
  try {
    const { source } = load(d);
    assert.equal(source, 'defaults');
  } finally { console.error = realErr; }
});

// ---- validation --------------------------------------------------------

test('validate accepts the defaults themselves', () => {
  assert.deepEqual(validate(defaults()), []);
});

test('validate rejects a non-text label', () => {
  const doc = defaults();
  doc.sections[0].labels.weather = 42;
  assert.ok(validate(doc).some((e) => /must be text/.test(e)));
});

test('validate rejects an unknown section id', () => {
  const doc = defaults();
  doc.sections.push({ id: 'teleporter', enabled: true, labels: {} });
  assert.ok(validate(doc).some((e) => /unknown id/.test(e)));
});

test('validate rejects a duplicated section', () => {
  const doc = defaults();
  doc.sections.push({ id: 'gate', enabled: true, labels: {} });
  assert.ok(validate(doc).some((e) => /more than once/.test(e)));
});

test('validate refuses a message with every section switched off', () => {
  const doc = defaults();
  doc.sections.forEach((s) => { s.enabled = false; });
  assert.ok(validate(doc).some((e) => /at least one section/i.test(e)));
});

// ---- merge -------------------------------------------------------------

test('a partial document keeps the defaults it does not mention', () => {
  const merged = merge({ strings: { title: '🏡 *My House*' } });
  assert.equal(merged.strings.title, '🏡 *My House*');
  assert.equal(merged.strings.na, defaults().strings.na);
  assert.equal(merged.sections.length, defaults().sections.length);
});

test('section order follows the document', () => {
  const merged = merge({ sections: [{ id: 'gate' }, { id: 'weather' }] });
  assert.equal(merged.sections[0].id, 'gate');
  assert.equal(merged.sections[1].id, 'weather');
});

test('a section the document never mentions survives at the end', () => {
  const merged = merge({ sections: [{ id: 'gate' }] });
  const ids = merged.sections.map((s) => s.id);
  assert.equal(ids[0], 'gate');
  // everything else is still present - a section added in a later release
  // must not vanish just because an older saved document predates it
  assert.deepEqual(new Set(ids), new Set(defaults().sections.map((s) => s.id)));
});

test('an unknown section id is dropped rather than breaking the merge', () => {
  const merged = merge({ sections: [{ id: 'teleporter' }, { id: 'gate' }] });
  assert.ok(!merged.sections.some((s) => s.id === 'teleporter'));
  assert.equal(merged.sections[0].id, 'gate');
});

test('a quip override keeps its siblings', () => {
  const merged = merge({ quips: { showerCall: { neither: 'Nope.' } } });
  assert.equal(merged.quips.showerCall.neither, 'Nope.');
  assert.equal(merged.quips.showerCall.bothReady, defaults().quips.showerCall.bothReady);
});

// ---- save / reset ------------------------------------------------------

test('save refuses an invalid document and changes nothing on disk', () => {
  const d = tmpdir();
  const bad = defaults();
  bad.sections[0].labels.weather = 42;
  const res = save(d, bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.length);
  assert.equal(fs.existsSync(path.join(d, 'copy.json')), false);
});

test('save then load round-trips an edit', () => {
  const d = tmpdir();
  const doc = defaults();
  doc.strings.title = '🏡 *Home*';
  assert.equal(save(d, doc).ok, true);
  assert.equal(load(d).doc.strings.title, '🏡 *Home*');
  assert.equal(load(d).source, 'file');
});

test('reset removes the file and returns the defaults', () => {
  const d = tmpdir();
  const doc = defaults();
  doc.strings.title = 'changed';
  save(d, doc);
  const res = reset(d);
  assert.equal(res.doc.strings.title, defaults().strings.title);
  assert.equal(load(d).source, 'defaults');
});

test('reset on a directory with no file is not an error', () => {
  assert.equal(reset(tmpdir()).ok, true);
});
