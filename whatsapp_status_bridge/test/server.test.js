// test/server.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('../src/server');
const { defaults } = require('../src/copyDefaults');

function withServer(opts, fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-srv-'));
  const server = createServer({ dataDir, ...opts });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', async () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      try { resolve(await fn(base, dataDir)); }
      catch (e) { reject(e); }
      finally { server.close(); }
    });
  });
}

// Ingress proxies the FULL token path through, so every route is exercised
// under one to prove the tail-matching works rather than only bare paths.
const PREFIX = '/api/hassio_ingress/AbC123token';

test('GET / serves the editor page', async () => {
  await withServer({}, async (base) => {
    const r = await fetch(base + PREFIX + '/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(await r.text(), /Status Message Copy/);
  });
});

test('GET api/copy returns the document and the defaults', async () => {
  await withServer({}, async (base) => {
    const r = await fetch(base + PREFIX + '/api/copy');
    const j = await r.json();
    assert.equal(j.source, 'defaults');
    assert.equal(j.doc.strings.title, defaults().strings.title);
    assert.ok(j.defaults.sections.length);
  });
});

test('PUT api/copy saves a valid document', async () => {
  await withServer({}, async (base, dataDir) => {
    const doc = defaults();
    doc.strings.title = '🏡 *Casa*';
    const r = await fetch(base + PREFIX + '/api/copy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
    assert.match(fs.readFileSync(path.join(dataDir, 'copy.json'), 'utf8'), /Casa/);
  });
});

test('PUT api/copy REFUSES an invalid document and writes nothing', async () => {
  await withServer({}, async (base, dataDir) => {
    const doc = defaults();
    doc.sections[0].labels.weather = 42;
    const r = await fetch(base + PREFIX + '/api/copy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.ok, false);
    assert.ok(j.errors.length);
    assert.equal(fs.existsSync(path.join(dataDir, 'copy.json')), false);
  });
});

test('malformed JSON is rejected, not thrown', async () => {
  await withServer({}, async (base) => {
    const r = await fetch(base + PREFIX + '/api/copy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{ nope' });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).ok, false);
  });
});

test('preview renders the POSTED document, not the saved one', async () => {
  await withServer({ renderPreview: async (d) => 'RENDERED:' + d.strings.title },
    async (base) => {
      const doc = defaults();
      doc.strings.title = 'UNSAVED';
      const r = await fetch(base + PREFIX + '/api/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
      const j = await r.json();
      assert.equal(j.ok, true);
      assert.equal(j.message, 'RENDERED:UNSAVED');
    });
});

test('a preview that cannot reach HA reports it instead of 500ing', async () => {
  await withServer({ renderPreview: async () => { throw new Error('ECONNREFUSED'); } },
    async (base) => {
      const r = await fetch(base + PREFIX + '/api/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(defaults()) });
      assert.equal(r.status, 200);
      const j = await r.json();
      assert.equal(j.ok, false);
      assert.match(j.errors[0], /ECONNREFUSED/);
    });
});

test('reset removes a saved document', async () => {
  await withServer({}, async (base, dataDir) => {
    const doc = defaults(); doc.strings.title = 'temp';
    await fetch(base + PREFIX + '/api/copy', { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
    assert.equal(fs.existsSync(path.join(dataDir, 'copy.json')), true);
    const r = await fetch(base + PREFIX + '/api/reset', { method: 'POST' });
    assert.equal((await r.json()).ok, true);
    assert.equal(fs.existsSync(path.join(dataDir, 'copy.json')), false);
  });
});

test('an oversized body is refused rather than buffered', async () => {
  await withServer({}, async (base) => {
    const huge = JSON.stringify({ strings: { title: 'x'.repeat(400 * 1024) } });
    const r = await fetch(base + PREFIX + '/api/copy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: huge })
      .catch(() => ({ status: 400 }));   // the socket may be destroyed mid-send
    assert.ok(r.status === 400 || r.status === 413);
  });
});
