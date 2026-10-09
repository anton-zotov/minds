# Persistent intentions — implementation evidence

The library now maintains chosen strategies separately from the host-assigned goal. The existing single-Mind Playbox demonstrates the new state and planning traces through the reusable Inspector.

## Verified behavior

- Opt-in planning providers generate a bounded candidate pool, evaluate a seeded ordering incrementally, and judge sufficiency after acceptance. Five subjective criteria and provider explanations remain inspectable.
- Exact normalized-description duplicates are suppressed before evaluation. Reconsideration cannot create duplicate retained strategies. Candidate/evaluation/active limits stop work independently, with recorded stopping reasons.
- Runtime-owned stable intention IDs retain the assigned goal, supporting belief IDs, status, priority, creation/change times, origin observation and revision evidence. Omitted revisions preserve commitments; material changes require the current observation as evidence. Supported decisions: keep, reprioritize, revise, suspend, abandon, reactivate.
- Updated beliefs and affect feed planning in the same observation. Memory-only ingestion and time advancement preserve intentions without planning calls. All appraisal and planning work for an observation commits atomically; failure leaves its ID retryable.
- Version-2 native recordings restore by replaying the same deterministic planning state machine without inference. Altered inputs, summaries, order, references, snapshots or causal records are rejected. Appraisal-only version-1 recordings retain their original shape and remain supported.
- OpenRouter supports four separate chat-based planning operations with generation/decision model settings, strict-output schemas, sanitized actual requests/results, explanations and available usage. Runtime enforces uniqueness/nonempty constraints that are omitted from the wire schema.
- Inspector panels show active and historical intentions, priority, supporting beliefs, evidence navigation and revision history. Turn selection reconstructs the corresponding commitments. Planning outcome shows all generated candidates in evaluation order, runtime/provider rejection, evolving active counts and stopping reasons. Individual calls expose complete inputs/results and scores.

## Scenario walkthrough

Run `npm run dev` and open `http://127.0.0.1:5183`. In offline fixture mode:

1. First **Step scenario**: closure evidence adopts community support and public-access negotiation. Seed 42 evaluates support → force → negotiation → duplicate; the force candidate is rejected and the duplicate suppressed. The pool is exhausted with two active intentions.
2. Second **Step scenario**: witnessed corroboration retains both commitments and skips generation.
3. Third **Step scenario**: reported reopening revises negotiation into monitoring and suspends community pressure. This is a response to reported evidence, not a host-confirmed successful outcome.
4. Select earlier turns to inspect retained intentions and their actual planning sequence. Expand each intention's history or follow evidence/transition links. Advance time or inject a memory-only observation to see preserved commitment without planning.

Fixture proposals are scripted mechanics; durable state, validation, limits and traces come from the real library. OpenRouter mode uses live inference and can make multiple billable calls per appraised event. No live inference was performed to verify this increment.

## Tests and review

- [Core planning tests](../../packages/minds/test/intentions.test.ts): adoption, goal separation, preserved commitment, reconsideration provenance, updated subjective inputs, seeded order, duplicates, independent limits, rollback/retry, validation, detached serialized contexts, restore continuation and trace corruption.
- [OpenRouter planning tests](../../packages/minds/test/openrouter-intentions.test.ts): all four roles, model routing, actual input/output/usage, malformed references, escaped credential echoes, timeouts and strict-schema compatibility.
- [Host tests](../../apps/playbox/test/host.test.ts): shared-well adoption → commitment → revision, recording restoration, event turn boundaries and recipient failure handling.
- [Browser interactions](../../tests/playbox.spec.ts): candidate judgments, commitment/revision, historical intention state plus existing inspection/control behavior; independent embedding coverage in [embedding tests](../../tests/embedding.spec.ts).
- [Visual tests](../../tests/visual.spec.ts): seven baselines covering desktop, mobile, transition details, expanded appraisal data, adopted intentions and revised intentions. Images opened and visually inspected. Decision screenshot masking is restricted to the visible run-ID line so hidden JSON cannot cover unrelated content.

Independent review found an unsupported `uniqueItems` wire-schema keyword, corrected with a failing regression test while preserving local uniqueness checks. The [official SDK](https://github.com/openai/openai-node/blob/master/src/lib/transform.ts) marks the keyword unsupported; the [documented strict-output subset](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas) guides the request schemas. A reproduced reconsideration duplicate bypass was also fixed atomically with RED→GREEN coverage. Spec clarified that the library requires all policy settings and Playbox generation honors the existing generative-model setting. No unresolved material review findings.

Final verification: `npm test` 59/59 (includes production build); `npm run typecheck` passed; `npm run test:e2e` 17/17, including all seven visually inspected baseline comparisons without regeneration. Tests ran locally on Windows with fixtures/fake HTTP; loopback API/browser tests required sandbox escalation. No live inference.

## Remaining scope

Actions/speech, relationships, completed intentions with host-authoritative outcomes, semantic duplicate guarantees, regenerated candidate pools, internal reflection, Jev's dedicated decision endpoint, bounded history storage and live-model behavioral evaluation remain pending. This increment does not close capabilities requiring those systems. Recommended Playbox limits are 6 candidates, 6 evaluations, 3 active, seed 42; core policies require explicit values. Provider scores remain subjective judgments, and a shuffle seed reproduces runtime order only, not live-model output.
