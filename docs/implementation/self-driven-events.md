# Self-driven events

The host supplies what the character can observe. The Mind determines interpretation, credibility, emotional significance and whether a strategy is fulfilled.

## Live event contract

`Observation` contains only `id`, `time`, `source`, `kind` and `content`. Live ingest rejects `processing`, `provenance`, `intentionCompletions` and other unsupported fields. All observations enter cognition; a provider may return no changes. The host can describe speech or a visible outcome in the content, but cannot force how it is believed or processed. Built-in model prompts ask for subjective interpretation from source/content and existing beliefs. A separate structured inferred-provenance taxonomy is not yet implemented.

Processing order is elapsed-time decay → memory → belief update → emotional appraisal → intention reconsideration → atomic commit. Combined appraisal providers remain supported. Neither completion nor credibility is authoritative world truth.

## Time and completion

`advanceTime()` now creates an `elapsed-time` clock observation describing the duration, with a deterministic collision-safe ID. Equal-time advancement is a no-op. Clock observations use ordinary cognition after decay; no speech, action outcome, or change in the world is fabricated. Failures retain the prior state and permit retry. Simulation time must remain monotonic.

Intention reconsideration supports `complete`. Active and suspended strategies can complete; unknown, duplicate or terminal IDs reject. Evidence must refer to known memories and include the triggering event. Stable identity, description, goal and origin remain intact. Jev exposes completion as a lifecycle choice and applies the existing revision threshold (default 0.65). A completion judgment can be mistaken. Completed/abandoned strategies cannot revive.

`generateMore: false` stops generation after reconsideration even if no active strategy remains. Initial generation and future events with no retained commitments can still propose a new pool; the provider can return an empty pool. A late failure after proposed completion rolls back that completion and all other event work.

## Replay and UI

The first new event upgrades state and inspection records to version 6; initial snapshots remain 1/2 until an event. Compact journals upgrade to version 7. Expanded versions 1–4 and journals 5 restore without inference, preserving original host-confirmation, memory-only and time-only semantics. Mixed histories keep old records unchanged. Old controls are accepted only by historical replay validation, never live ingest. Legacy controls/time-only transitions cannot follow a new-contract event in a recording.

Playbox asks only for content and recipients. Script recipients receive the timestamped event directly, avoiding a redundant clock event; other Minds receive a clock observation. Clock/provider failures appear in the existing failed-recipient flow and retry the identical observation. The offline fixture returns no appraisal changes for a clock event, and interprets outcome wording to demonstrate subjective completion. This fixture is mechanics evidence, not model-quality validation.

The Inspector displays source/kind, judgment evidence and the label “The Mind believes this strategy is fulfilled.” Imported historical records retain explicitly legacy provenance, memory-only and host-completion diagnostics. Download envelopes remain version 2 with native journal 7 after new events. The expanded export API remains available.

## Verification

- [New observation, clock, legacy replay and Jev threshold tests](../../packages/minds/test/self-driven-events.test.ts).
- [Completion evidence, terminal protection and atomicity](../../packages/minds/test/completion.test.ts).
- [Host delivery, clock failure/retry and forbidden controls](../../apps/playbox/test/host.test.ts).
- [Current and legacy browser inspection](../../tests/playbox.spec.ts), [Jev diagnostics](../../tests/jev-inspection.spec.ts), and [reviewed visual baselines](../../tests/visual.spec.ts).

Verified production build, all typechecks, 99 core/host/API tests and 22 browser tests. Actual legacy versions 1–4/journal 5 were captured before implementation and replayed exactly, then continued with clean observations. An independent read-only review found no actionable defects. No live inference calls were made.
