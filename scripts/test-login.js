/**
 * Login API Test Suite for https://gerizimmount.com/api/v1/admin/auth/login
 *
 * Can be run with:
 *   node scripts/test-login.js
 *   npm run test:login
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'https://gerizimmount.com/api/v1/admin';
const LOGIN_URL = `${BASE_URL}/auth/login`;
const TIMEOUT_MS = 15000;

test('Admin Login API Endpoint Test Suite', async (t) => {
  let authToken;

  // Test 1: Successful Login with Valid Admin Credentials (Native fetch)
  await t.test('1. [fetch] POST /auth/login with valid credentials returns 200 and token', async () => {
    const startTime = Date.now();
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latency = Date.now() - startTime;
    const body = await response.json();

    console.log(`\n  ℹ Endpoint: ${LOGIN_URL}`);
    console.log(`  ℹ HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`  ℹ Latency: ${latency}ms`);
    console.log(`  ℹ Token Received: ${body?.token ? body.token.substring(0, 25) + '...' : 'NONE'}`);
    console.log(`  ℹ Expires At: ${body?.expiresAt ? new Date(body.expiresAt).toISOString() : 'NONE'}`);

    assert.strictEqual(response.status, 200, `Expected 200 OK, got ${response.status}`);
    assert.ok(body.token, 'Expected response to contain "token"');
    assert.ok(typeof body.token === 'string', 'Expected "token" to be a string');
    assert.ok(body.expiresAt, 'Expected response to contain "expiresAt"');

    authToken = body.token;
  });

  // Test 2: Successful Login via Axios (matching React Native apiClient setup)
  await t.test('2. [Axios] POST /auth/login returns valid response matching mobile client', async () => {
    const axiosClient = axios.create({
      baseURL: BASE_URL,
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const response = await axiosClient.post('/auth/login', {
      username: 'admin',
      password: 'admin',
    });

    assert.strictEqual(response.status, 200);
    assert.ok(response.data?.token);
    assert.strictEqual(typeof response.data.token, 'string');
  });

  // Test 3: CORS Preflight (OPTIONS) check
  await t.test('3. [CORS] OPTIONS /auth/login preflight request is accepted', async () => {
    const response = await fetch(LOGIN_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Accept, Authorization',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    console.log(`  ℹ CORS Preflight Status: ${response.status}`);
    console.log(`  ℹ Allow-Origin Header: ${response.headers.get('access-control-allow-origin')}`);

    assert.ok([200, 204].includes(response.status), `Expected 200 or 204 for OPTIONS, got ${response.status}`);
  });

  // Test 4: Invalid Credentials Handling (401 or expected error)
  await t.test('4. POST /auth/login with wrong credentials handles error appropriately', async () => {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username: 'invalid_user_xyz',
        password: 'wrong_password_123',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    console.log(`  ℹ Invalid Login Status: ${response.status}`);
    assert.ok(response.status >= 400, `Expected 4xx error status code for bad credentials, got ${response.status}`);
  });
});
