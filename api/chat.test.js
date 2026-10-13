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
    end(value) { this.body = JSON.parse(value); this.writableEnded = true; },
  };
}

test('API rejects methods other than POST', async () => {
  const res = mockResponse();
  await handler(mockRequest('GET'), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
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
