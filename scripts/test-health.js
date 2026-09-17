/**
 * Health Check Test Suite for https://gerizimmount.com/health
 *
 * Can be run with:
 *   node scripts/test-health.js
 *   node --test scripts/test-health.js
 *   npm run test:health
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const HEALTH_URL = process.env.HEALTH_CHECK_URL || 'https://gerizimmount.com/health';
const TIMEOUT_MS = 10000;

test('Gerizim Mount Health Endpoint Test Suite', async (t) => {
  let response;
  let responseData;
  let latencyMs;

  await t.test('1. Connect to endpoint and measure response time', async () => {
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      response = await fetch(HEALTH_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HealthCheck-Test-Runner/1.0',
        },
        signal: controller.signal,
      });
      latencyMs = Date.now() - startTime;
      responseData = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(`\n  ℹ Health Endpoint: ${HEALTH_URL}`);
    console.log(`  ℹ HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`  ℹ Latency: ${latencyMs}ms`);
    console.log(`  ℹ Response Body:`, JSON.stringify(responseData));

    assert.ok(response, 'Expected response to be defined');
  });

  await t.test('2. Response HTTP status is 200 OK', () => {
    assert.strictEqual(
      response.status,
      200,
      `Expected status code 200, got ${response.status}`
    );
  });

  await t.test('3. Response headers include application/json Content-Type', () => {
    const contentType = response.headers.get('content-type') || '';
    assert.ok(
      contentType.includes('application/json'),
      `Expected Content-Type to include application/json, got "${contentType}"`
    );
  });

  await t.test('4. Response payload contains { status: "UP" }', () => {
    assert.ok(responseData, 'Expected response body to not be null or undefined');
    assert.strictEqual(typeof responseData, 'object', 'Expected response body to be an object');
    assert.strictEqual(
      responseData.status,
      'UP',
      `Expected status to be "UP", got "${responseData?.status}"`
    );
  });

  await t.test('5. Response timestamp is a valid ISO 8601 date string', () => {
    assert.ok(responseData.timestamp, 'Expected response to contain "timestamp"');
    const parsedDate = new Date(responseData.timestamp);
    assert.ok(
      !isNaN(parsedDate.getTime()),
      `Expected valid timestamp, got "${responseData.timestamp}"`
    );
  });

  await t.test('6. Response latency is within acceptable limit (< 5000ms)', () => {
    assert.ok(
      latencyMs < 5000,
      `Response took too long: ${latencyMs}ms (limit: 5000ms)`
    );
  });
});
