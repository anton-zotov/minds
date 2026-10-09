# Persistent intentions

User intent: make Minds more sophisticated and expose new capabilities in Playbox. The user approved persistent intentions and explicitly requested no further approval questions. Implement in this session.

## Behavior

Keep the host-assigned goal immutable. Planning is opt-in through `MindConfig.intentionPolicy`; existing appraisal-only clients and version-1 recordings keep working. Planning Minds use version-2 snapshots/records/recordings with an intention array. The scenario supplies recommended policy values: six candidates, six evaluations, three active intentions, shuffle seed 42. Library hosts explicitly provide all four settings; partial policies are rejected. Limits are integer 1–32 candidates/evaluations, 1–8 active, with a uint32 seed.

On an appraised observation, apply validated belief and affect proposals before planning. A replaceable intention provider has four separate operations: reconsider existing intentions, generate a candidate pool, evaluate one candidate against the evolving active set, and judge sufficiency after acceptance. Providers receive only the character's current subjective state, the observation, and the latest 20 memories. If no intentions exist, generate directly. Otherwise reconsider first; omitted revisions preserve commitments exactly. Generate only when the provider requests it or no active intentions remain. Memory-only observations and time advancement never run planning.

An intention stores a stable runtime-owned ID, description, active/suspended/abandoned status, normalized priority, assigned goal, supporting belief IDs, creation and reconsideration times, originating observation ID, and provenance for its latest revision. Reconsideration supports keep, reprioritize, revise, suspend, abandon, and reactivate. Every material revision requires evidence including the triggering memory. Completion is deferred until a host outcome contract exists: providers cannot assert success.

Candidates have local IDs, description, priority, and supporting belief IDs. Validate every output and reference before using it. Record generated candidates and a seeded shuffled ordering. Suppress exact normalized-description duplicates against retained active/suspended strategies and earlier evaluated candidates. Reconsideration cannot create duplicate retained strategies either; reject that event atomically. Semantic duplicate/conflict judgments belong to the evaluation provider, which returns accept/reject and five criterion scores (goal alignment, feasibility, emotional compatibility, novelty, compatibility). The runtime enforces candidate, evaluation, and active-intention limits independently. Stop on sufficiency, pool exhaustion, evaluation limit, active limit, or preserved commitment. Do not regenerate pools in this increment.

All appraisal and planning work for one observation commits atomically, with no consumed observation ID on failure. Queue serialization, detached contexts/getters, and duplicate suppression remain intact. Record each planning call with exact input, validated result and provider metadata, then a summary with ordering, runtime rejections, accepted IDs and stopping reason. Causal links continue observation → memory → appraisal → planning calls → summary → transition.

## Persistence

Version 1 stays byte-compatible for appraisal-only Minds. Version 2 requires planning configuration and intentions. Replay recorded planning outputs through the same deterministic planning state machine synchronously; reconstruct the exact calls, summaries, state, and causal records. Reject tampering, unsupported versions, missing stages, or inconsistent state. Restoration performs no inference. Switching injected providers is supported without changing intentions.

## OpenRouter and Playbox

Enable planning in the existing single-Mind shared-well scenario. Fixture proposals demonstrate closure-driven strategy adoption, continued commitment after corroboration, and revision on reported reopening; labels state that these are scripted mechanics, not proof of live AI behavior. The fixture supplies at least one duplicate and one incompatible candidate for inspection. No autonomous actions are added.

OpenRouter supports the same four operations through JSON Schema chat completions with separate generation and decision model settings. The library adapter defaults both to the configured appraisal model. Playbox generation first uses `OPENROUTER_INTENTION_GENERATION_MODEL`, then the existing `OPENROUTER_GENERATIVE_MODEL`, then the appraisal model; decisions use `OPENROUTER_INTENTION_DECISION_MODEL`, then appraisal. Do not silently route the reserved dedicated Jev model through chat. Record sanitized actual prompts, schemas, responses and usage, preserving the existing timeout/error/redaction policy. Wire schemas use the strict-output subset; runtime enforces nonempty/unique references locally. Automated tests use fake HTTP responses; no live inference is required.

The reusable Inspector shows intentions alongside the assigned goal, statuses, priority, supporting belief references and provenance links. It shows planning stages, candidate order, per-candidate judgments, evolving accepted sets, skipped generation, and stopping reasons. Transition details and historical turns show changes in commitments. Preserve the existing visual language and responsive/keyboard behavior.

## Evidence and limits

Verify persistence, commitment and reconsideration, affect-conditioned evaluation, known-reference validation, duplicates and bounded work, malformed/failing provider rollback, detached contexts, serialization, old recordings, and trace-tampering rejection. Host and browser tests demonstrate the three scenario events and historical reconstruction. Run full unit/host/API tests, typecheck, production build and browser tests; inspect changed visual baselines before accepting them. Update capabilities only where complete behavior has evidence. Relationships, actions, completion, Jev integration, pool regeneration and live-model behavioral evaluation remain pending.
