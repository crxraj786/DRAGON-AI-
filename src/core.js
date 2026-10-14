/**
 * DRAGON AI client-side core utilities.
 * Keep these functions deterministic and browser-safe so they can be unit tested.
 */
export const STORAGE_KEYS = Object.freeze({
  history: 'dragon.history.v1',
  settings: 'dragon.settings.v1',
});

export const DEFAULT_SETTINGS = Object.freeze({
  lang: 'en',
  provider: 'gemini',
  save: true,
});

export const MAX_MESSAGE_LENGTH = 8000;
export const MAX_HISTORY_ITEMS = 500;
export const MAX_MESSAGES_PER_CHAT = 2000;

export function safeParseJSON(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function readStorage(key, fallback, storage = globalThis.localStorage) {
  try {
    if (!storage) return fallback;
    const value = storage.getItem(key);
    return value === null ? fallback : safeParseJSON(value, fallback);
  } catch {
    // Storage can be unavailable in private mode, embedded browsers, or quota/security contexts.
    return fallback;
  }
}

export function writeStorage(key, value, storage = globalThis.localStorage) {
  try {
    if (!storage) return { ok: false, reason: 'unavailable' };
    storage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'QuotaExceededError' ? 'quota' : 'unavailable',
    };
  }
}

export function removeStorage(key, storage = globalThis.localStorage) {
  try {
    storage?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function createId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fall through for restricted webviews.
  }
  return `dragon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function validateMessage(value) {
  if (typeof value !== 'string') return { ok: false, reason: 'invalid-type' };
  const content = value.trim();
  if (!content) return { ok: false, reason: 'empty' };
  if (content.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: 'too-long' };
  return { ok: true, content };
}

export function normalizeSettings(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    lang: input.lang === 'hi' ? 'hi' : 'en',
    // Gemini is the configured real-AI default; provider selection is internal.
    provider: ['groq', 'gemini', 'openrouter'].includes(input.provider) ? input.provider : 'gemini',
    save: input.save !== false,
  };
}

export function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_HISTORY_ITEMS).flatMap((chat) => {
    if (!chat || typeof chat !== 'object' || Array.isArray(chat) || typeof chat.id !== 'string' || !chat.id) return [];
    const messages = Array.isArray(chat.messages)
      ? chat.messages.slice(0, MAX_MESSAGES_PER_CHAT).flatMap((message) => {
          if (!message || typeof message !== 'object' || Array.isArray(message)) return [];
          if (!['user', 'assistant', 'system'].includes(message.role)) return [];
          if (typeof message.content !== 'string') return [];
          return [{
            id: typeof message.id === 'string' && message.id ? message.id : createId(),
            role: message.role,
            content: message.content.slice(0, MAX_MESSAGE_LENGTH * 4),
            ...(message.demo === true ? { demo: true } : {}),
          }];
        })
      : [];
    return [{
      id: chat.id.slice(0, 160),
      title: typeof chat.title === 'string' ? chat.title.slice(0, 160) : 'New chat',
      messages,
      updated: Number.isFinite(chat.updated) ? chat.updated : 0,
    }];
  });
}

export function makeExportPayload({ settings, chats, now = new Date() }) {
  return {
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    settings: normalizeSettings(settings),
    chats: normalizeHistory(chats),
  };
}
