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

  // return_response is required to get anything back from a service call —
  // without it HA runs the service and replies with an empty 200, which is
  // how weather.get_forecasts is invoked (it has no state/attribute form).
  async function callService(domain, service, serviceData, { returnResponse = false } = {}) {
    const url = `${BASE_URL}/services/${domain}/${service}${returnResponse ? '?return_response' : ''}`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(serviceData),
    });
    if (!res.ok) {
      throw new Error(`HA API returned ${res.status} for service ${domain}.${service}`);
    }
    return res.json();
  }

  return { getState, ping, callService };
}

module.exports = { createHaClient, BASE_URL };
