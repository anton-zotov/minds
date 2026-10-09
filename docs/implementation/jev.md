# Jev planning integration

Implemented 2026-10-08 as a bounded extension of the existing intention provider. Jev handles candidate evaluation, sufficiency and intention reconsideration. Chat models handle appraisal, initial strategy proposals and revised wording. Action selection, speech, personality-derived affect and Jev appraisal remain outside this increment.

## Contract and policy

Requests use `POST https://openrouter.ai/api/alpha/decisions` with Bearer authentication and `{ model, state, questions }`, following the [official API contract](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request) and [Jev guide](https://openrouter.ai/docs/guides/community/jev). Jev model IDs are never sent to chat completions; invalid generative role assignments fail before inference.

Each candidate request batches five ordered score rubrics and one acceptance question. Scores range from 0 to 4, including fractional expected scores, and normalize to 0–1. Boolean `noul` answers determine acceptance, sufficiency, generation and approval of proposed revisions. Lifecycle `choice` answers use the selected option's probability to gate changes. All four thresholds default to 0.65 and can be configured through `OpenRouterOptions.jevPolicy`; every call records the policy and underlying answers. These thresholds are explicit host policy, not calibrated claims about model quality.

Reconsideration preserves commitments when selected changes fall below the threshold. Jev chooses keep, reprioritize, revise, suspend/reactivate or abandon. Revised wording is requested from the generative model only when warranted, then independently approved by Jev. The primary reconsideration record contains the two supplemental operations with actual models, requests, results and usage. Inspector call totals include those operations.

The deterministic runtime remains authoritative for goal immutability, evidence IDs, stable identities, duplicate suppression, active limits and atomic event commits. If no active commitment remains, it requests bounded candidates even when Jev returns `generateMore: false`. Abandonment does not claim success. Memory-only observations and time advancement skip inference.

Malformed answers, unknown choices, incomplete distributions, invalid probabilities, HTTP errors and timeouts fail without partial state changes. The shared transport timeout covers response-body reading. Credentials are redacted recursively from both decoded responses and recorded requests. Restoring recordings replays validated outputs without inference.

## Playbox and verification

Playbox decision model precedence is `OPENROUTER_INTENTION_DECISION_MODEL`, `OPENROUTER_DECISION_MODEL`, then `typesafe/jev-1.13`. Non-Jev overrides retain structured chat support. The configuration endpoint exposes only model names and endpoint kind. Offline fixture mode remains the initial mode.

Evidence: [adapter tests](../../packages/minds/test/jev.test.ts), [API configuration tests](../../apps/playbox/test/api.test.ts), and [browser inspection test](../../tests/jev-inspection.spec.ts). Verified `npm test` (69 passing core/host/API tests and production build), `npm run typecheck`, and `npm run test:e2e` (18 passing browser tests, including all unchanged visual baselines). Independent adapter review found no actionable correctness/security issues. No live Jev inference was performed; cost, latency and behavioral quality require a separate live evaluation.
