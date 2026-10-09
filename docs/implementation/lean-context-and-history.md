# Historical trimming slice

The measurements and version-5 details below describe the original trimming increment. The current event contract removes host processing/provenance/completion fields entirely and uses journal 7 after new events; see [self-driven events](self-driven-events.md). Historical journal 5 remains readable.

# Lean model context and retained history

The goal is to send and retain only data needed for subjective cognition, deterministic replay, and useful inspection. This change preserves the full public snapshot and custom-provider context contracts. Built-in OpenRouter/Jev adapters apply an explicit inference allowlist at their transport boundary.

## Model requests

Requests retain identity, assigned goal, current time, current beliefs and confidence/evidence references, current affect values, and compact intentions. Intention status remains visible, including host-completed commitments. Planning retains the active limit and operation-specific candidate, generation limits, or requested revision data. Event IDs, content, time, source, kind and provenance remain available for interpretation and evidence attribution.

They omit run/mind IDs, schema versions, revisions, initial state, affect baselines/half-lives, dispatch modes, host completion commands, per-intention duplicate goals and lifecycle timestamps. Historical memories are flat events; the triggering event occurs once and is excluded from historical memories. Active intentions are identified by status rather than copied into another array. Jev rules remain in the question instructions and are no longer repeated in state.

Schema construction and response validation still use the original runtime context. The current observation therefore remains a valid evidence reference even though it is supplied once on the wire.

## Journal and compatibility

The runtime retains current state, its deduplication set, and a schema-5 journal containing initial configuration once, observed events once, time advancements, and provider results in execution order. It does not retain expanded historical snapshots, decision inputs, duplicated cycle call lists or derived planning summaries. Results retain sanitized actual request/response metadata for the Inspector's model-call evidence; these are now smaller because the requests use the inference allowlist.

`exportCompactRecording()` returns the journal. `restoreMind()` accepts journal version 5 and expanded recording versions 1–4. It validates and replays journal outputs through the same appraisal/intention logic without inference. Malformed stages, missing planning results, memory-only decisions, duplicate events and unknown fields reject. Recordings are consistency-checked data, not signed attestations of model responses.

`getRecords()` and legacy `exportRecording()` reconstruct the original full diagnostic contracts on demand. Full inspection still costs CPU and transient memory proportional to the expanded history; this change does not make large historical inspection cheap. `getRecordCount()` and empty suffix queries avoid replay. Playbox polls a small status endpoint during pending operations and fetches diagnostic state only when status or record counts change.

Playbox's download button uses envelope version 2 with native journal version 5; scenario configuration is already present in each Mind journal. The original `/api/recording` endpoint remains compatible; `/api/recording?format=compact` serves the compact format. Recording-file loading in the UI remains unimplemented.

## Verification and measurement

Tests cover inference omissions while preserving goal/affect/evidence, exact diagnostic replay and continuation, expanded recording compatibility, staged appraisal/planning/completion without inference, malformed journals, compact API downloads and browser completion evidence.

A deterministic shared-well fixture with 12 repeated events measured JSON UTF-8 bytes:

| Representation | Before | After | Reduction |
|---|---:|---:|---:|
| Final appraisal context | 6,220 | 2,518 | 59.5% |
| Recording | 290,542 | 13,651 | 95.3% |

These are fixture measurements, not universal token, memory, or billing savings. No live inference was required for verification.

