// src/server.js
'use strict';

const http = require('http');
const { load, save, reset, validate } = require('./copyStore');
const { defaults } = require('./copyDefaults');
const { editorHtml } = require('./editorHtml');

// The copy editor, served into Home Assistant's sidebar through Ingress.
//
// Ingress hands the add-on the FULL proxied path -
// /api/hassio_ingress/<token>/api/copy - and that token changes, so routing
// matches on the path's tail rather than on an exact path. The page likewise
// builds its request URLs from its own location, because it has no way to know
// its base until it is loaded.
//
// No auth here on purpose: Ingress only forwards requests from a session
// already logged in to Home Assistant, and the add-on port is not published.
// Adding a second login would protect nothing and be one more thing to lose.

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readJson(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      // A copy document is a few kilobytes. Anything approaching this is not
      // one, and streaming it into memory first would be the wrong way to
      // find that out.
      if (size > (limitBytes || 256 * 1024)) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function createServer({ dataDir, renderPreview }) {
  return http.createServer(async (req, res) => {
    const path = (req.url || '/').split('?')[0];
    const tail = path.replace(/\/+$/, '');

    try {
      if (req.method === 'GET' && /(^|\/)api\/copy$/.test(tail)) {
        const { doc, source, error } = load(dataDir);
        return send(res, 200, { doc, defaults: defaults(), source, error: error || null });
      }

      if (req.method === 'PUT' && /(^|\/)api\/copy$/.test(tail)) {
        const body = await readJson(req);
        const errors = validate(body);
        if (errors.length) return send(res, 400, { ok: false, errors });
        const result = save(dataDir, body);
        return send(res, result.ok ? 200 : 400, result);
      }

      if (req.method === 'POST' && /(^|\/)api\/reset$/.test(tail)) {
        return send(res, 200, reset(dataDir));
      }

      // Preview renders the document POSTED to it, not the saved one, so the
      // message can be seen BEFORE committing to it.
      if (req.method === 'POST' && /(^|\/)api\/preview$/.test(tail)) {
        const body = await readJson(req);
        const errors = validate(body);
        if (errors.length) return send(res, 400, { ok: false, errors });
        if (typeof renderPreview !== 'function') {
          return send(res, 503, { ok: false, errors: ['Preview is not available.'] });
        }
        try {
          return send(res, 200, { ok: true, message: await renderPreview(body) });
        } catch (err) {
          return send(res, 200, { ok: false, errors: ['Could not reach Home Assistant: ' + err.message] });
        }
      }

      if (req.method === 'GET') {
        return send(res, 200, editorHtml(), 'text/html; charset=utf-8');
      }
      return send(res, 404, { ok: false, errors: ['Not found.'] });
    } catch (err) {
      return send(res, 400, { ok: false, errors: [err.message] });
    }
  });
}

function startServer(opts) {
  const port = opts.port || 8099;
  const server = createServer(opts);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Copy editor listening on ${port} (served through Ingress).`);
  });
  return server;
}

module.exports = { createServer, startServer };
