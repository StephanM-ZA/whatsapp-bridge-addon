// test/haClient.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHaClient } = require('../src/haClient');

test('getState calls the Supervisor proxy URL with the bearer token and returns JSON', async () => {
  let capturedUrl;
  let capturedHeaders;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({ entity_id: 'sensor.foo', state: '42', attributes: {} }),
    };
  };

  const client = createHaClient('test-token', fetchImpl);
  const result = await client.getState('sensor.foo');

  assert.equal(capturedUrl, 'http://supervisor/core/api/states/sensor.foo');
  assert.equal(capturedHeaders.Authorization, 'Bearer test-token');
  assert.deepEqual(result, { entity_id: 'sensor.foo', state: '42', attributes: {} });
});

test('getState throws on a non-ok response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const client = createHaClient('test-token', fetchImpl);

  await assert.rejects(() => client.getState('sensor.missing'), /404/);
});

test('ping returns true when the API root responds ok', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ message: 'API running.' }) });
  const client = createHaClient('test-token', fetchImpl);

  assert.equal(await client.ping(), true);
});

test('ping returns false when the fetch throws', async () => {
  const fetchImpl = async () => { throw new Error('network down'); };
  const client = createHaClient('test-token', fetchImpl);

  assert.equal(await client.ping(), false);
});
