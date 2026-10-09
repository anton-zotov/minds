# Minds

Minds is a reusable character cognition library. It stores isolated subjective state, processes observations, updates beliefs and affect, and maintains evidence-reconsidered intentions through replaceable providers. Causal diagnostics and restorable recordings expose the operations that actually ran.

The workspace contains three projects:

| Project | Location | Current status |
|---|---|---|
| Library | `packages/minds` (`@minds/core`) | Beliefs, affect, persistent intentions, validated planning, actions and OpenRouter adapters |
| Inspector | `packages/inspector` | Embeddable state/history panels, candidate judgments, causal navigation, and transition details |
| Playbox | `apps/playbox` | Two-Mind trade, bounded conversation, host ledger, provider selection, and recording export |

See [DESIGN.md](DESIGN.md), [CAPABILITIES.md](CAPABILITIES.md), and the [first implementation plan](docs/superpowers/plans/2026-10-08-library-foundation.md).

The [implementation record](docs/implementation/library-foundation.md) records the first slice's independent review fixes, capability evidence, and remaining scope. The [live API evaluation](evaluations/results/2026-10-08-live-foundation.md) includes the OpenRouter audit correction: four server-confirmed generations and eleven unverified response records, separately from runtime tests.

## Run locally

Development requires Node.js 24 or newer and npm. The lockfile pins development dependencies; the library has no runtime package dependencies.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run example:foundation
```

The offline example uses a clearly labeled deterministic fixture. It shows an observation affecting one Mind, duplicate suppression, causal records, restoration, and emotional decay. It does not demonstrate autonomous AI planning.

To produce a complete JSON recording after building:

```sh
node .test-dist/examples/library-foundation.js --recording
```

## Embed the library

Import the public package in a workspace consumer or install its built package in a host. Hosts supply permitted observations; the library has no access to objective world state or other Minds.

```ts
import { createMind, type CognitionProvider } from '@minds/core';

const provider: CognitionProvider = {
  async appraise(context) {
    return {
      beliefUpdates: [],
      moodDeltas: {},
      emotionDeltas: {},
      metadata: {
        provider: 'your-provider', model: null, explanation: null, parameters: {},
      },
    };
  },
};

const mind = createMind({
  runId: 'session-1', mindId: 'character-1',
  identity: { name: 'Marta', description: 'Patient and careful.' },
  goal: 'Protect public access', time: 0, beliefs: [],
  mood: { calm: { baseline: 0.5, value: 0.5, halfLifeMs: 60_000 } },
  emotions: { anger: { baseline: 0, value: 0, halfLifeMs: 30_000 } },
}, provider);

const unsubscribe = mind.subscribe(records => {
  // Supply these records to your host's inspection adapter.
});

await mind.ingest({
  id: 'observation-1', time: 1000, source: 'world-host', kind: 'speech',
  content: 'A neighbor says the agreement was broken.',
});

const snapshot = mind.getSnapshot();
const records = mind.getRecords();
const recording = mind.exportRecording();
unsubscribe();
```

`restoreMind(JSON.parse(JSON.stringify(recording)), provider)` validates the recording and restores it without making inference calls. Observation IDs remain processed after restoration. Providers can be injected independently of durable state.

## OpenRouter

The optional `@minds/core/openrouter` entry point exports `createOpenRouterProvider` and `OpenRouterError`. Use it in a trusted host/server process. The core entry point does not import the adapter. The future browser Inspector consumes diagnostic data, not service keys.

```ts
import { createOpenRouterProvider } from '@minds/core/openrouter';

const provider = createOpenRouterProvider({
  apiKey: serverApiKey,
  model: selectedModelId,
  timeoutMs: 30_000,
  maxTokens: 2000,
});
```

Select an OpenRouter model/endpoint supporting JSON Schema structured output. The adapter requests compatible routing and still validates responses locally. HTTP failures, invalid/truncated output, and timeouts reject the operation without committing state. No automatic retry is performed. API keys and raw HTTP error bodies are excluded from diagnostics; actual model identifiers, response IDs, and reported usage are retained.

For an opt-in live example, copy `.env.example` to `.env` locally and fill in `OPENROUTER_API_KEY` and `OPENROUTER_APPRAISAL_MODEL`, then run:

```sh
npm run example:openrouter
```

This command makes one billable inference request when configured. Do not use frontend-exposed environment variables for the key. A missing configuration exits with a clear error before requesting inference. Tests use fake HTTP responses; they do not need keys or credits. Live provider behavior is not claimed verified by those tests.

The selected generative model is `openai/gpt-6-luna`. `.env` holds local model settings and the server key. In Playbox, `OPENROUTER_APPRAISAL_MODEL` generates belief proposals; Jev judges those proposals and then emotional changes in separate stages. `OPENROUTER_APPRAISAL_DECISION_MODEL` overrides the effective Jev intention model, then the base Jev decision model, then `typesafe/jev-1.13`. Intention generation uses `OPENROUTER_INTENTION_GENERATION_MODEL`, then `OPENROUTER_GENERATIVE_MODEL`, then the generative appraisal model. Intention judgments use `OPENROUTER_INTENTION_DECISION_MODEL`, then `OPENROUTER_DECISION_MODEL`, then `typesafe/jev-1.13`. Jev uses `/api/alpha/decisions`; non-Jev intention overrides retain structured chat. The foundation example keeps legacy combined appraisal. Temperature is omitted by default.

The integration follows [OpenRouter authentication](https://openrouter.ai/docs/api_reference/authentication) and [structured-output documentation](https://openrouter.ai/docs/guides/features/structured-outputs).

## Runtime behavior

- Time and affect half-lives are in milliseconds. Time is monotonic per Mind; equal-time observations retain their ingestion order.
- Mood and emotions use configurable dimensions normalized to `[0, 1]`. Values decay toward their configured baseline, then validated event deltas apply with clamping.
- One observation creates one memory. Repeated observation IDs are no-ops, even if the repeated timestamp is older than current time. IDs therefore must uniquely identify an observation within a Mind.
- Beliefs store a statement, confidence, and memory evidence IDs. Initial beliefs have no recorded evidence; later proposals can add or replace beliefs using known memories.
- Providers receive detached context with the latest 20 memories, including the current observation. Built-in inference adapters send that event once. Incoming observations contain only ID, time, source, kind and content; the Mind interprets evidence and can return no changes. Complete memory remains in the runtime.
- Operations serialize per Mind. Provider failures do not commit partial state, consume an observation ID, or prevent a later retry. Snapshot reads show the latest committed state while an operation is pending.
- Inspection records connect observation → memory → decision → transition. Transitions expose before/after state and requested/actual affect changes. `advanceTime()` supplies an elapsed-time observation after applying decay, then runs cognition; equal-time advancement is a no-op.
- New events upgrade state and records to schema 6; compact exports use journal 7. Initial state retains schema 1 or 2 until the first event. Restoration supports expanded versions 1–4 and 6, and compact versions 5 and 7, including mixed histories. Actions upgrade expanded state/records to 8 and compact journals to 9; later cognition preserves those versions. Historical host controls and time-only transitions replay with their original semantics; live events reject those controls. Replay checks consistency without inference and does not guarantee reproducible live model output.
- Getters, recordings, provider contexts, and subscriber data are detached copies. Subscriber exceptions and returned-promise rejections do not undo commits or interrupt the host; the runtime does not await subscribers.

## Implemented scope and limits

Action proposals, Jev selection and speech generation are implemented; relationships remain pending. See [actions and trade](docs/implementation/actions-trade.md). Initial affect is host supplied. Jev handles belief judgments, emotional appraisal and planning in live Playbox; belief and strategy wording are generated by Luna. Belief and affect representation remains a provisional foundation.

## Sequential belief and emotional appraisal

Enable the split flow with `createOpenRouterProvider({ apiKey, model: 'openai/gpt-6-luna', appraisalDecisionModel: 'typesafe/jev-1.13' })`. The runtime uses optional `CognitionProvider.stages.updateBeliefs` and `appraiseEmotions`; existing providers with only `appraise` retain combined behavior. The offline fixture is a legacy compatibility example.

The order is time decay → memory → belief proposals and Jev evaluation → apply accepted beliefs → Jev emotional appraisal → apply affect → intention planning and subjective completion → atomic commit. Emotional appraisal receives updated beliefs. Providers receive detached subjective context and the latest 20 memories. Elapsed-time observations use the same flow and do not assert any unobserved world outcome.

Luna proposes sourced belief statements, reusing existing IDs for revisions. Jev independently judges adoption and subjective confidence; its confidence answer concerns what the character believes, not objective truth or model certainty. Rejected updates preserve prior beliefs. `appraisalPolicy` defaults to `{ beliefAcceptanceThreshold: 0.65, maxBeliefCandidates: 16, maxMoodDelta: 0.1, maxEmotionDelta: 0.3 }`. The candidate limit is configurable from 1–32; an empty pool skips the belief judgment call.

Each host-defined mood/emotion dimension receives a signed nine-level rubric: expected score 4 means no change, 0 means maximum decrease, and 8 means maximum increase. The adapter maps `(score - 4) / 4 * configuredLimit` to an incremental delta; the runtime applies existing [0,1] bounds. Limits and thresholds are recorded heuristics, not calibrated psychological claims. No affect dimensions means no emotional inference. All stages—including later planning—roll back on failure. Inspector exposes **Update beliefs** and **Appraise emotions**, exact contexts/results, raw Jev answers, policy, proposals and actual call counts. See [implementation evidence](docs/implementation/split-appraisal.md).

## Persistent intentions

Enable planning by supplying `intentionPolicy` in the Mind configuration and `intentions` on the provider. Existing clients that omit planning keep their original behavior. The public `IntentionProvider` interface separates `generate`, `evaluate`, `sufficient`, and `reconsider`; hosts can compose independent implementations for each role.

```ts
const provider = createOpenRouterProvider({
  apiKey: serverApiKey, model: appraisalModel, intentions: true,
  intentionGenerationModel: generationModel,
  intentionDecisionModel: 'typesafe/jev-1.13',
});
const mind = createMind({
  ...characterConfig,
  intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42 },
}, provider);
```

On the first appraised observation, updated beliefs and affect inform strategy proposals. Runtime-seeded ordering precedes incremental candidate evaluation against the evolving active set. Normalized-description duplicates are suppressed; semantic duplication and conflict are provider judgments. After acceptance the provider decides whether the set is sufficient. The runtime independently bounds candidates/evaluations (1–32) and active intentions (1–8), with a uint32 shuffle seed. It records sufficiency, pool exhaustion, evaluation/active limits, or preserved commitment as the stopping reason.

Jev provides `noul` probabilities, lifecycle `choice` distributions and expected ordinal `score` values. The adapter maps probabilities with explicit thresholds (all default to 0.65), configurable through `jevPolicy: { acceptThreshold, sufficiencyThreshold, revisionThreshold, generateMoreThreshold }`. Five-level scores normalize by four; these are rubric scores, not confidence percentages. A requested wording revision makes two additional calls: a generative proposal, then Jev approval. Raw answers, policy, actual models and usage are recorded without credentials. Jev does not generate explanations. A reconsideration decision with `generateMore: false` stops candidate generation even when every strategy was completed. See [self-driven event implementation](docs/implementation/self-driven-events.md).

The host supplies an observable outcome; the Mind decides whether it fulfills a strategy:

```ts
await mind.ingest({
  id: 'agreement-signed', time: simulationTime, source: 'world-host',
  kind: 'agreement', content: 'The caretaker signs an agreement allowing public access.',
});
```

Intention reconsideration can return `{ intentionId, action: 'complete', evidenceIds: [observation.id] }`. Completion means the Mind believes its strategy is fulfilled; that belief can be mistaken. Known evidence must include the triggering event. Stable identity, goal, description and origin remain intact, and completed strategies remain terminal. Completion commits atomically with the rest of cognition; failures leave the event retryable. It does not complete or rewrite the assigned goal.

In Playbox, inject the observable outcome as text for the selected recipient. There are no host controls for processing, provenance or strategy completion. The Inspector displays the Mind's judgment and its evidence. See [implementation evidence](docs/implementation/self-driven-events.md).

Later observations, including elapsed time, reconsider retained intentions; omitted revisions keep commitments exactly. Supported decisions are keep, reprioritize, revise, suspend, abandon, reactivate and complete. Material revisions require triggering evidence. Stable IDs, goal, creation time and origin survive revision; old states remain inspectable. All appraisal and planning for one observation commits atomically.

See [intention design](docs/superpowers/specs/2026-10-08-persistent-intentions-design.md) and [implementation evidence](docs/implementation/persistent-intentions.md). Fixture and mocked HTTP tests verify runtime/adapter mechanics; live planning behavior has not been evaluated in this increment.

Memories and a compact operation journal are retained in memory; full inspection records and transitions are reconstructed on demand. Bounded retention and persistent storage adapters remain future work. Failed operations reject with errors and do not append cognitive trace records. Hosts should capture operational failures separately.

## Visual exploration

```sh
npm ci
npm run dev
```

Open [the Playbox](http://127.0.0.1:5183). The API runs on loopback port 5184. The development command builds core first and loads `.env` into the server only.

Set `PLAYBOX_WEB_PORT` and `PLAYBOX_API_PORT` in `.env` to override both local ports consistently; OpenRouter configuration is stripped from the frontend development process.

The trade scenario contains two Minds with competing goals: Marta buys one crate of apples cheaply, while Ivo wants a high selling price. Each has private limits. **Step conversation** schedules one actor; **Run conversation** alternates at most 12 turns and stops on a deal, a failure or the limit. The offline fixture offers 5 coins, counters with 7 and accepts 7. The host validates structured actions and transfers the apples and coins once.

Select either Mind to inspect beliefs, affect, intentions and actions. The decision sequence exposes proposals, selection scores, the selected objective, speech and submitted/executed/rejected receipts. Historical turns remain inspectable. The public ledger and transcript display what actually happened; private limits reach only their owner's inference context.

Inject observable content for selected recipients or advance elapsed time through cognition. **Reset run** creates fresh Minds and world state. **Export recording** downloads the public world and both compact restorable journals. Host-world import/resumption remains pending.

Offline fixture mode is the default and demonstrates runtime mechanics. OpenRouter is selectable when configured on the server. Live actions use generative proposals and wording plus Jev selection; override roles with `OPENROUTER_ACTION_GENERATION_MODEL`, `OPENROUTER_ACTION_DECISION_MODEL` and `OPENROUTER_ACTION_EXPRESSION_MODEL`. Live conversation makes billable inference calls; automated verification uses fixtures and mocked HTTP. See [implementation and limits](docs/implementation/actions-trade.md).

## Embed the Inspector

Build the workspace with `npm run build`. The Inspector package exports its component, types, and stylesheet independently of Playbox:

```tsx
import { Inspector, type InspectionView } from '@minds/inspector';
import '@minds/inspector/styles.css';

// The host constructs a detached version-1 view from public core getters.
const view: InspectionView = {
  schemaVersion: 1, runId: 'client-run', time: mind.getSnapshot().time,
  status: 'ready', providerMode: 'fixture', errors: [],
  minds: [{ snapshot: mind.getSnapshot(), records: mind.getRecords() }],
};

<Inspector view={view}
  selectedMindId={selectedMindId} selectedRecordId={selectedRecordId}
  onSelectMind={setSelectedMindId} onSelectRecord={setSelectedRecordId} />;
```

The host owns refresh, subscriptions, controlled selections, simulation operations, and file access. Clear selected record IDs when replacing a run. Each Mind's timeline preserves its local sequence; the view does not invent ordering between Minds. `providerMode` identifies the initial supported host modes; other provider identities remain available in recorded metadata.

An independent client-game embedding fixture is available at [the embedding demo](http://127.0.0.1:5183/?embed=1); it imports only public core and Inspector interfaces and makes no API calls. Host-supplied validated offline recordings can be transformed into the same `snapshot`/`records` view.

## Browser tests and screenshot baselines

```sh
npx playwright install chromium
npm test
npm run typecheck
npm run test:e2e
```

Playwright starts its own local development server on ports 5185/5186, allowing the live preview on 5183/5184 to remain open. Override test ports with `PLAYBOX_TEST_WEB_PORT` and `PLAYBOX_TEST_API_PORT`. It covers Inspector embedding, trading dialogue, action decisions, one-time transfers, state changes, elapsed-time cognition, subjective completion, validation, reset isolation, pending/failure controls, downloads, and keyboard interaction. Core and host/API tests run through `npm test`.

Visual baselines live in `tests/visual.spec.ts-snapshots`: initial desktop, a trading action, completed intentions, observation controls, the full narrow workspace, and a focused narrow Inspector. They were generated and visually inspected on Windows with Playwright 1.64.0 / Chromium 156.0.8078.4. Tests pin viewport, locale, timezone, reduced motion, and fixture inputs; the lockfile pins browser-test dependencies. Use the same Windows/browser environment for comparison.

After an intentional visual change, generate candidate baselines with `npm run test:e2e -- --update-snapshots`, open every changed PNG, verify layout and displayed values, then rerun without that flag. Generation alone does not approve a baseline.

See the [visual implementation record](docs/implementation/inspector-playbox.md) for verification and remaining scope.

## Belief reconciliation

Current beliefs can be revised, merged or retired. Generative appraisal proposes evidence-backed changes and Jev judges them; accepted merges replace and retire their inputs atomically. Memory preserves the observations. See [implementation and limits](docs/implementation/belief-reconciliation.md).
