import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import handler from './chat.js';

function mockRequest(method = 'POST', body = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = {};
  req.destroy = () => {};
  queueMicrotask(() => {
    if (method === 'POST') {
      req.emit('data', Buffer.from(JSON.stringify(body)));
      req.emit('end');
    }
  });
  return req;
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    writableEnded: false,
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = value ? JSON.parse(value) : undefined; this.writableEnded = true; },
  };
}

test('API rejects methods other than POST', async () => {
  const res = mockResponse();
  await handler(mockRequest('GET'), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST, OPTIONS');
});

test('API rejects unsupported providers before making network requests', async () => {
  const res = mockResponse();
  await handler(mockRequest('POST', { provider: 'unknown', messages: [{ role: 'user', content: 'hello' }] }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /provider/i);
});

test('API validates message shape before provider configuration', async () => {
  const res = mockResponse();
  await handler(mockRequest('POST', { provider: 'groq', messages: [] }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /messages/i);
});

test('API reports missing server-side key without exposing a secret', async () => {
  const previous = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const res = mockResponse();
    await handler(mockRequest('POST', { provider: 'groq', messages: [{ role: 'user', content: 'hello' }] }), res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /GROQ_API_KEY/);
    assert.equal(JSON.stringify(res.body).includes('Bearer'), false);
  } finally {
    if (previous !== undefined) process.env.GROQ_API_KEY = previous;
  }
});

test('API rejects malformed JSON with a client error', async () => {
  const req = new EventEmitter();
  req.method = 'POST';
  req.destroy = () => {};
  queueMicrotask(() => {
    req.emit('data', Buffer.from('{not-json'));
    req.emit('end');
  });
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /JSON/i);
});

test('API rejects oversized request bodies', async () => {
  const req = new EventEmitter();
  req.method = 'POST';
  req.destroy = () => {};
  queueMicrotask(() => {
    req.emit('data', Buffer.alloc(65 * 1024, 97));
    req.emit('end');
  });
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 413);
  assert.match(res.body.error, /too large/i);
});

test('API throttles repeated requests from one client bucket', async () => {
  const previous = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    let last;
    for (let i = 0; i < 13; i += 1) {
      const req = mockRequest('POST', { provider: 'groq', messages: [{ role: 'user', content: 'hello' }] });
      req.headers['x-forwarded-for'] = '198.51.100.123';
      const res = mockResponse();
      await handler(req, res);
      last = res;
    }
    assert.equal(last.statusCode, 429);
    assert.match(last.body.error, /too many requests/i);
  } finally {
    if (previous !== undefined) process.env.GROQ_API_KEY = previous;
  }
});

test('API handles Android CORS preflight requests', async () => {
  const req = mockRequest('OPTIONS');
  req.headers.origin = 'https://localhost';
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://localhost');
  assert.match(res.headers['Access-Control-Allow-Methods'], /POST/);
});

test('API rejects unapproved browser origins', async () => {
  const req = mockRequest('POST', { provider: 'groq', messages: [{ role: 'user', content: 'hello' }] });
  req.headers.origin = 'https://malicious.example';
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});
