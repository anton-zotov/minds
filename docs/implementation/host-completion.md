# Historical implementation — superseded

This document records the earlier host-confirmation slice. Live host completion commands have been removed; the Mind now judges completion from observation evidence. See [self-driven events](self-driven-events.md). The old behavior is supported only when replaying historical recordings.

# Host-confirmed intention completion

Implemented 2026-10-08 as a bounded extension of observation ingestion and persistent intentions. This completes the four-state lifecycle without allowing models to assert world success. Action generation and execution remain the next separate subsystem.

## Contract and runtime

The trusted host supplies optional `Observation.intentionCompletions: string[]`. It must be nonempty, unique, and identify active or suspended intentions belonging to that Mind. Unknown, duplicate, completed and abandoned IDs reject the whole observation. Ordinary observation text and model revisions cannot complete intentions. Clients must construct confirmation metadata from authoritative host results, never parse it from model-generated prose.

Confirmation runs after simulation-time advancement and memory insertion on the detached event state, before appraisal. It preserves ID, description, goal, priority, supporting beliefs, creation time and origin, sets status to `completed`, updates the change timestamp and attaches the confirming observation ID as current evidence. Previous evidence remains in the trace and origin remains separately accessible. Completed identities are excluded from all provider reconsideration vocabularies and are protected by runtime validation.

Memory-only confirmations skip all inference. Appraised confirmations commit with all subsequent work; a late appraisal or planning failure rolls back memory, affect, status and schema upgrade. Retrying an uncommitted observation is safe, and repeating a committed observation ID is a no-op. A new observation trying to complete an already terminal identity rejects. Goal completion is not inferred. Later planning may adopt another strategy under a fresh ID, including a previously used description.

## Recording and UI

Native snapshots/recordings start at version 1 without planning or version 2 with planning. First successful confirmation upgrades the planning snapshot and new records to version 3; earlier records retain their versions. Subsequent operations remain version 3. Replay invokes the same completion policy before reconstructing provider contexts and planning stages, then compares the full trace and snapshot canonically without inference. Versions 1 and 2 remain supported. The existing inspection view and Playbox export envelope remain version 1.

Playbox injection accepts confirmation IDs for one selected recipient. It checks their eligibility on the serialized latest state before consuming an intervention ID or adding a turn, including concurrent queued requests. Provider failures retain the original observation for retry. The form lists only current active/suspended strategies, even when the Inspector is pinned to history, and resets selections with the run. An explicit checkbox attaches confirmation; wording alone retains commitments. Inspector shows completed status, host attribution, confirming evidence, transition changes and previous history.

## Verification

Evidence: [completion runtime tests](../../packages/minds/test/completion.test.ts), [host injection/retry/concurrency tests](../../apps/playbox/test/host.test.ts), [browser lifecycle/export/history coverage](../../tests/playbox.spec.ts), and [visual controls/completed state](../../tests/visual.spec.ts). Independent review found no correctness defects and recommended additional cases for suspended/batch completion, late planning failure, throwing replay providers and stale queued confirmations; those cases were added. Verified `npm test` (79 core/host/API tests and production build), `npm run typecheck`, and `npm run test:e2e` (20 browser tests with reviewed visual baselines). All inference in tests is mocked; no live calls were made for this slice.

