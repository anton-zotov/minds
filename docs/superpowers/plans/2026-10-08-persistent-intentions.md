# Persistent Intentions Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. User explicitly requested no further approval questions; execute inline.

**Goal:** Persistent, evidence-reconsidered strategies in Minds with full Playbox inspection.
**Architecture:** An opt-in planning state machine yields provider operations and consumes validated outputs. Runtime awaits it; persistence replays it synchronously. Inspector consumes public state and causal records.
**Tech Stack:** Existing TypeScript/React/Node 24 workspace; no new dependencies.
**Spec:** ../specs/2026-10-08-persistent-intentions-design.md

## Global Constraints

- Keep one Mind and existing subjective turn semantics.
- Keep version-1 appraisal-only recordings compatible; version-2 planning recordings replay without inference.
- All event work commits atomically; keep secrets out of browser and recordings.
- Default six candidates/evaluations, three active, uint32 seed 42; limits 1–32 and 1–8 respectively.
- Completion and autonomous actions remain pending; no live calls in automated verification.

## Review Focus

- Reconsideration with omitted IDs preserves existing commitments; unknown IDs reject atomically.
- Oversized pools, duplicates, and repeated acceptances cannot exceed limits.
- Changes in beliefs/affect are visible to planning in the same event.
- Replay rejects altered stage inputs, judgments, summaries and final intention state.
- Secret echoes (including escaped JSON) and timed-out calls cannot leak or commit.

### Task 1: Core planning and persistence

Files: `packages/minds/src/{types,validation,runtime,inspection,persistence}.ts`, new `intentions.ts`, new `test/intentions.test.ts`.
Interfaces: `MindConfig.intentionPolicy`, optional `MindSnapshot.intentions` for version 1, `CognitionProvider.intentions`, `IntentionProvider` four operations, `intentionMachine` generator, async `planIntentions` and sync `replayIntentions`.

- [x] Write failing tests for first adoption, distinct goal, commitment, reconsideration, affect/identity input, duplicate suppression and every stopping reason, rollback/retry, known references, limits, restore continuation and trace tampering. Assert existing version-1 behavior remains exact.
- [x] Run tests to see missing planning behavior fail.
- [x] Implement types, bounded validation, deterministic machine, atomic runtime integration and replay.
- [x] Run `npm test`; expect all tests green.

### Task 2: OpenRouter planning

Files: provider adapter and new planning request/schema helper; provider tests; Playbox API configuration.
Interfaces: `OpenRouterOptions.intentions`, generation/decision model overrides; same recorded metadata shape as appraisal.

- [x] Write failing fake-HTTP tests for all operation roles, model routing, actual requests/usage, malformed output, timeout and credential echoes.
- [x] Run tests and confirm failures from absent planning support.
- [x] Implement structured planning calls with exact schemas and shared request security/error rules.
- [x] Run `npm test`; expect all tests green.

### Task 3: Host and Inspector

Files: `apps/playbox/server/{scenario,host,api}.ts`, existing Inspector panels/details/sequence/styles, existing browser and host tests.
Interfaces: version-2 native recordings inside existing version-1 Playbox envelope; decision payload `stage` discriminates planning from appraisal.

- [x] Add failing host/browser assertions for adoption, preserved commitment, reopening reconsideration, candidate details and historical intentions.
- [x] Run tests to confirm absent host/UI behavior.
- [x] Enable fixture and live planning, show intention state and changes, stage calls and summary; adapt tests that previously assumed one decision per event.
- [x] Run unit tests, typecheck and browser interactions. Refresh intentional visual baselines and inspect all changed images; then rerun comparisons.

### Task 4: Review, evidence, docs

- [x] Review implementation against spec and five failure classes; fix material findings with failing regression tests first.
- [x] Update DESIGN, README, CAPABILITIES and implementation evidence with actual supported scope and tests.
- [x] Run `npm test`, `npm run typecheck`, `npm run test:e2e`; production build is included in `npm test`.
- [x] Start/restart local preview if needed and deliver verified result.

No Git metadata exists in this workspace; preserve files and a durable execution ledger instead of branch/commit operations.

