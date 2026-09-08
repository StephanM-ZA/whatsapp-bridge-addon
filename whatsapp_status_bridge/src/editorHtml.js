// src/editorHtml.js
'use strict';

// The editor page, as one self-contained string.
//
// No build step, no bundler, no CDN: this add-on runs on a Raspberry Pi behind
// a Cloudflare tunnel, and a page that fetches a framework from the internet
// would be the only part of the system that stops working when the tunnel
// does. Everything the page needs is in this file.

function editorHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Status Message Copy</title>
<style>
  :root {
    --bg:#101013; --card:#17171a; --hover:#1e1e22; --line:rgba(255,255,255,.12);
    --fg:#faf9f6; --meta:#96918a; --teal:#00e5a0; --red:#ff6b6b; --radius:10px;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 Inter,system-ui,sans-serif; }
  .wrap { max-width:820px; margin:0 auto; padding:20px 16px 120px; }
  h1 { font-size:22px; font-weight:800; margin:0 0 4px; }
  .sub { color:var(--meta); margin:0 0 20px; }
  fieldset { border:1px solid var(--line); border-radius:var(--radius); margin:0 0 16px; padding:14px 16px; background:var(--card); }
  legend { padding:0 8px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; font-size:11px; color:var(--meta); }
  label { display:block; margin:10px 0 4px; font-size:12px; color:var(--meta); }
  input[type=text] { width:100%; padding:9px 10px; border-radius:8px; border:1px solid var(--line);
    background:var(--hover); color:var(--fg); font:13px/1.4 ui-monospace,"JetBrains Mono",monospace; }
  input[type=text]:focus { outline:2px solid var(--teal); outline-offset:1px; border-color:transparent; }
  .row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line); }
  .row:last-child { border-bottom:0; }
  .grow { flex:1; min-width:0; }
  .name { font-weight:600; }
  button { font:inherit; cursor:pointer; border-radius:8px; border:1px solid var(--line);
    background:var(--hover); color:var(--fg); padding:7px 12px; }
  button:hover { border-color:var(--teal); }
  button.primary { background:var(--teal); color:#12281f; border-color:var(--teal); font-weight:700; }
  button.danger { color:var(--red); }
  button.icon { padding:4px 9px; line-height:1; }
  .bar { position:fixed; left:0; right:0; bottom:0; background:var(--card);
    border-top:1px solid var(--line); padding:12px 16px; display:flex; gap:10px; align-items:center; }
  .bar .spacer { flex:1; }
  .msg { font-size:12px; }
  .msg.err { color:var(--red); }
  .msg.ok { color:var(--teal); }
  pre.preview { white-space:pre-wrap; word-break:break-word; background:var(--hover);
    border:1px solid var(--line); border-radius:var(--radius); padding:14px; font:13px/1.55 ui-monospace,monospace; }
  .muted { color:var(--meta); font-size:12px; margin:6px 0 0; }
  details summary { cursor:pointer; color:var(--meta); font-size:12px; }
</style></head>
<body><div class="wrap">
  <h1>Status Message Copy</h1>
  <p class="sub">Every word, and the order it appears in. Preview before you save &mdash; nothing here can break the bridge.</p>
  <div id="app">Loading&hellip;</div>
</div>

<div class="bar">
  <button class="primary" id="save">Save</button>
  <button id="preview">Preview</button>
  <span class="spacer"></span>
  <span class="msg" id="msg"></span>
  <button class="danger" id="reset">Reset to defaults</button>
</div>

<script>
// Ingress mounts this page under a token path that changes, so every request
// is built from the page's own location rather than an absolute path.
var BASE = location.pathname.replace(/\\/+$/, '') + '/';
var doc = null, defaultsDoc = null;

function api(path, opts) {
  return fetch(BASE + path, opts).then(function (r) {
    return r.json().then(function (j) { return { status: r.status, body: j }; });
  });
}
function say(text, kind) {
  var el = document.getElementById('msg');
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ' ' + kind : '');
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
  return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }

function field(labelText, value, onInput) {
  var wrap = document.createElement('div');
  var l = document.createElement('label'); l.textContent = labelText;
  var i = document.createElement('input'); i.type = 'text'; i.value = value == null ? '' : value;
  i.addEventListener('input', function () { onInput(i.value); });
  wrap.appendChild(l); wrap.appendChild(i);
  return wrap;
}

function render() {
  var app = document.getElementById('app');
  app.innerHTML = '';

  // ---- wording that is not tied to a section ----
  var fsWords = document.createElement('fieldset');
  fsWords.innerHTML = '<legend>Header &amp; separators</legend>';
  var LABELS = {
    title: 'Title line', timestampPrefix: 'Timestamp prefix', headerRule: 'Rule under the header',
    divider: 'Divider between sections', na: 'Shown when a sensor is unavailable',
    unreachable: 'Shown when Home Assistant cannot be reached'
  };
  Object.keys(LABELS).forEach(function (k) {
    fsWords.appendChild(field(LABELS[k], doc.strings[k], function (v) { doc.strings[k] = v; }));
  });
  app.appendChild(fsWords);

  // ---- sections: order, on/off, labels ----
  var fsSec = document.createElement('fieldset');
  fsSec.innerHTML = '<legend>Sections</legend>' +
    '<p class="muted">Drag order with the arrows. Switch a section off and its divider closes up.</p>';
  doc.sections.forEach(function (sec, idx) {
    var row = document.createElement('div'); row.className = 'row';

    var cb = document.createElement('input'); cb.type = 'checkbox';
    cb.checked = sec.enabled !== false;
    cb.addEventListener('change', function () { sec.enabled = cb.checked; });
    row.appendChild(cb);

    var name = document.createElement('span');
    name.className = 'name grow'; name.textContent = sec.id;
    row.appendChild(name);

    var up = document.createElement('button'); up.className = 'icon'; up.textContent = '\\u2191';
    up.disabled = idx === 0;
    up.addEventListener('click', function () {
      var t = doc.sections[idx - 1]; doc.sections[idx - 1] = doc.sections[idx]; doc.sections[idx] = t; render();
    });
    var down = document.createElement('button'); down.className = 'icon'; down.textContent = '\\u2193';
    down.disabled = idx === doc.sections.length - 1;
    down.addEventListener('click', function () {
      var t = doc.sections[idx + 1]; doc.sections[idx + 1] = doc.sections[idx]; doc.sections[idx] = t; render();
    });
    row.appendChild(up); row.appendChild(down);
    fsSec.appendChild(row);

    var det = document.createElement('details');
    det.innerHTML = '<summary>' + esc(sec.id) + ' wording</summary>';
    Object.keys(sec.labels || {}).forEach(function (k) {
      det.appendChild(field(k, sec.labels[k], function (v) { sec.labels[k] = v; }));
    });
    fsSec.appendChild(det);
  });
  app.appendChild(fsSec);

  // ---- quips ----
  Object.keys(doc.quips).forEach(function (group) {
    var fs = document.createElement('fieldset');
    fs.innerHTML = '<legend>' + esc(group) + '</legend>';
    Object.keys(doc.quips[group]).forEach(function (k) {
      fs.appendChild(field(k, doc.quips[group][k], function (v) { doc.quips[group][k] = v; }));
    });
    app.appendChild(fs);
  });

  // ---- weather condition names ----
  var fsCond = document.createElement('fieldset');
  fsCond.innerHTML = '<legend>Weather condition names</legend>';
  var det = document.createElement('details');
  det.innerHTML = '<summary>Show all ' + Object.keys(doc.conditionLabels).length + '</summary>';
  Object.keys(doc.conditionLabels).forEach(function (k) {
    det.appendChild(field(k, doc.conditionLabels[k], function (v) { doc.conditionLabels[k] = v; }));
  });
  fsCond.appendChild(det);
  app.appendChild(fsCond);

  var pv = document.createElement('div'); pv.id = 'previewSlot';
  app.appendChild(pv);
}

function showPreview(text) {
  var slot = document.getElementById('previewSlot');
  slot.innerHTML = '<fieldset><legend>Preview</legend><pre class="preview">' + esc(text) + '</pre></fieldset>';
  slot.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

document.getElementById('save').addEventListener('click', function () {
  say('Saving\\u2026');
  api('api/copy', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(doc) })
    .then(function (r) {
      if (r.body && r.body.ok) { say('Saved. The next status message uses it.', 'ok'); }
      else { say((r.body.errors || ['Save failed.']).join(' '), 'err'); }
    })
    .catch(function (e) { say(String(e), 'err'); });
});

document.getElementById('preview').addEventListener('click', function () {
  say('Rendering\\u2026');
  api('api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify(doc) })
    .then(function (r) {
      if (r.body && r.body.ok) { say('', ''); showPreview(r.body.message); }
      else { say((r.body.errors || ['Preview failed.']).join(' '), 'err'); }
    })
    .catch(function (e) { say(String(e), 'err'); });
});

document.getElementById('reset').addEventListener('click', function () {
  if (!confirm('Discard your wording and go back to the built-in copy?')) return;
  api('api/reset', { method: 'POST' }).then(function (r) {
    doc = r.body.doc; render(); say('Back to the built-in copy.', 'ok');
  });
});

api('api/copy').then(function (r) {
  doc = r.body.doc; defaultsDoc = r.body.defaults;
  render();
  if (r.body.error) { say('Saved copy was unreadable, showing the built-in set: ' + r.body.error, 'err'); }
}).catch(function (e) {
  document.getElementById('app').textContent = 'Could not load the copy document: ' + e;
});
</script></body></html>`;
}

module.exports = { editorHtml };
