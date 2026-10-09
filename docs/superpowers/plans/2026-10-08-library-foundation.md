# Minds Library Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution is intended to stay in this session; no delegation is needed for this slice.

**Goal:** Deliver a standalone TypeScript library with an OpenRouter adapter that ingests observations into persistent Mind state, applies validated provider-driven belief and affect updates, and exposes ordered, restorable inspection records.

**Architecture:** Three projects share one workspace: `packages/minds`, `packages/inspector`, and `apps/playbox`. This plan implements only `packages/minds` and its tests; the React Inspector and Playbox receive separate plans after the public inspection boundary works. The runtime owns state, providers propose cognitive updates, and hosts retain world authority.

**Tech Stack:** TypeScript, npm workspaces, ES modules, Node.js built-in test runner, and OpenRouter Chat Completions via Fetch. Compile TypeScript before running tests or the headless example. The core uses standard JavaScript APIs and has no Node, React, DOM, or provider-service runtime dependencies; the optional `@minds/core/openrouter` entry point supplies the first model adapter. Development uses the installed Node.js 26.7.0; package scripts declare Node.js 24 or newer for development tooling.

**Spec:** [DESIGN.md](../../../DESIGN.md), especially sections 3, 8–10, 13–15; [CAPABILITIES.md](../../../CAPABILITIES.md), version 0.3. User selected TypeScript for web-game clients and React for the Inspector, and OpenRouter for inference, on 2026-10-08.

## Global Constraints

- The library runs without either UI project.
- The Inspector can be embedded without the Playbox and displays supplied state and traces.
- The host application owns the world: facts, observation permissions, available actions, action validation, execution, and consequences.
- Diagnostic-only data is excluded from cognition inputs.
- All durable cognitive state must be owned by Minds, not by a model's conversation history.
- No service keys or paid inference are required for runtime verification; use deterministic providers in tests and label the sample provider as a fixture.
- OpenRouter is the first inference service. Hosts provide API keys and configurable model IDs; keys are excluded from snapshots, traces, recordings, errors, and browser bundles.
- OpenRouter-backed cognition runs in a trusted host/server process. React Inspector components receive diagnostic data through the inspection adapter, never provider credentials.
- Use the existing workspace directly: it currently contains documents only and is not a Git repository. Do not create a worktree or make Git commits until a repository exists.

## Review Focus

1. Concurrent or duplicate observations must not double-apply effects or lose committed state — Task 2 tests queueing and idempotency.
2. Provider exceptions, invalid numbers, and foreign evidence references must leave the pre-operation state intact — Task 2 tests atomic failure and validation.
3. Callers and providers must not mutate internal state through received objects — Tasks 1–3 test detached copies of inputs and outputs.
4. Simulation time must not go backward, and time-only affect changes must remain visible — Task 2 tests monotonic time and explicit decay records.
5. Restoring a snapshot must preserve event deduplication, trace ordering, and Mind identity — Task 3 tests continuing after restoration and rejecting incompatible recordings. Task 4 additionally exercises OpenRouter HTTP failures and credential isolation.

## Scope and decisions for this slice

This is the first library increment, not completion of the P1 cognition prototype. It proves observation → memory → belief/affect proposal → validated state commit → inspection, including an OpenRouter appraisal adapter. Intention generation/revision, action selection, speech, relationship appraisal, Jev-specific integration, and UI code are subsequent increments. The snapshot contains only systems implemented by this increment; additional state sections enter the contract when those systems are built.

Use these initial representations:

- IDs are nonempty strings scoped to a run and Mind. The host supplies `runId`, `mindId`, and observation IDs. The runtime derives record IDs from the run/Mind/sequence tuple using an unambiguous encoding.
- Simulation timestamps and affect half-lives are milliseconds. Timestamps are finite, nonnegative, and monotonic per Mind; equal timestamps are allowed. Half-lives must be positive and finite.
- Identity is plain descriptive data, with name and description. One assigned goal is a string. No prescribed personality taxonomy.
- Beliefs are `{ id, statement, confidence, evidenceIds }`, with confidence in `[0, 1]`. Belief proposals upsert by ID; evidence must reference memories the Mind holds. This is a provisional simple schema, not a complete epistemic model.
- Mood and emotions are separate maps of configured numerical dimensions. Every dimension stores baseline, value, and half-life. Both layers use normalized `[0, 1]` values in this increment; no fixed emotion vocabulary is imposed.
- At a time advance, each value approaches its baseline by `baseline + (value - baseline) * 2 ** (-elapsedMs / halfLifeMs)`. Provider deltas are then applied and clamped to `[0, 1]`; retain the requested delta and actual change in diagnostics.
- Every accepted observation creates one memory, distinguishing `witnessed` from `reported` provenance. A provider receives the stored observation and only this Mind's permitted context; objective world facts are absent from the public input contract.
- Initial retrieval is the latest 20 memories in ingestion order, including the current observation. Record their IDs. More sophisticated retrieval is a later increment.
- A `memoryOnly` observation commits memory and elapsed-time affect changes without calling the provider. The host supplies this processing hint; it does not predetermine a character's appraisal.
- Provider calls are asynchronous and serialized per Mind. Proposals validate before an atomic commit. On failure, reject the operation without advancing state/time or marking the observation processed. The host can retry the same observation ID.
- State revision advances once per successful ingest or forward time advance. Trace records have a separate strictly increasing sequence; equal-time records retain that order.
- Inspection returns detached copies. Subscriptions run after a commit, receive detached records, and cannot break committed state if a subscriber throws.
- A versioned recording includes state, retained trace, and processed observation IDs. Restoration validates the whole object; the runtime does not trust TypeScript types as input validation.

## File structure

| Path | Responsibility |
|---|---|
| `package.json`, `package-lock.json`, `.gitignore`, `tsconfig.json` | Workspace scripts, pinned development dependencies, build configuration |
| `packages/minds/package.json`, `packages/minds/tsconfig.json` | Independent library package and its build |
| `packages/minds/src/types.ts` | Public JSON-compatible state, provider, observation, and inspection types |
| `packages/minds/src/validation.ts` | Runtime input and proposal validation |
| `packages/minds/src/affect.ts` | Pure bounded affect updates and time decay |
| `packages/minds/src/runtime.ts` | Mind initialization, serial operation queue, observation commits |
| `packages/minds/src/inspection.ts` | Inspection copies, record generation, subscriptions |
| `packages/minds/src/persistence.ts` | Versioned recording validation and restoration |
| `packages/minds/src/providers/openrouter.ts` | Optional server-hosted OpenRouter cognition adapter |
| `packages/minds/src/providers/appraisal-schema.ts` | Structured-output schema and response validation |
| `packages/minds/src/index.ts` | Public package exports |
| `packages/minds/test/initialization.test.ts` | Isolation, input validation, public construction |
| `packages/minds/test/observations.test.ts` | Ingestion, provider contract, atomicity, ordering |
| `packages/minds/test/affect.test.ts` | Decay, clamping, and nonfinite input rejection |
| `packages/minds/test/inspection.test.ts` | Records, causality, copy isolation, subscriptions |
| `packages/minds/test/persistence.test.ts` | JSON round trips and continuation |
| `packages/minds/test/openrouter.test.ts` | Mocked HTTP requests, schema validation, timeouts, secret isolation |
| `examples/library-foundation.ts` | Headless consumer using the public package entry point |
| `examples/openrouter-foundation.ts`, `.env.example` | Opt-in live consumer and placeholder environment configuration |
| `README.md` | Commands, usage, project boundaries, and implemented scope |

Do not scaffold empty Inspector or Playbox packages in this increment. The example is a library integration fixture; scenario mechanics will move into the Playbox when that project is implemented.

## Public interface contract

Define these exported signatures in `packages/minds/src/types.ts` and export the implementation from `src/index.ts`:

```ts
type SimulationTime = number;
type JsonValue = null | boolean | number | string | JsonValue[]
  | { [key: string]: JsonValue };
type Provenance = 'witnessed' | 'reported';

interface MindConfig {
  runId: string;
  mindId: string;
  identity: { name: string; description: string };
  goal: string;
  time: SimulationTime;
  beliefs: Belief[];
  mood: Record<string, AffectDimension>;
  emotions: Record<string, AffectDimension>;
}
interface Belief {
  id: string;
  statement: string;
  confidence: number;
  evidenceIds: string[];
}
interface AffectDimension { baseline: number; value: number; halfLifeMs: number }
interface Observation {
  id: string;
  time: SimulationTime;
  source: string;
  kind: string;
  content: string;
  provenance: Provenance;
  processing: 'appraise' | 'memoryOnly';
}
interface Memory { id: string; observation: Observation }
interface MindSnapshot {
  schemaVersion: 1;
  revision: number;
  config: MindConfig; // time, beliefs, mood, emotions are initial configuration
  time: SimulationTime;
  beliefs: Belief[];
  mood: Record<string, AffectDimension>;
  emotions: Record<string, AffectDimension>;
  memories: Memory[];
}
interface CognitionContext {
  mind: MindSnapshot;
  observation: Observation;
  memories: Memory[]; // selected subset; mind.memories uses this same subset
}
interface CognitionProposal {
  beliefUpdates: Belief[];
  moodDeltas: Record<string, number>;
  emotionDeltas: Record<string, number>;
  metadata: {
    provider: string;
    model: string | null;
    explanation: string | null;
    parameters: Record<string, JsonValue>;
  };
}
interface CognitionProvider {
  appraise(context: CognitionContext): Promise<CognitionProposal>;
}
interface InspectionRecord {
  schemaVersion: 1;
  id: string;
  runId: string;
  mindId: string;
  sequence: number;
  revision: number;
  time: SimulationTime;
  type: 'initialized' | 'observation' | 'memory' | 'decision' | 'transition';
  observationId: string | null;
  causeIds: string[];
  payload: JsonValue;
}
interface IngestResult {
  duplicate: boolean;
  snapshot: MindSnapshot;
  records: InspectionRecord[];
}
interface MindRecording {
  schemaVersion: 1;
  snapshot: MindSnapshot;
  records: InspectionRecord[];
  processedObservationIds: string[];
}
interface MindRuntime {
  ingest(observation: Observation): Promise<IngestResult>;
  advanceTime(time: SimulationTime): Promise<IngestResult>;
  getSnapshot(): MindSnapshot;
  getRecords(afterSequence?: number): InspectionRecord[];
  subscribe(listener: (records: InspectionRecord[]) => void): () => void;
  exportRecording(): MindRecording;
}
function createMind(config: MindConfig, provider: CognitionProvider): MindRuntime;
function restoreMind(recording: unknown, provider: CognitionProvider): MindRuntime;
```

Initial beliefs may have empty evidence arrays; newly proposed evidence references must exist in current memory. Memory IDs equal observation IDs within the Mind. `CognitionContext.mind` is a detached snapshot whose memory list is restricted to the retrieved subset; other character state is never included. Provider metadata belongs in decision records, not in durable provider conversation state.

## Task 1: Standalone package and isolated initialization

**Files:** Root and library package/build files; `types.ts`, `validation.ts`, `runtime.ts`, `index.ts`; `initialization.test.ts`.

**Interfaces:** Produces `createMind`, `MindConfig`, `MindSnapshot`, `CognitionProvider`, and `getSnapshot()` as defined above. Later tasks extend the same runtime.

- [x] **Step 1 — Configure the test/build harness and write initialization tests.** Compile strict TypeScript to `dist`, and test `createMind(config, provider)` with two different Mind IDs. Assert revision `0`, preserved identity/goal, empty memories, independent affect maps, and that mutations of either the original config or returned snapshot do not change stored state.
- [x] **Step 2 — Run the failing tests.** `npm test` must fail because `createMind` is not yet implemented. The harness must first compile and run a trivial test successfully so a dependency problem is not mistaken for the expected failure.
- [x] **Step 3 — Implement construction and validation.** Validate nonempty IDs/goal, finite nonnegative time, unique belief IDs, confidence in `[0, 1]`, valid affect dimensions, and JSON-compatible configuration. Copy inputs into runtime-owned state. Add tests rejecting NaN, infinity, zero half-life, duplicate belief IDs, and malformed identifiers.
- [x] **Step 4 — Verify.** `npm test` and `npm run typecheck` pass; import the built library entry point in a Node process without loading React, DOM APIs, or a provider SDK.
- [x] **Step 5 — Record the deliverable.** Add package usage to README. Keep all capabilities unchecked until the associated behavior and evidence are reviewed; commit this task only if Git has been initialized by then.

## Task 2: Atomic observation processing and affect dynamics

**Files:** `affect.ts`, `validation.ts`, `runtime.ts`; `observations.test.ts`, `affect.test.ts`.

**Interfaces:** Consumes Task 1 state and provider types. Produces working `ingest(observation)` and `advanceTime(time)` with the signatures above; context and proposal validation use the public contract.

- [x] **Step 1 — Write ingestion tests.** A provider returning a belief linked to the incoming memory and an anger delta creates one memory, changes that belief and affect, advances revision once, and receives only the selected Mind's context. A `memoryOnly` observation creates memory and applies elapsed-time dynamics with zero provider calls. Repeated ingestion returns `duplicate: true`, unchanged revision, and no new records or provider calls.
- [x] **Step 2 — Run the failing tests.** `npm test` fails on unimplemented ingestion and time advancement, with the initialization suite still passing.
- [x] **Step 3 — Implement pure affect functions and the queued transaction.** Decay toward baseline before invoking appraisal; include the proposed observation in the working memory subset; validate every proposal before committing. Reject unknown affect dimensions and unknown evidence IDs. Copy provider inputs and outputs. Commit memory, beliefs, affect, time, and revision together.
- [x] **Step 4 — Add adversarial tests.** At one half-life, value `1` with baseline `0` becomes `0.5`; oversized finite deltas clamp to `1` or `0`. Reject nonfinite deltas, confidence outside `[0, 1]`, backward time, and foreign evidence. Provider exceptions and malformed proposals leave state unchanged and permit a retry. Two concurrent ingests serialize; duplicate concurrent IDs are processed once. A failed operation does not poison the queue.
- [x] **Step 5 — Verify.** `npm test` and `npm run typecheck` pass. `advanceTime(currentTime)` is a no-op, forward advancement commits one revision, and a duplicate observation is detected before comparing its old timestamp with the current time.

## Task 3: Causal inspection records and durable recordings

**Files:** `inspection.ts`, `persistence.ts`, `runtime.ts`, `validation.ts`, `index.ts`; `inspection.test.ts`, `persistence.test.ts`.

**Interfaces:** Produces all inspection and persistence methods in the public contract and `restoreMind(recording, provider)`. Inspectors can consume these without private runtime access.

- [x] **Step 1 — Write trace tests.** Initialization emits sequence `1`. A successful appraisal emits ordered observation, memory, decision, and transition records; each has run/Mind identity, simulation time, committed revision, and linked causes. The decision includes the provider context, retrieved IDs, raw validated proposal, and metadata. The transition contains before/after snapshots and actual affect changes. A memory-only path omits the decision record; time-only updates emit a transition with no observation ID.
- [x] **Step 2 — Run the failing tests.** `npm test` fails on missing trace generation and restoration, with prior behavior passing.
- [x] **Step 3 — Implement inspection and serialization.** Generate record IDs and strictly increasing sequence numbers at commit. Return detached copies from getters and callbacks. `getRecords(afterSequence)` returns records with greater sequences. `exportRecording()` includes all retained records and deduplication state. `restoreMind` validates schema, identity, revision, sequence ordering, referenced evidence, and snapshot consistency before constructing a runtime.
- [x] **Step 4 — Add persistence and subscriber tests.** JSON round-trip a run, restore, reingest an old observation with no effects, and ingest a new one with sequences continuing from the old maximum. Reject unsupported versions, mismatched Mind IDs, corrupt sequence order, and invalid affect values. Mutating a recording or a callback record leaves internal data unchanged. Unsubscribing stops callbacks; a throwing subscriber does not turn a successful commit into an ingest failure.
- [x] **Step 5 — Verify.** `npm test`, `npm run typecheck`, and `npm run build` pass. Validate the causal links and restoration against actual records from the example in Task 5.

## Task 4: OpenRouter provider adapter

**Files:** `providers/openrouter.ts`, `providers/appraisal-schema.ts`, library package exports; `openrouter.test.ts`.

**Interfaces:** Consumes `CognitionContext`, `CognitionProposal`, and `CognitionProvider`. Exports `createOpenRouterProvider(options: OpenRouterOptions): CognitionProvider` from `@minds/core/openrouter`. `OpenRouterOptions` requires nonempty `apiKey` and `model` and accepts `fetch?: typeof globalThis.fetch`, `timeoutMs?: number`, `temperature?: number`, and `maxTokens?: number`. Defaults are 30,000 ms timeout, temperature 0, and 2,000 completion tokens; validation rejects invalid settings. No default model is assumed.

- [x] **Step 1 — Write HTTP contract tests.** Inject a fake Fetch implementation and assert a POST to `https://openrouter.ai/api/v1/chat/completions`, Bearer authentication, selected model, `stream: false`, structured `response_format` with `type: 'json_schema'`, and `provider.require_parameters: true`. Assert the user message contains only the supplied Mind context; the key appears in authorization only.
- [x] **Step 2 — Run the failing tests.** `npm test` fails because the optional adapter export is missing while core runtime tests continue to pass.
- [x] **Step 3 — Implement request and response handling.** Generate a strict output schema for belief updates, configured mood/emotion deltas, and an optional explanation represented as string or null. Specify that observation content is character input, not instructions to the service. Request JSON, parse the returned message content, validate it locally, and construct metadata from actual response/model identifiers and non-secret request settings. Unknown dimensions and invalid evidence are rejected before runtime commit. Never store authorization headers or the complete options object in diagnostics.
- [x] **Step 4 — Add failure tests.** Mock 401, 429, 5xx, timeout, an error envelope, empty choices, truncated output, malformed JSON, and invalid proposals. Assert these fail with typed/sanitized error information, no automatic billable retry, and no runtime state mutation. Include a response error that echoes the supplied key and assert the thrown error and diagnostics do not expose it. Record reported usage where supplied, but do not invent a cost estimate.
- [x] **Step 5 — Verify.** `npm test`, `npm run typecheck`, and `npm run build` pass without credentials or network inference. The normal core entry point does not import the OpenRouter adapter; browser consumers do not need to initialize it. Unsupported model/endpoint structured-output behavior remains an explicit request failure, never an unvalidated text fallback.

## Task 5: Public API integration examples and evidence

**Files:** `examples/library-foundation.ts`, `examples/openrouter-foundation.ts`, `.env.example`, example build configuration, `README.md`, `CAPABILITIES.md`.

**Interfaces:** Consumes the built `@minds/core` public API only. Produces `npm run example:foundation`, a headless fixture with JSON-compatible recording output suitable for the next Inspector increment.

- [x] **Step 1 — Write an integration test.** Construct two Minds with different configured temperament/affect, deliver an observation to one, and assert that the other remains unchanged. Save/restore the first and advance time. Check observation-to-transition links and the generated recording's round trip.
- [x] **Step 2 — Verify the initial failure.** Run the integration test before the example exists; confirm the missing consumer entry point is the failure rather than the library tests.
- [x] **Step 3 — Implement the examples.** The offline example uses a deterministic fixture provider whose updates depend on supplied context, clearly labeled as a mechanics fixture. Show initialization, observation effects, duplicate handling, time decay, and restoration. Add `npm run example:openrouter` using `OPENROUTER_API_KEY` and `OPENROUTER_APPRAISAL_MODEL` from the server environment, with a clear preflight error when either is missing. `.env.example` contains placeholders only; actual `.env` files are ignored. Do not add scenario controls or Inspector UI here.
- [x] **Step 4 — Verify the whole slice.** Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run example:foundation`. Inspect the example's recording to confirm provider metadata, source provenance, evidence references, state versions, and causal links are present. Verify the live example's missing-configuration behavior without printing environment secrets. A live OpenRouter run requires credentials and a selected model; report it as unverified if unavailable.
- [x] **Step 5 — Update evidence and capabilities.** Document actual commands and the public embedding example. Check only capabilities fully met by this slice, linking tests or example output; partial cognitive systems remain unchecked. Record limitations before proceeding to the next subsystem plan.

## Capability coverage and deliberate gaps

Targets for this slice are the state/observation portions of LIB-001–003, LIB-006, LIB-022–029, LIB-033–037, LIB-048–049, LIB-055–061, and INT-001–006. Many of those encompass wider cognitive behavior, so capability completion requires checking their full wording rather than automatically checking the range.

Intention/action/speech systems, relationship updates, sophisticated retrieval, provider replacement evaluation, connection protocols, record retention limits, React rendering, and Playbox execution remain outside this slice. Historical-state UI and all UI/PLAY items stay unchecked. LIB-064 is covered by Task 4 and the opt-in live example, with mocked verification distinguished from live verification.

## Follow-on plans

1. **Library agency:** Intention candidates and lifecycle, host action contracts, speech acts, and the complete autonomous cognitive loop.
2. **Inspector component:** React package over the validated inspection contract, current-state panels, events, causal navigation, and an embedding fixture independent of Playbox.
3. **Playbox:** Scenario host, autonomous scheduler, controls, event injection, recordings, and the embedded Inspector. Its server hosts the OpenRouter adapter; its browser UI receives inspection records. Later cognitive operations extend the provider contract with independently configurable generative and decision model IDs.

Each subsystem gets its own reviewed implementation plan. This plan does not imply all 138 capabilities are part of the first increment.

## Plan review

Self-review completed: public method names are consistent across tasks; the five Review Focus cases have assigned tests; task interfaces precede consumers; the three-project boundary remains intact; no UI behavior is implemented inside the library. Configuration and recording schemas are provisional version `1` contracts that this increment will verify before other packages depend on them.

**Execution status:** Complete. User approved inline execution; all five tasks implemented and verified. Independent review findings fixed with regression tests; final suite: 31 passed, 0 failed. Live inference remains unverified. See the [implementation record](../../implementation/library-foundation.md).

## Tooling references

- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references) support separately built packages as additional projects enter the workspace.
- [Node.js TypeScript support](https://nodejs.org/api/typescript.html) distinguishes type stripping from type checking. This plan compiles and checks TypeScript rather than relying on runtime type stripping as validation.
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs) describes JSON Schema requests and endpoint compatibility; use local validation even when strict output is requested.
- [OpenRouter authentication](https://openrouter.ai/docs/api_reference/authentication) documents Bearer authentication and the API base URL.
