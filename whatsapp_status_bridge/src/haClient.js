// src/haClient.js
const BASE_URL = 'http://supervisor/core/api';

function createHaClient(supervisorToken, fetchImpl = fetch) {
  function authHeaders() {
    return {
      Authorization: `Bearer ${supervisorToken}`,
      'Content-Type': 'application/json',
    };
  }

  async function getState(entityId) {
    const res = await fetchImpl(`${BASE_URL}/states/${entityId}`, { headers: authHeaders() });
    if (!res.ok) {
      throw new Error(`HA API returned ${res.status} for ${entityId}`);
    }
    return res.json();
  }

  async function ping() {
    try {
      const res = await fetchImpl(`${BASE_URL}/`, { headers: authHeaders() });
      return res.ok;
    } catch {
      return false;
    }
  }

  return { getState, ping };
}

module.exports = { createHaClient, BASE_URL };
