import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createId, makeExportPayload, normalizeHistory, normalizeSettings,
  readStorage, safeParseJSON, validateMessage, writeStorage,
} from './core.js';

test('JSON parsing falls back instead of throwing', () => {
  assert.deepEqual(safeParseJSON('{bad', { safe: true }), { safe: true });
  assert.equal(safeParseJSON('null', 7), null);
});

test('storage failures are handled without crashing', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { const e = new Error(); e.name = 'QuotaExceededError'; throw e; } };
  assert.equal(readStorage('x', [] , broken).length, 0);
  assert.deepEqual(writeStorage('x', {}, broken), { ok: false, reason: 'quota' });
});

test('message validation rejects blank and over-limit messages', () => {
  assert.deepEqual(validateMessage('  '), { ok: false, reason: 'empty' });
  assert.equal(validateMessage('  hello  ').content, 'hello');
  assert.equal(validateMessage('x'.repeat(8001)).reason, 'too-long');
  assert.equal(validateMessage(42).reason, 'invalid-type');
});

test('settings are allowlisted and default to the configured real AI', () => {
  assert.deepEqual(normalizeSettings({ lang: 'fr', provider: 'unknown', save: false }), { lang: 'en', provider: 'gemini', save: false });
  assert.equal(normalizeSettings({}).provider, 'gemini');
  assert.equal(normalizeSettings({ lang: 'en', provider: 'groq' }).provider, 'groq');
});

test('history normalization drops malformed records and caps fields', () => {
  const chats = normalizeHistory([
    null,
    { id: 'c1', title: 'A'.repeat(200), messages: [{ role: 'root', content: 'bad' }, { role: 'user', content: 'hello' }] },
  ]);
  assert.equal(chats.length, 1);
  assert.equal(chats[0].title.length, 160);
  assert.equal(chats[0].messages.length, 1);
  assert.equal(chats[0].messages[0].content, 'hello');
});

test('export is versioned and contains normalized data', () => {
  const payload = makeExportPayload({
    settings: { provider: 'demo' },
    chats: [{ id: 'c1', messages: [], updated: 1 }],
    now: new Date('2026-01-02T03:04:05.000Z'),
  });
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, '2026-01-02T03:04:05.000Z');
  assert.equal(payload.chats[0].id, 'c1');
  assert.equal(payload.settings.provider, 'gemini');
});

test('id generator returns a non-empty string', () => {
  assert.equal(typeof createId(), 'string');
  assert.ok(createId().length > 5);
});
