# Inspector and Playbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Visualize current Minds cognition in an embeddable Inspector and runnable Playbox, verified with Playwright interactions and visually inspected screenshot baselines.

**Architecture:** A React Inspector consumes a read-only, versioned inspection view. A Playbox Node server owns real Mind instances, scenario operations, recordings, and provider credentials; its Vite frontend embeds the Inspector.

**Tech Stack:** TypeScript, React, Vite, Node HTTP server, Node test runner, Playwright Chromium.

**Spec:** [Approved design](../specs/2026-10-08-inspector-playbox-design.md).

## Global Constraints

- Use the public `@minds/core` API; keep React out of core and Playbox dependencies out of Inspector.
- Offline fixture mode is the default and clearly labeled throughout the run.
- OpenRouter configuration and credentials remain server-side; automated tests never invoke live inference.
- Each Mind retains its own record sequence; do not invent global cognitive ordering or missing causes.
- Mark intentions, actions, and relationships unimplemented.
- Use fixed viewport sizes, locale, timezone, reduced motion, and Chromium; generate and compare baselines in the same OS/browser environment.
- Open and visually inspect every screenshot baseline before accepting it, checking layout, clipping, readable values, selection, responsive behavior, and consistency with runtime data.
- Work in the supplied workspace: it has no Git metadata, so worktrees and commits are unavailable.

## Review Focus

1. Advancing time before a scripted step must never deliver an older timestamp; pin this in host tests.
2. Partial recipient failure must preserve successful commits and allow failed-recipient retry; pin this in host tests.
3. A new run or changed Mind must clear stale record selection; pin this in Playwright tests.
4. Long observation text and raw payloads must remain readable without horizontal page overflow; pin this in the narrow screenshot test.
5. Malformed requests and unsupported view schemas must display useful errors without leaking credentials or rendering misleading state; pin this in API and embedding tests.

## Task 1: Read-only contract and scenario host

**Files:** Create `packages/inspector/src/contract.ts`, `apps/playbox/server/scenario.ts`, `apps/playbox/server/host.ts`, `apps/playbox/test/host.test.ts`, package manifests and TypeScript configurations. Modify root workspace/build/test scripts.

**Interfaces:** Export `InspectionView` with schemaVersion 1, runId, time, status, providerMode, minds containing snapshot/records, and operational errors. Export `createHost(provider: CognitionProvider, mode: 'fixture' | 'openrouter'): PlayboxHost`; host methods are `getView()`, `step()`, `advanceTime()`, `inject(input)`, `retry()`, and `exportRecording()`. Async mutations return the resulting inspection view. Export `createFixtureProvider(): CognitionProvider` and `createScenario(runId: string)`.

- [x] Write tests asserting: an injected observation reaches only selected recipients; an exported Mind recording restores to the same snapshot; 1,000 ms decay halves an emotion configured with a 1,000 ms half-life; returned views are detached copies.
- [x] Write tests asserting: advancing time then stepping never regresses time; concurrent host operations serialize; rejected appraisal preserves prior Mind revision; partial failure retains successful records and retry does not duplicate them; malformed recipient/content/provenance/processing inputs reject before mutation.
- [x] Run tests and confirm missing implementation failures; implement the typed contract, deterministic scenario provider, and host using the public core API. Use two characters with opposing access goals and three recipient-specific scripted events. Schedule each event at `max(currentTime, configuredTime)`.
- [x] Run host tests and existing core suite; require all passing before proceeding.

## Task 2: Server API and provider boundary

**Files:** Create `apps/playbox/server/api.ts`, `apps/playbox/server/main.ts`, `apps/playbox/test/api.test.ts`, and `apps/playbox/vite.config.ts`.

**Interfaces:** Export `createApiServer(options): http.Server` with injectable provider factory for tests. Routes: GET `/api/config`, GET `/api/run`, POST `/api/run` (fresh run/provider mode), POST `/api/step`, POST `/api/advance`, POST `/api/inject`, POST `/api/retry`, GET `/api/recording`. Responses carry the task 1 view or a safe error message.

- [x] Write API tests asserting fresh fixture initialization, malformed JSON/body rejection, absent OpenRouter configuration rejection, safe provider-failure responses, rejected reset while pending, and downloadable versioned recording envelopes. Configure a test provider to reject without external requests.
- [x] Run and observe expected failures; implement the API with bounded request bodies, loopback binding, environment-only OpenRouter credentials, and allowlisted responses. Polling GET requests expose pending state while mutation requests await completion.
- [x] Verify API tests and ensure credential sentinel strings never appear in responses or recordings.

## Task 3: Reusable Inspector

**Files:** Create `packages/inspector/src/index.ts`, `Inspector.tsx`, `StatePanels.tsx`, `Timeline.tsx`, `RecordDetail.tsx`, `styles.css`, and `apps/playbox/src/embedding-fixture.tsx`.

**Interfaces:** Export `Inspector({view, selectedMindId, selectedRecordId, onSelectMind, onSelectRecord}: InspectorProps)`. Callbacks carry the selected Mind ID or selected record ID. `selectedRecordId` is null when no entry is selected. Package exports component, public types, and stylesheet.

- [x] Add Playwright tests against an independent embedding fixture for selecting Minds, selecting record causes, unsupported schema messaging, empty trace handling, keyboard operation, and selection changes between views. Run and observe missing-UI failures before implementing.
- [x] Implement overview, belief/evidence and memory panels, affect meters, ordered per-Mind timeline, causal links, transition comparisons, provider details, skipped appraisal explanation, and expandable raw JSON. Render missing links explicitly; use native buttons and labeled inputs.
- [x] Verify component package builds without Playbox imports; run embedding interaction tests.

## Task 4: Playbox frontend and end-to-end behavior

**Files:** Create `apps/playbox/index.html`, `apps/playbox/src/main.tsx`, `App.tsx`, `api.ts`, `ScenarioControls.tsx`, `styles.css`, `playwright.config.ts`, and `tests/playbox.spec.ts`. Update npm development and test commands.

**Interfaces:** Frontend fetches task 2 endpoints and supplies task 1 view to task 3 Inspector. Separate selection state from host state; clear selection on run replacement and Mind change. Mutation controls disable while pending. Errors remain separate from cognitive timeline.

- [x] Write Playwright assertions for initial fixture label, character switching, event stepping and sourced beliefs, causal navigation, before/after affect values, decay, memory-only injection, validation errors, pending controls, reset isolation, retry visibility, recording download, and keyboard navigation. Run to establish expected failures.
- [x] Implement responsive workspace with host facts/scenario controls alongside Inspector, provider availability selection, safe failure messages, and recording download. Poll only as necessary to show in-flight status and clean up timers on unmount.
- [x] Run end-to-end tests in Chromium against the real local fixture server; require no browser errors and no external inference.

## Task 5: Screenshot verification and delivery

**Files:** Create `tests/visual.spec.ts`, `tests/visual.spec.ts-snapshots/*`, `docs/implementation/inspector-playbox.md`; update `README.md` and verified capability evidence in `CAPABILITIES.md`.

- [x] Add screenshots with behavior assertions for initial desktop (1440×1000), selected event with visible transition details (1440×1000), and narrow viewport (390×844). Use locale `en-US`, timezone `Europe/Warsaw`, reduced motion, animations disabled, and fixed fixture IDs/time.
- [x] Generate candidate baselines using `npm run test:e2e -- --update-snapshots`. Open each PNG using the image-view tool. Inspect layout, clipping, text readability, values, selection, and responsive behavior; fix observed defects and regenerate affected images. Include long observation content in narrow coverage and assert document width does not exceed viewport width.
- [x] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` against accepted baselines. Review package boundaries and requirements, resolving failures before declaring completion.
- [x] Document startup, provider setup, Inspector embedding, recording export, snapshot generation OS/browser, snapshot update commands, coverage counts, visual inspection findings, and unverified live inference. Mark only fully satisfied capabilities complete; note partial evidence separately.
- [x] Present runnable commands and links to the implementation and inspected screenshot artifacts. No commits are attempted in this non-Git workspace.
