const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 24;
const MAX_CONTENT_LENGTH = 8000;
const PROVIDERS = new Set(["groq", "gemini", "openrouter"]);
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;
const SYSTEM_INSTRUCTION = "You are DRAGON AI, a capable multilingual assistant. Detect the language and script of each latest user message and reply naturally in that same language, including Hindi, Hinglish, English, French, Italian, Portuguese, and mixed-language requests. Follow explicit user instructions about response language or mixing languages. The app interface language is independent of your reply language. Never tell ordinary users to configure API keys, providers, servers, or developer settings; these are internal implementation details. If asked about capabilities, be honest. Give clear, useful answers, format code in fenced code blocks, and never claim actions or live access unless actually performed.";
const requestBuckets = new Map();
const ALLOWED_ORIGINS = new Set(["https://dragon-ai-five.vercel.app", "https://localhost", "capacitor://localhost"]);

function isRateLimited(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const address = (typeof forwarded === "string" ? forwarded.split(",")[0] : "") || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(address);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    if (requestBuckets.size > 1000) {
      for (const [key, item] of requestBuckets) if (now - item.startedAt >= RATE_WINDOW_MS) requestBuckets.delete(key);
      if (requestBuckets.size > 1000) requestBuckets.clear();
    }
    requestBuckets.set(address, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        body = "";
        return;
      }
      if (!tooLarge) body += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        return;
      }
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(Object.assign(new Error("Invalid JSON body"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function normalizeMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) {
    throw Object.assign(new Error("Send between 1 and 24 messages."), { status: 400 });
  }
  return value.map((item) => {
    if (!item || !["user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" || !item.content.trim() ||
        item.content.length > MAX_CONTENT_LENGTH) {
      throw Object.assign(new Error("A message is invalid or exceeds 8000 characters."), { status: 400 });
    }
    return { role: item.role, content: item.content.trim() };
  });
}

async function openAiCompatible({ endpoint, key, model, messages, signal, extraHeaders = {} }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, ...messages], temperature: 0.4, max_tokens: 2048 }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 502;
    throw Object.assign(new Error(status === 429 ? "AI provider rate limit reached. Try again later." : "The AI service is temporarily unavailable. Please try again shortly."), { status });
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw Object.assign(new Error("AI provider returned an empty response."), { status: 502 });
  }
  return content.trim();
}

async function callGemini({ key, messages, signal }) {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }, contents, generationConfig: { maxOutputTokens: 2048 } }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = response.status === 429 ? 429 : 502;
    throw Object.assign(new Error(status === 429 ? "AI provider rate limit reached. Try again later." : "The AI service is temporarily unavailable. Please try again shortly."), { status });
  }
  const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
  if (typeof content !== "string" || !content.trim()) {
    throw Object.assign(new Error("AI provider returned an empty response."), { status: 502 });
  }
  return content.trim();
}

export default async function handler(req, res) {
  const origin = req.headers?.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return send(res, 403, { error: "Origin not allowed." });
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { error: "Method not allowed." });
  }
  if (isRateLimited(req)) return send(res, 429, { error: "Too many requests from this connection. Wait a minute and try again." });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const body = await readBody(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) return send(res, 400, { error: "Request body must be a JSON object." });
    if (!PROVIDERS.has(body.provider)) return send(res, 400, { error: "Select a supported AI provider." });
    const messages = normalizeMessages(body.messages);
    let content;
    if (body.provider === "groq") {
      const key = process.env.GROQ_API_KEY;
      if (!key) return send(res, 503, { error: "The selected AI service is temporarily unavailable." });
      content = await openAiCompatible({ endpoint: "https://api.groq.com/openai/v1/chat/completions", key, model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", messages, signal: controller.signal });
    } else if (body.provider === "openrouter") {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return send(res, 503, { error: "The selected AI service is temporarily unavailable." });
      content = await openAiCompatible({ endpoint: "https://openrouter.ai/api/v1/chat/completions", key, model: process.env.OPENROUTER_MODEL || "openrouter/auto", messages, signal: controller.signal, extraHeaders: { "HTTP-Referer": process.env.APP_URL || "https://dragon-ai-five.vercel.app", "X-Title": "DRAGON AI" } });
    } else {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return send(res, 503, { error: "The selected AI service is temporarily unavailable." });
      content = await callGemini({ key, messages, signal: controller.signal });
    }
    return send(res, 200, { content, provider: body.provider });
  } catch (error) {
    if (res.writableEnded) return;
    if (error?.name === "AbortError") return send(res, 504, { error: "AI request timed out. Please retry." });
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return send(res, status, { error: status === 500 ? "AI service unavailable." : (error.message || "Request failed.") });
  } finally {
    clearTimeout(timeout);
  }
}
