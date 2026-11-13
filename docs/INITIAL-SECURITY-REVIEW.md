# DRAGON AI — Initial Security Review

**Review date:** 2026-11-13  
**Scope:** Read-only review of the default branch files `api/chat.js`, `api/health.js`, their existing tests, and CI workflows. No live scanning or exploit attempts were performed.  
**Status:** Preliminary code review; not a penetration-test certification.

## Executive summary
The project already has useful baseline controls: request-size limits, message count/length validation, provider allowlisting, server-side provider keys, provider timeouts, sanitized provider errors, origin allowlisting, and unit tests.

The main risk is that the public chat endpoint can be called without user authentication. The current in-memory rate limiter is not a reliable production abuse-control mechanism across serverless instances and trusts a client-supplied forwarding header as an identifier. This can expose configured provider quota to unauthorized use.

## Findings

### DRAGON-001 — Public AI endpoint has no user authentication
- **Severity:** High (business/financial abuse risk; severity depends on whether the endpoint is intentionally public)
- **Evidence:** `api/chat.js` accepts POST requests after origin validation and rate limiting; no session, token, account, or signed-client verification is performed.
- **Impact:** Any script or HTTP client can call the endpoint directly. Browser CORS restrictions do not stop non-browser clients. If a provider key is configured, unauthorized callers may consume its quota.
- **Recommendation:** Add server-verified user authentication or a short-lived signed access token, then enforce per-user quotas. Do not embed a permanent shared secret in the web app or APK.
- **Retest:** Unauthenticated requests should be rejected; authenticated requests should be quota-limited.

### DRAGON-002 — Rate limiting is process-local and can be bypassed across instances
- **Severity:** Medium
- **Evidence:** `requestBuckets` is a module-level in-memory Map in `api/chat.js`; it is reset when an instance restarts and is not shared between serverless instances.
- **Impact:** Limits may not apply consistently when requests are routed to multiple instances or after cold starts.
- **Recommendation:** Use a shared, server-side rate-limit store when a suitable free service is explicitly approved. Until then, treat the current limiter as best-effort only and set provider-side quota/budget alerts where available.
- **Retest:** Verify limits across concurrent instances and cold starts.

### DRAGON-003 — Client-supplied X-Forwarded-For is used as the rate-limit key
- **Severity:** Medium
- **Evidence:** `isRateLimited()` reads `req.headers['x-forwarded-for']` and uses its first value before falling back to the socket address.
- **Impact:** If the hosting platform does not overwrite or sanitize this header, callers may vary the value to obtain fresh buckets. This is conditional on platform proxy behavior and must be verified in deployment.
- **Recommendation:** Use the hosting platform's documented trusted client-IP source; never trust arbitrary client-supplied forwarding values. Prefer authenticated per-user rate limits.
- **Retest:** Confirm proxy header behavior in the deployed environment and test that spoofed values do not bypass limits.

### DRAGON-004 — CORS allowlist is not an authorization boundary
- **Severity:** Informational (design clarification)
- **Evidence:** Origin allowlisting is implemented, but requests without an Origin header are accepted.
- **Impact:** This is normal for APIs that support mobile/native clients, but it means CORS does not prevent direct API calls.
- **Recommendation:** Keep CORS for browser access control, and implement actual authentication/authorization independently.
- **Retest:** Confirm browser origins are restricted and unauthenticated direct requests are rejected after authentication is added.

## Positive controls observed
- Request body capped at 64 KiB.
- Message list limited to 1–24 messages and each message to 8,000 characters.
- Provider names are allowlisted.
- Provider keys are read from server environment variables.
- Provider calls have a 25-second abort timeout.
- Provider error details are not returned verbatim.
- Responses use `Cache-Control: no-store`.
- Existing tests cover method validation, malformed/oversized JSON, provider selection, missing keys, basic throttling, CORS and mocked Gemini responses.

## Not assessed
- Live production behavior, Vercel proxy/header semantics, environment variable configuration, deployed HTTP security headers, dependency vulnerabilities, secret history, Supabase/Vercel project settings, Android APK contents, authentication on any future routes, and third-party infrastructure.
- No external targets were scanned. No credentials or secrets were requested or accessed.

## Recommended next implementation order
1. Confirm whether the chat API is intentionally public or should require user accounts.
2. Add server-side authentication and per-user quota enforcement before adding autonomous scanners.
3. Add dependency and secret scanning to CI.
4. Add a security headers policy and verify it against the deployed app.
5. Re-test in staging with synthetic accounts and a strict allowlist.
