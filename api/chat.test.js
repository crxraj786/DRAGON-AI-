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
    assert.match(res.body.error, /temporarily unavailable/i);
    assert.equal(JSON.stringify(res.body).includes('GROQ_API_KEY'), false);
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


test('Gemini provider returns a real-shaped multilingual completion and keeps the key server-side', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'test-server-only-key';
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return { candidates: [{ content: { parts: [{ text: 'नमस्ते! मैं आपकी मदद कर सकता हूँ।' }] } }] };
      },
    };
  };
  try {
    const req = mockRequest('POST', {
      provider: 'gemini',
      messages: [{ role: 'user', content: 'नमस्ते, हिंदी में जवाब दो।' }],
    });
    const res = mockResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.content, 'नमस्ते! मैं आपकी मदद कर सकता हूँ।');
    assert.equal(res.body.provider, 'gemini');
    assert.match(captured.url, /models\/gemini-3\.8-flash:generateContent$/);
    assert.equal(captured.options.headers['x-goog-api-key'], 'test-server-only-key');
    assert.equal(JSON.stringify(res.body).includes('test-server-only-key'), false);
    const requestBody = JSON.parse(captured.options.body);
    assert.match(requestBody.systemInstruction.parts[0].text, /same language/i);
    assert.equal(requestBody.contents[0].parts[0].text, 'नमस्ते, हिंदी में जवाब दो।');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('Gemini provider maps provider rate limits to HTTP 429 without leaking provider details', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'test-server-only-key';
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    async json() { return { error: { message: 'private provider detail' } }; },
  });
  try {
    const res = mockResponse();
    await handler(mockRequest('POST', {
      provider: 'gemini',
      messages: [{ role: 'user', content: 'Hello' }],
    }), res);
    assert.equal(res.statusCode, 429);
    assert.match(res.body.error, /rate limit/i);
    assert.equal(JSON.stringify(res.body).includes('private provider detail'), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
