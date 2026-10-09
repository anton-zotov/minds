# Minds — Capability Checklist

**Version:** 0.11  
**Status:** Self-driven cognition, persistent intentions, generic actions with Jev selection, action inspection and two-Mind trade Playbox implemented; remaining capabilities tracked below  
**Source:** [Design document](DESIGN.md), plus the three-project requirement: library, embeddable Inspector, and Playbox

## Purpose and project boundaries

We are building three projects:

1. **Minds library:** A reusable cognition engine that other projects embed to create persistent, autonomous characters. It owns each Mind's cognitive state and exposes integration and inspection interfaces.
2. **Minds Inspector:** A reusable UI component that client games can embed to debug Minds. It displays current and historical cognitive state, observed events, decisions, and their effects through a public inspection adapter.
3. **Minds Playbox:** A standalone scenario application that hosts the library, runs experiments, and embeds the same Inspector component used by client games. It owns scenario configuration, simulation controls, test event injection, and run management.

The host application owns the world: facts, observation permissions, available actions, action validation, execution, and consequences. The Playbox is one such host; client games are other hosts. Playbox scenario mechanics live in the Playbox project.

The library runs without either UI project. The Inspector can be embedded without the Playbox and displays supplied state and traces. The Playbox depends on both reusable projects and supplies its own host adapter; the Inspector does not depend on Playbox scenario code, storage, or controls. A deployment may connect them in process, through exported recordings, or through a host-provided service; the initial transport and packaging remain to be defined.

**Selected stack:** TypeScript library and React Inspector for web-game clients. OpenRouter is the first inference service, behind the library's replaceable provider interfaces. Hosts configure model IDs independently for cognitive roles. OpenRouter-backed cognition runs in a trusted host/server process; its API key is kept out of browser bundles and diagnostic recordings.

**Selected models:** `openai/gpt-6-luna` for belief/strategy wording and `typesafe/jev-1.13` for belief adoption/confidence, sequential emotional appraisal, intention evaluation, sufficiency and lifecycle judgments. Live Playbox uses separate belief and emotional stages; the offline fixture and legacy providers remain compatible. [Planning evidence](docs/implementation/jev.md) and [sequential appraisal evidence](docs/implementation/split-appraisal.md) use mocked inference; live Jev quality/cost evaluation remains pending.

**Elapsed durations:** Playbox shows measured wall-clock turn and timeline-operation durations separately from simulation time. Bounded conversations preserve individual trader turns; retries accumulate active processing time. [Timing details](docs/implementation/wall-clock-timing.md).

**Context and history:** Built-in inference adapters send compact subjective state and each retrieved event once. The runtime retains an event/results journal and reconstructs full inspection on demand; Playbox downloads compact recordings. Legacy recordings remain supported. [Implementation and measured reductions](docs/implementation/lean-context-and-history.md), [payload test](packages/minds/test/lean-context.test.ts), and [journal replay tests](packages/minds/test/journal.test.ts).

| Project | Owns | Consumers |
|---|---|---|
| Library | Cognition, persistent Mind state, inspection records and API | Client games, Playbox |
| Inspector component | State views, event timelines, causal navigation, diagnostic visualizations | Client games, Playbox |
| Playbox | Scenario world, scheduler, run controls, experiments, recording management | Developers exploring and evaluating Minds |

## How to use this checklist

- Leave an item unchecked until its observable behavior exists and has been verified. A design, interface stub, or mock display alone does not complete a capability.
- Check items with `- [x]` and append a link to implementation, a meaningful test, or a recorded demonstration as evidence.
- Keep IDs stable so issues, implementation plans, and releases can reference them. Split an item into new IDs if it becomes too broad; preserve the original reference.
- Checked items link to verified implementation evidence. Unchecked items include both unimplemented and partially implemented capabilities.
- **P1** is the first end-to-end prototype. **P2** makes the system practical to reuse and inspect. **Later** items are optional directions, not requirements for the first release.

The Inspector, Playbox, and integration capabilities below make the user's debugging and scenario requirements concrete. They extend the conceptual design without freezing its unresolved schemas or psychological representations.

In version 0.2, UI-025, UI-026, and UI-027 move to PLAY-003, PLAY-002, and PLAY-006 respectively. The old IDs are retired references, not completed capabilities. Other existing IDs retain their identity.

## Project A — Minds library

### A1. Portable runtime and integration

- [x] **LIB-001 · P1 — Independent library.** A host can create and run Minds through a public API with no Inspector dependency or game-specific world concepts in the core. **Evidence:** [Public API example](examples/library-foundation.ts) and [package](packages/minds/package.json).
- [x] **LIB-002 · P1 — Character initialization.** Create a Mind with a stable ID, identity, temperament, one host-assigned goal, initial permitted knowledge, and an initial emotional state; inspect the initialized state. **Evidence:** [Initialization tests](packages/minds/test/initialization.test.ts).
- [x] **LIB-003 · P1 — Separate Mind instances.** Run two or more Minds with isolated cognitive state; one character cannot read another character's private knowledge through cognition inputs. **Evidence:** [Integration test](packages/minds/test/integration.test.ts).
- [x] **LIB-004 · P1 — Host capability contract.** A host supplies available actions and their parameter constraints; action generation uses that vocabulary rather than a built-in game action list. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **LIB-005 · P1 — Host-driven execution.** The host can submit observations and request cognitive work or an action opportunity without a player sending a chat message. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **LIB-006 · P1 — Explicit time.** Cognitive updates use host-supplied simulation time, including emotional decay, so pausing or advancing the simulation has defined behavior. **Evidence:** [Affect tests](packages/minds/test/affect.test.ts).
- [ ] **LIB-007 · P2 — Asynchronous work.** A host can await or schedule cognitive operations without blocking its simulation loop; cancellation and completion are observable.
- [ ] **LIB-008 · P2 — Operation limits.** Configure candidate counts, iteration limits, and inference budgets; the runtime stops bounded work and reports the limit reached.

### A2. Identity, motivation, and intentions

- [ ] **LIB-009 · P1 — Identity influences cognition.** Identity, values, risk tolerance, and temperament are supplied to relevant evaluations and proposals; a controlled scenario demonstrates effects beyond speech wording. **Partial evidence:** [Persistent-intention increment](docs/implementation/persistent-intentions.md); Identity and affect reach planning; a controlled identity-dependent behavior comparison remains pending.
- [x] **LIB-010 · P1 — Goal versus intention.** Preserve the host-assigned desired outcome separately from the character's chosen strategies; an intention revision does not silently rewrite the goal. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-011 · P1 — Diverse intention proposals.** Generate multiple distinct strategy candidates from the Mind's goal, identity, beliefs, emotions, relevant memories, and permitted context. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-012 · P1 — Observable candidate ordering.** Shuffle and evaluate the candidate pool with recorded ordering and a seed where supported, making order dependence inspectable. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-013 · P1 — Incremental acceptance.** Evaluate each candidate against the current intention set, including goal alignment, perceived feasibility, emotional compatibility, duplication, and conflict; retain the decision output. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-014 · P1 — Decision-controlled stopping.** After acceptance, evaluate whether more intentions are needed; stop on sufficiency, pool exhaustion, or a runtime limit and record which condition occurred. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-015 · P1 — Duplicate and growth safeguards.** Reject duplicate candidates and enforce configured evaluation and active-intention limits; expose rejected candidates and limit outcomes. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-016 · P1 — Persistent intention objects.** Store stable IDs, description, status, priority, supporting goal and beliefs, creation and reconsideration times, and an originating event when available. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-017 · P1 — Intention lifecycle.** Support active, suspended, completed, and abandoned intentions while preserving their history. The Mind judges completion from its beliefs and event evidence; completion does not establish objective success. **Evidence:** [Self-driven event implementation](docs/implementation/self-driven-events.md) and [completion tests](packages/minds/test/completion.test.ts). Completed and abandoned identities cannot be revised or revived.
- [x] **LIB-018 · P1 — Event-driven reconsideration.** Observations, including elapsed time, can warrant keeping, reprioritizing, revising, suspending, abandoning, completing, or requesting new intentions. Judgments link to their triggering event and commit atomically with cognition. **Evidence:** [Self-driven event implementation](docs/implementation/self-driven-events.md) and [event/clock tests](packages/minds/test/self-driven-events.test.ts). The host supplies observable content, not interpretation or completion instructions.
- [x] **LIB-019 · P1 — Commitment across turns.** Keep intentions through observations that do not warrant revision; do not regenerate the entire strategy on every interaction. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [ ] **LIB-021 · P2 — Candidate regeneration.** Request another pool when the first is insufficient, with duplicate detection and limits across generation rounds.

**LIB-020 is retired:** Elapsed time is an event handled by LIB-018. `advanceTime()` applies decay and supplies a clock observation through cognition; the Mind determines whether it warrants changing its intentions.

### A3. Observations, beliefs, memory, and relationships

- [x] **LIB-022 · P1 — Information boundaries.** Cognitive inputs contain only host-authorized observations and character-held knowledge; a hidden world fact remains unavailable until observed or communicated. **Evidence:** [Observation/context tests](packages/minds/test/observations.test.ts).
- [x] **LIB-023 · P1 — Observation ingestion.** Accept observations with event ID, simulation time, source, and content; distinguish speech, actions, discoveries, and other host-defined event types. **Evidence:** [Observation tests](packages/minds/test/observations.test.ts).
- [x] **LIB-024 · P1 — Idempotent ingestion.** Receiving the same observation twice does not create duplicate memories or apply its cognitive effects twice. **Evidence:** [Duplicate/concurrency tests](packages/minds/test/observations.test.ts).
- [x] **LIB-025 · P1 — Subjective beliefs.** Store the character's beliefs independently of objective world truth; allow beliefs to be incomplete or wrong and preserve their evidence or source. **Evidence:** [Sourced belief test](packages/minds/test/observations.test.ts).
- [x] **LIB-026 · P1 — Evidence-driven belief revision.** New observations can create, strengthen, weaken, or overturn beliefs; record the previous value, new value, and supporting observation. **Evidence:** [Belief reconciliation](docs/implementation/belief-reconciliation.md), including mocked Jev judgments and recorded before/after replay.
- [x] **LIB-027 · P1 — Episodic memory.** Persist meaningful observed experiences, including interactions and action consequences, with stable references to their originating observations. **Evidence:** [Memory tests](packages/minds/test/observations.test.ts).
- [ ] **LIB-028 · P1 — Mind-interpreted evidence.** The Mind distinguishes direct perceptions, statements, interpretations and summaries from observable context, rather than host-supplied provenance labels. **Partial evidence:** Model prompts interpret source/content and retain confidence/evidence links; a structured inferred-evidence taxonomy remains pending.
- [x] **LIB-029 · P1 — Relevant memory retrieval.** Supply a selected memory subset to cognitive operations and record what was retrieved; avoid passing the entire history by default. **Evidence:** [Retrieval-boundary test](packages/minds/test/observations.test.ts).
- [ ] **LIB-030 · P2 — Retrieval criteria.** Make relevance, recency, importance, emotional significance, and relationship context inspectable or configurable where used.
- [ ] **LIB-031 · P2 — Derived knowledge.** Form generalized beliefs from experiences while retaining links to supporting memories and marking the result as an inference.
- [ ] **LIB-032 · P1 — Subjective relationships.** Maintain a Mind's view of other characters, with provenance for changes; two Minds may hold different views of the same relationship.

### A4. Emotion and appraisal

- [ ] **LIB-033 · P1 — Persistent emotional baseline.** Initialize and store emotional state from temperament and circumstances rather than recreating it for each event.
- [ ] **LIB-034 · P1 — Distinct affect layers.** Represent temperament, slower-changing mood, and event-induced emotions separately; expose the chosen dimensions and meanings without requiring the illustrative taxonomy in DESIGN.md.
- [ ] **LIB-035 · P1 — Subjective event appraisal.** Evaluate an event using the Mind's beliefs, goals, identity, relationships, and existing affect; record the appraisal dimensions and outputs actually used. **Partial evidence:** [Sequential Jev appraisal](docs/implementation/split-appraisal.md) records beliefs before emotional appraisal, identity/goal/current affect, raw signed rubrics, delta policy and results. Relationships remain pending; live behavioral validation remains separate.
- [x] **LIB-036 · P1 — Incremental emotional changes.** Apply event-induced deltas to retained emotional state with defined bounds; expose before and after values. **Evidence:** [Bounded affect tests](packages/minds/test/affect.test.ts) and [transition test](packages/minds/test/inspection.test.ts).
- [x] **LIB-037 · P1 — Time-based dynamics.** Advance decay or recovery toward a baseline using simulation time; an inspection trace distinguishes time-induced changes from event-induced changes. **Evidence:** [Time-decay tests](packages/minds/test/affect.test.ts).
- [ ] **LIB-038 · P1 — Emotion affects decisions.** Emotional state participates in intention acceptance, revision, and action selection; controlled cases demonstrate a behavioral effect. **Partial evidence:** [Persistent-intention increment](docs/implementation/persistent-intentions.md); Updated affect feeds intention evaluations and action selection; controlled behavior comparisons remain pending.
- [ ] **LIB-039 · P1 — Different reactions.** Two differently configured Minds can appraise the same permitted observation differently; their traces identify the differing inputs and outputs. **Pending evidence:** Reactive betrayal is server-confirmed, but the stable case returned 404; a corroborated comparison remains pending.

### A5. Actions and expression

- [x] **LIB-040 · P1 — Action proposals.** Generate concrete candidates from active intentions, beliefs, emotions, relevant memories, and host capabilities; retain every proposed candidate. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **LIB-041 · P1 — Structured action selection.** Evaluate candidates and select an action or an explicit no-action outcome; expose rankings, scores, or labels when the provider supplies them. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **LIB-042 · P1 — Action-to-intention links.** A proposed and selected action identifies the intention or objective it serves where applicable. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **LIB-043 · P1 — Host-authoritative outcomes.** Submit selected actions to the host; distinguish proposed, submitted, rejected, and executed states, and ingest host-produced consequences as observations. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **LIB-044 · P1 — Speech acts.** Represent a communication objective separately from its generated wording, including recipient and intended outcome where relevant. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [ ] **LIB-045 · P1 — State-informed speech.** Generate wording using identity, emotions, beliefs, relationships, and the selected speech act without leaking hidden world facts. **Partial evidence:** [Action expression](docs/implementation/actions-trade.md) uses identity, affect and beliefs; relationship state remains pending.
- [x] **LIB-046 · P1 — Autonomous action cycle.** On host-scheduled opportunities, a Mind can select and submit actions without player intervention; resulting observations can trigger another cognitive cycle. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).

- [x] **LIB-065 · P1 — Belief reconciliation.** Revise stable belief identities, merge redundant beliefs atomically, and retire stale current beliefs with recorded evidence while preserving memory and history. **Evidence:** [Implementation and tests](docs/implementation/belief-reconciliation.md).

### A6. Providers, efficiency, and failures

- [x] **LIB-047 · P1 — Replaceable cognition providers.** Separate generative proposals and expression from structured evaluation through provider interfaces; support a hybrid generative/decision configuration. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **LIB-048 · P1 — Validated provider outputs.** Validate required output structure and references before applying cognitive changes; malformed or unsupported responses produce an observable failure. **Evidence:** [Invalid proposal tests](packages/minds/test/observations.test.ts) and [OpenRouter output tests](packages/minds/test/openrouter.test.ts).
- [ ] **LIB-049 · P1 — Library-owned state.** Durable identity, beliefs, intentions, emotion, relationships, and memory live in the runtime rather than only in a model conversation.
- [ ] **LIB-050 · P2 — Provider replacement.** Switch a provider and continue from saved cognitive state; record the provider change and subsequent decisions for comparison.
- [x] **LIB-051 · P1 — Selective inference.** Record which cognitive stages ran or were skipped; a trivial observation can be stored without requiring every model operation. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [ ] **LIB-052 · P2 — Failure policy.** Define timeout, retry, cancellation, and fallback behavior; repeated attempts do not duplicate committed state changes or host action submissions.
- [ ] **LIB-053 · P2 — Cost and latency accounting.** Track operation duration, provider calls, and usage/cost where available; unavailable measurements remain explicitly unavailable.
- [x] **LIB-054 · P2 — Safe state commits.** Prevent overlapping operations from silently overwriting newer state; failures leave a coherent state and expose which changes committed. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-064 · P1 — OpenRouter integration.** Supply an OpenRouter provider adapter with configurable model IDs, validated structured responses, observable failures, and non-secret inference metadata. API keys stay in the trusted host environment and are excluded from snapshots, traces, recordings, and browser bundles. **Evidence:** [OpenRouter contract tests](packages/minds/test/openrouter.test.ts), [Jev contract and rollback tests](packages/minds/test/jev.test.ts), [Jev inspection test](tests/jev-inspection.spec.ts) and [4 server-confirmed Luna calls](evaluations/results/2026-10-08-openrouter-audit.json). Jev planning integration is implemented; live Jev evaluation remains pending.

### A7. Persistence and inspection output

- [ ] **LIB-055 · P1 — State snapshots.** Export an inspectable snapshot containing identity/configuration, goal, intentions, beliefs, affect, memories, relationships, and relevant recent decisions. **Partial evidence:** [Persistent-intention increment](docs/implementation/persistent-intentions.md); Snapshots now include intentions alongside beliefs, affect and memory; relationships remain pending.
- [x] **LIB-056 · P1 — Save and restore.** Restore a saved Mind and continue its lifecycle with stable identities, history, and observation deduplication preserved. **Evidence:** [Persistence tests](packages/minds/test/persistence.test.ts).
- [x] **LIB-057 · P1 — Transition records.** Emit structured before/after changes for significant cognitive updates, including event-, decision-, and time-triggered changes. **Evidence:** [Inspection tests](packages/minds/test/inspection.test.ts).
- [x] **LIB-058 · P1 — Decision records.** Capture relevant inputs, retrieved memories, candidates, evaluation outputs, selection, and resulting transitions for important decisions. Expose provider-returned explanations where available, without requiring hidden model reasoning. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [ ] **LIB-059 · P1 — Inference metadata.** Record provider/model versions, candidate ordering, available seeds, inference parameters, and operation status; mark unavailable metadata explicitly.
- [x] **LIB-060 · P1 — Public inspection access.** A consumer can retrieve snapshots and ordered traces without depending on private runtime structures. **Evidence:** [Public inspection API](packages/minds/src/types.ts) and [inspection tests](packages/minds/test/inspection.test.ts).
- [x] **LIB-061 · P2 — Read-only inspection.** Reading or subscribing to diagnostics does not mutate cognition or alter action scheduling. **Evidence:** [Detached data/subscription tests](packages/minds/test/inspection.test.ts).
- [x] **LIB-062 · P2 — Historical reconstruction.** Retained snapshots and transitions can reconstruct a Mind at a selected point in a run; this does not require rerunning a nondeterministic model. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **LIB-063 · P2 — Recording export.** Export a run's configuration, snapshots, observations, actions, decisions, and transitions for inspection outside the running host. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).

## Shared boundary — Library to Inspector

These capabilities belong to the library's public inspection contract and the Inspector's host-supplied adapter. Both the Playbox and client games use this boundary.

- [ ] **INT-001 · P1 — Shared identifiers.** Run, Mind, observation, decision, intention, action, and transition IDs remain stable across snapshots, records, and UI navigation.
- [x] **INT-002 · P1 — Ordering and time.** Records include simulation time and an ordering mechanism that handles multiple updates at the same time; wall-clock processing time is separately labeled when exposed. **Evidence:** [Ordered trace tests](packages/minds/test/inspection.test.ts).
- [x] **INT-003 · P1 — State consistency.** A snapshot identifies its state version or trace position; updates can be associated with the correct prior state. **Evidence:** [Revision/restore tests](packages/minds/test/persistence.test.ts).
- [ ] **INT-004 · P1 — Recorded causal links.** Trace records link an observation to memories, belief changes, appraisal, emotion changes, intention revision, decisions, actions, and observed consequences where those links exist.
- [ ] **INT-005 · P1 — Distinct record types.** Consumers can distinguish host events, received observations, cognitive decisions, state transitions, action submissions, and execution outcomes.
- [x] **INT-006 · P1 — Versioned schema.** Recordings and adapters identify their schema version; the Inspector reports unsupported data rather than silently displaying it incorrectly. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).
- [x] **INT-007 · P1 — End-to-end adapter.** The Playbox supplies real library snapshots and traces to the embedded Inspector through one documented integration route that client games can also implement. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).
- [ ] **INT-008 · P2 — Incremental delivery.** An adapter can deliver new records with duplicate detection, gap detection, and resynchronization from a snapshot or retained trace.
- [ ] **INT-009 · P2 — Retention visibility.** Consumers know whether history is complete, truncated, or unavailable; queries support pagination or bounded retrieval for long runs.
- [ ] **INT-010 · P2 — Access policy.** The host can control which diagnostics are exposed, including full developer inspection versus a character's permitted knowledge; diagnostic-only data is excluded from cognition inputs.

## Project B — Minds Inspector component

### B1. Runs and current state

- [x] **UI-001 · P1 — Inspect a supplied run.** Accept a host-supplied inspection adapter, list the exposed Minds, and display the selected Mind's current snapshot in the embedding application's UI. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).
- [ ] **UI-002 · P1 — Mind overview.** Show identity, assigned goal, active intentions, current affect, notable beliefs, relationships, and last processed observation with links to detail.
- [x] **UI-003 · P1 — Full state inspection.** Inspect all exposed state fields and their provenance; a summarized overview does not hide the underlying values. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).
- [x] **UI-004 · P1 — Intention view.** Display priorities, lifecycle states, supporting beliefs, origin, and revision history for active and historical intentions. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md) and [completed-state inspection and evidence](docs/implementation/host-completion.md).
- [x] **UI-005 · P1 — Belief and memory views.** Inspect beliefs, confidence, evidence, and originating events with source/content. New observations carry no host provenance label; imported legacy records retain their historical diagnostics. **Evidence:** [Self-driven inspection](docs/implementation/self-driven-events.md) and [browser inspection tests](tests/playbox.spec.ts).
- [ ] **UI-006 · P1 — Affect view.** Display temperament, mood, emotion values, baselines, and recent deltas with scales and timestamps that explain the numbers. **Foundation evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md); unsupported state systems remain unimplemented.
- [ ] **UI-007 · P1 — Relationship view.** Inspect the selected Mind's view of another character and the recorded changes; label whose perspective is being shown.
- [ ] **UI-008 · P2 — Current-state freshness.** Show run status, last received update, and connection state; stale data is visibly identified.

### B2. Events and their effects

- [ ] **UI-009 · P1 — Unified timeline.** Present observations, decisions, transitions, actions, and outcomes in recorded order, using distinct visual types.
- [ ] **UI-010 · P1 — Event detail.** Selecting an observation shows its content, source, recipients where exposed, simulation time, and the selected Mind's resulting processing stages.
- [ ] **UI-011 · P1 — Before/after changes.** Compare cognitive state immediately before and after a selected event or transition; highlight changed beliefs, affect, intentions, memories, and relationships. **Foundation evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md); unsupported state systems remain unimplemented.
- [ ] **UI-012 · P1 — Causal navigation.** Follow recorded links from an observation through appraisal and decisions to state changes, selected actions, and host consequences; label missing links rather than invent explanations. **Partial evidence:** [Persistent-intention increment](docs/implementation/persistent-intentions.md); Intention generation/revision now joins the causal path; Action stages and host outcomes are now inspectable; complete cross-Mind causal navigation remains pending.
- [ ] **UI-013 · P1 — No-change and skipped work.** Show an event that caused no significant state change and stages that were skipped, failed, or remain pending.
- [x] **UI-014 · P1 — Decision inspection.** Show actual context, retrieved memories, all candidates, acceptance/rejection results, stopping conditions, selected output, available explanations, and provider metadata. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md) and [sequential belief/emotional inspection](docs/implementation/split-appraisal.md).
- [x] **UI-015 · P1 — Intention-generation walkthrough.** Inspect candidate order and the evolving accepted set so early acceptance and stopping behavior are understandable. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [x] **UI-016 · P1 — Action lifecycle.** Trace an action from proposal and selection through host validation, rejection or execution, and resulting observations; show the intended outcome separately from the actual outcome. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [ ] **UI-017 · P2 — Timeline filters and search.** Filter by Mind, time range, record type, intention, or action, and search exposed event and decision content.

### B3. History and behavioral understanding

- [x] **UI-018 · P2 — Historical state.** Select a trace position and inspect the reconstructed state with a clear historical-time indicator and a way to return to the latest state. **Evidence:** [Subjective turn implementation and browser coverage](docs/implementation/subjective-turns.md).
- [ ] **UI-019 · P2 — Recorded playback.** Play, pause, and step through retained records without rerunning cognition or changing the host world.
- [ ] **UI-020 · P2 — Change over time.** Plot mood and emotional dimensions over simulation time and place linked events on the same timeline.
- [ ] **UI-021 · P2 — Intention history visualization.** Show when intentions were adopted, reprioritized, revised, suspended, completed, or abandoned, with linked triggers. **Partial evidence:** [Persistent-intention increment](docs/implementation/persistent-intentions.md); Per-intention revision history and historical turn state are inspectable; a dedicated time visualization remains pending.
- [ ] **UI-022 · P2 — Perspective comparison.** Compare two Minds' observations, beliefs, appraisals, and reactions to the same host event without treating either perspective as objective truth.
- [ ] **UI-023 · P2 — Run comparison view.** Compare two host-supplied recorded runs with different configurations, providers, or seeds while exposing those differences and avoiding claims of guaranteed reproducibility; experiment orchestration belongs to the host.
- [ ] **UI-024 · P2 — Recording inspection and export requests.** Inspect an offline recording supplied by the host and emit a request to export a run or selected trace segment; the host performs file access and storage.

### B4. Embedding and operational visibility

- [ ] **UI-028 · P2 — Runtime diagnostics.** Display operation duration, call counts, available usage/cost, pending work, limits, and provider failures alongside affected decisions.
- [ ] **UI-029 · P2 — Incomplete-data handling.** Render empty, loading, disconnected, unsupported-schema, failed-operation, and truncated-history states explicitly.
- [x] **UI-030 · P2 — Accessible inspection.** Key state and timeline interactions work with a keyboard; labels, numbers, and status text convey changes without depending only on color. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).
- [x] **UI-031 · P1 — Embeddable package.** A host can mount the Inspector component in its own debug UI through a documented public entry point, without starting a Playbox application or importing its code. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).
- [x] **UI-032 · P1 — Host interaction contract.** Accept host-supplied data and selection inputs, and emit selection/navigation callbacks; host simulation controls and state-changing operations remain outside the Inspector. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).
- [ ] **UI-033 · P2 — Component lifecycle.** Mount, unmount, and change the inspected run without leaking subscriptions or showing records from the previous run.
- [ ] **UI-034 · P2 — Layout integration.** Configure component dimensions, theme, and initial panels so client games can place it in their debug layout without modifying Inspector internals.

## Project C — Minds Playbox

### C1. Scenario host and execution

- [x] **PLAY-001 · P1 — Scenario world.** Provide a minimal host with world facts, character-specific observation permissions, basic communication capabilities, action validation, and resulting events; it runs the real Minds library. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [ ] **PLAY-002 · P1 — Scenario configuration.** Define character identities, goals, permitted initial beliefs, world facts, provider settings, and available seeds before starting a run; record the configuration with the run.
- [ ] **PLAY-003 · P1 — Simulation controls.** Start, pause, resume, and advance a run by a defined simulation step; expose simulation time and pending work, including how in-flight cognition completes when pausing.
- [x] **PLAY-004 · P1 — Autonomous scheduler.** Give Minds action opportunities, route accepted actions through the host, and deliver permitted consequences as observations without requiring player prompts. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **PLAY-005 · P1 — Embedded Inspector.** Mount the reusable Inspector beside the scenario view and connect it to the active run's real snapshots and traces; selecting a scenario character selects its Mind in the Inspector. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **PLAY-006 · P1 — Test event injection.** Submit an operator-authored event through host validation and observation rules; record the intervention and inspect its effects on the affected Minds. **Evidence:** [Visual implementation record](docs/implementation/inspector-playbox.md).

### C2. Scenarios, recordings, and experiments

- [x] **PLAY-007 · P1 — Starter scenario.** Supply a runnable opposing-goal scenario with two or three characters and instructions for inspecting resulting cognitive changes. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [ ] **PLAY-008 · P2 — Scenario catalog.** Save, load, and select scenario definitions, including focused cases for belief revision, emotional continuity, intention reconsideration, and action rejection.
- [ ] **PLAY-009 · P2 — Run management.** Start a fresh run from a scenario, stop an active run, and select retained runs without mixing their state, traces, or configuration.
- [ ] **PLAY-010 · P2 — Recording file management.** Save and open supported run recordings and fulfill Inspector export requests; supply loaded recordings through the same inspection adapter contract.
- [ ] **PLAY-011 · P2 — Experiment orchestration.** Run selected variations of identity, provider configuration, or seeds, retain each configuration and result, and supply chosen pairs to the Inspector's comparison view.
- [x] **PLAY-012 · P2 — Host-world view.** Display relevant objective world facts, actions, and outcomes alongside the selected Mind's perspective, labeling the distinction and preserving cognition's information boundaries. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [x] **PLAY-013 · P2 — Headless scenario execution.** Run a scenario without rendering either UI, using the same host and scheduler, and retain recordings and evaluation results. **Evidence:** [Actions and trade implementation](docs/implementation/actions-trade.md).
- [ ] **PLAY-014 · P2 — Run failure visibility.** Report initialization, host action, provider, and recording failures with run status and links to affected diagnostics; stop or continue according to a defined policy.
- [x] **PLAY-015 · P1 — OpenRouter host configuration.** The Playbox server loads its OpenRouter API key from the environment and configures model IDs for cognitive roles; its browser receives scenario and inspection data without receiving the key. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).

## Integration and behavioral acceptance

These items verify working behavior across the projects rather than treating a collection of screens or API methods as proof of cognition.

- [ ] **VAL-001 · P1 — Autonomous opposing-goal scenario.** In the Playbox, run two or three differently configured Minds with partially conflicting goals, basic communication, a host scheduler, and persistent state for multiple turns without player prompts.
- [ ] **VAL-002 · P1 — Complete inspection path.** In the Inspector, select a received event and trace its memory, belief, emotional, intention, and action effects for stages that actually ran, including the host outcome when available.
- [x] **VAL-003 · P1 — Preserved commitment.** A scenario includes observations that leave intentions intact and an observation that warrants reconsideration; both outcomes are visible in the trace. **Evidence:** [Persistent-intention implementation and tests](docs/implementation/persistent-intentions.md).
- [ ] **VAL-004 · P1 — Knowledge-boundary scenario.** One Mind is unaware of a host fact that another observes; their inputs, beliefs, and behavior preserve that distinction.
- [ ] **VAL-005 · P1 — Emotional continuity scenario.** Repeated events and elapsed time produce bounded, incremental affect changes; the resulting decision inputs and observed behavior can be inspected.
- [ ] **VAL-006 · P1 — Host authority scenario.** Reject or fail a selected action in the host; no successful world result appears in the Mind or UI without a corresponding host outcome.
- [x] **VAL-007 · P1 — Persistence scenario.** Save and restore mid-run, preserve state and identifiers, and process the next observation without reapplying an earlier event. **Evidence:** [Save/restore continuation test](packages/minds/test/persistence.test.ts).
- [ ] **VAL-008 · P2 — Library reuse demonstration.** A client-game host with different domain vocabulary from the Playbox uses the same library through public interfaces without changing cognition internals.
- [ ] **VAL-009 · P2 — Provider-independent verification.** Deterministic test providers exercise lifecycle transitions and failure cases; live-model behavior is evaluated separately from runtime correctness.
- [ ] **VAL-010 · P2 — Long-run evaluation.** A repeatable evaluation records intention growth, belief consistency, emotional bounds, latency, and inference workload over sustained runs, with explicit acceptance criteria for the chosen configuration.
- [ ] **VAL-011 · P2 — Integration documentation.** Document embedding the library and Inspector in a client game, supplying observations and action capabilities, handling outcomes, restoring state, and running Playbox scenarios.
- [ ] **VAL-012 · P2 — Inspector reuse demonstration.** Embed the same Inspector package in the client-game host and the Playbox through their respective adapters; no Playbox imports or changes to Inspector internals are required in the client game.

## Milestone gates

| Milestone | Required evidence |
|---|---|
| **1. Headless cognition prototype** | P1 library capabilities work in the Playbox host through a non-visual runner. VAL-001 and VAL-003 through VAL-007 are demonstrated with saved traces. |
| **2. First visual end-to-end prototype** | P1 Playbox capabilities run scenarios and embed the Inspector. P1 shared-contract and Inspector capabilities consume real runtime data. VAL-002 demonstrates the event-to-effects inspection path. All P1 items are verified. |
| **3. Reusable development release** | P2 capabilities across all three projects and the shared contract are verified. A client-game host reuses both library and Inspector; the Playbox supports recordings and experiments. |

The headless prototype retains the design document's focus on autonomous cognition. The visual prototype establishes the Playbox and reusable Inspector as distinct projects, and can be developed alongside the library once the inspection contract is established.

## Later — Optional extensions

- [ ] **FUT-001 — Multiple or changing goals.** Support goal conflicts and goal lifecycle while preserving a clear distinction from intentions.
- [ ] **FUT-002 — Strategic memory.** Reuse prior strategies as candidates with provenance and fresh evaluation rather than automatic adoption.
- [ ] **FUT-003 — Richer belief revision.** Resolve contradictions and uncertainty using a chosen belief representation and explicit evaluation criteria.
- [ ] **FUT-004 — Stronger candidate comparison.** Evaluate alternative pools or comparison rounds to investigate and reduce undesirable order bias.
- [ ] **FUT-005 — Playbox run branching.** Resume a saved state with a changed event or configuration and compare the resulting recorded histories through the Inspector.
- [ ] **FUT-006 — Additional cognition modules.** Add mental-state dimensions through documented extensions that also remain inspectable in the UI.

## Design decisions to resolve before their implementation

These are decisions, not implemented capabilities. Record the selected policy and its rationale in the design document before closing the related checklist items.

| Decision | Affected capabilities |
|---|---|
| TypeScript library packaging and supported web-host runtime versions | LIB-001, LIB-007, VAL-008, VAL-011 |
| React Inspector package format and embedding API | UI-031–034, VAL-012 |
| Playbox scenario format, step semantics, and recording storage | PLAY-001–014 |
| Belief representation, uncertainty, and revision policy | LIB-025–026, LIB-031, UI-005 |
| Affect dimensions, bounds, baseline, and decay rules | LIB-033–039, UI-006, UI-020 |
| Commitment and revision policies | LIB-013–021, VAL-003 |
| Scheduling, event ordering, concurrency, and commit semantics | LIB-005–007, LIB-024, LIB-054, INT-002–003 |
| Subjective relationship representation and any host social graph | LIB-032, UI-007, UI-022 |
| Provider contracts, candidate scoring, and sampling policies | LIB-012–014, LIB-041, LIB-047–050 |
| OpenRouter model IDs per cognitive role and endpoint support | LIB-064, PLAY-015 |
| Snapshot/trace schemas, retention, exposure policy, and first adapter route | LIB-055–063, INT-001–010 |
| Behavioral evaluation criteria and supported workload targets | VAL-001, VAL-005, VAL-010 |

The capability checklist defines what users and integrators should be able to do. Detailed implementation plans, schemas, and UI layouts are separate artifacts.

