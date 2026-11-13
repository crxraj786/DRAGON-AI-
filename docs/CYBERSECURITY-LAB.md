# DRAGON AI — Cybersecurity Lab

## Goal
Build a zero-budget-first, Android-friendly security workspace for defensive testing of DRAGON AI and other systems the owner controls or is explicitly authorized to assess.

## Safety boundary
- Test only assets owned by the project owner or covered by written authorization.
- Start with passive inspection and static analysis.
- Active scans must be explicitly scoped to an allowlisted host/API and run with conservative rate limits.
- No credential theft, persistence, stealth, destructive testing, data exfiltration, or testing of third-party targets.
- Keep proof-of-concept checks non-destructive and use synthetic/test data.

## Current project constraints
- Owner's primary device: Android 10, non-root, no PC/laptop.
- Budget: free services and open-source tools only; no paid APIs or surprise cloud costs.
- Existing DRAGON AI stack: React + Vite + Capacitor, Vercel serverless API, GitHub Actions.
- Do not put API keys in frontend code, APK assets, Git history, or VITE_* variables.

## Tool assessment and intended roles
| Tool | Intended role | Initial decision |
|---|---|---|
| Strix | AI-assisted authorized web/API penetration testing | Evaluate after baseline static review; isolate in disposable Linux environment |
| PentestGPT | Guided learning, CTF and test planning | Optional learning assistant; not a production scanner |
| CAI | Agent framework for security workflows | Defer: repository shown in reference material is archived |
| PentAGI | Multi-agent penetration-testing orchestration | Defer until sandbox, model costs and resource requirements are verified |
| Reaper | Application/API traffic inspection | Evaluate only if current repository, platform support and maintenance are verified |

These tools are not interchangeable and should not all be installed at once. Prefer a small, auditable toolchain over an unsafe autonomous agent.

## Phase 1 — Baseline defensive audit
1. Inventory routes, serverless endpoints, dependencies, secrets handling and CI workflows.
2. Review authentication, authorization, request validation, CORS, headers, error handling and logging.
3. Add dependency and secret scanning to CI using free tools.
4. Add safe unit tests for API validation, size limits, timeouts and error sanitization.
5. Produce a findings register with severity, evidence, remediation and retest status.

## Phase 2 — Controlled dynamic testing
1. Define an explicit allowlist for staging URLs and test accounts.
2. Use a disposable Linux runner/container; do not run scanners directly on the Android phone.
3. Start with passive checks and low-rate, non-destructive requests.
4. Require human approval before any active test that could change data or affect availability.
5. Save sanitized reports; never store real credentials, tokens or personal data in reports.

## Phase 3 — Remediation and verification
- Fix confirmed findings in small commits.
- Add regression tests for each fix.
- Re-run the same authorized checks and record before/after evidence.
- Do not claim a system is secure solely because a scanner found nothing.

## Zero-budget deployment policy
- No paid cloud VM, paid model API, or trial that silently converts to billing.
- Before using any hosted runner/service, verify free-tier limits and billing controls.
- Prefer GitHub Actions for short CI checks and local/static analysis.
- Any optional cloud sandbox must be explicitly approved by the owner first.

## First deliverables
- This scope and execution plan.
- A baseline code/configuration review.
- CI security checks and a remediation report.
