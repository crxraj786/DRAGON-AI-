import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './health.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    writableEnded: false,
    setHeader(key, value) { this.headers[key] = value; },
    end(value) {
      this.body = value ? JSON.parse(value) : undefined;
      this.writableEnded = true;
    },
  };
}

test('health endpoint reports service status without exposing provider keys', () => {
  const previous = {
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const res = response();
    handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.realAiConfigured, false);
    assert.deepEqual(res.body.providers, { groq: false, gemini: false, openrouter: false });
    assert.equal(JSON.stringify(res.body).includes('Bearer'), false);
  } finally {
    for (const [key, value] of Object.entries({ GROQ_API_KEY: previous.groq, GEMINI_API_KEY: previous.gemini, OPENROUTER_API_KEY: previous.openrouter })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('health endpoint supports approved Capacitor preflight', () => {
  const res = response();
  handler({ method: 'OPTIONS', headers: { origin: 'https://localhost' } }, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://localhost');
});

test('health endpoint rejects unsupported methods and origins', () => {
  const methodRes = response();
  handler({ method: 'POST', headers: {} }, methodRes);
  assert.equal(methodRes.statusCode, 405);
  const originRes = response();
  handler({ method: 'GET', headers: { origin: 'https://malicious.example' } }, originRes);
  assert.equal(originRes.statusCode, 403);
});
