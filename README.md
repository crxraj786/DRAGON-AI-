# DRAGON AI

Mobile-first, Hindi/English AI assistant built with React, Vite, and Vercel serverless functions. The project is developed in small, verifiable stages and does not claim unavailable features as complete.

## Current implementation

- Responsive chat UI, local conversation history and settings
- Hindi/English interface preference, JSON export, delete confirmation and network status
- Defensive client-side storage/input utilities with Node unit tests
- `POST /api/chat` server-side endpoint for Groq, Gemini and OpenRouter
- API keys are read only from server environment variables; never put keys in frontend code or `VITE_*` variables
- Demo mode is clearly labelled and remains available without a provider key

## Configure a real provider on Vercel

The endpoint is implemented, but live provider replies require a key configured in the Vercel project's **server-side Environment Variables**. Keys are not included in the repository.

Choose one or more:
- `GROQ_API_KEY` (optional `GROQ_MODEL`; default `llama-3.3-70b-versatile`)
- `GEMINI_API_KEY` (Gemini 2.0 Flash endpoint)
- `OPENROUTER_API_KEY` (optional `OPENROUTER_MODEL`; default `openrouter/auto`)
- `APP_URL` (optional, used as OpenRouter referrer)

Only use a provider/model whose current terms and free quota meet your needs. Free quota and model availability can change. Adding a key is an explicit setup step and may require a provider account; no provider is assumed to be free forever. After changing environment variables, redeploy the Vercel project.

## Local development

Requires Node.js 20+ and npm.

```sh
npm install
npm test
npm run build
npm run dev
```

## Android APK build

A GitHub Actions workflow builds a **debug APK artifact** on pushes that touch app files or when manually started from the Actions tab. Open the repository's Actions page, select **Build Android APK**, then choose **Run workflow**. When it succeeds, open the run and download the `dragon-ai-android-debug-apk` artifact. This is a debug build, not a Play Store release or signed production APK.

The APK bundles the web UI and calls the deployed server API at `https://dragon-ai-five.vercel.app`. Real model replies still require a provider API key configured only in the Vercel server environment. The APK workflow does not configure or embed secrets. Android 10 compatibility must still be confirmed by installing and testing on a device.

## Deployment

Production app: https://dragon-ai-five.vercel.app  
Repository: https://github.com/crxraj786/DRAGON-AI-

Vercel automatically deploys commits pushed to `main`. GitHub Pages workflow requires Pages to be enabled in repository settings; Vercel is the current deployment target.

## Security and current limitations

The API endpoint validates provider and message shape/length, caps request size, times out provider calls, and returns sanitized error messages. It does **not yet** provide distributed rate limiting, user authentication, per-user quotas, abuse detection, or audit logs; do not treat this as a hardened public production API until those are added. Never commit secrets.

Not yet implemented: account system, cloud-synced history, file/document analysis, web research, image/audio/video tools, safe code execution, agents/automation, admin/workspace permissions, full accessibility/E2E testing, and Android APK build/signing/installation validation.

## Project principles

- Preserve existing project data and the PRD.
- Keep code modular, testable and accessible.
- Clearly distinguish demo behavior from real provider-backed behavior.
- Only claim capabilities that have actually been implemented and verified.
- Respect the zero-budget constraint; check current provider quotas and terms before use.
