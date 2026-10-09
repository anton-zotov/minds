# Sequential Jev belief and emotional appraisal

Implemented 2026-10-08 from the [design](../superpowers/specs/2026-10-08-split-appraisal-design.md) and [plan](../superpowers/plans/2026-10-08-split-appraisal.md), under the user's standing instruction to proceed without repeated approval gates.

## Implemented flow

`CognitionProvider.stages` supplies `updateBeliefs` and `appraiseEmotions`. If present, the runtime applies accepted belief updates, rebuilds detached subjective context, appraises/applies emotions, then plans intentions. The full event commits once. Otherwise the original `appraise` path remains intact. Host completion and time decay precede appraisal; memory-only observations and time-only updates skip inference.

Luna proposes at most 16 sourced belief candidates by default, each linked to the triggering observation. Known IDs support revision. Jev batches `noul` adoption and subjective-confidence questions; acceptance probability at least 0.65 applies the candidate with Jev's confidence. These are separate judgments: an accepted weakening update may have low subjective confidence. Rejected proposals preserve the old belief. Empty pools record a skipped judgment. The proposal operation, raw candidates and actual model/usage remain visible in the belief stage metadata.

Jev then receives revised beliefs and scores every supplied affect dimension using nine ordered signed-delta labels. `(score - 4) / 4 * limit` maps fractional expected scores into deltas. Default limits are 0.1 for mood and 0.3 for emotions; the existing runtime clamps values to [0,1]. `AppraisalPolicy` exposes thresholds, proposal limits and delta limits. The adapter invents no dimensions, world outcomes or completions. All thresholds and rubrics are explicit heuristics requiring separate behavioral evaluation.

Requests follow the [official OpenRouter Decisions contract](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request); the same timeout/redaction transport handles generative and typed requests. Empty affect maps perform no emotional call. Inspector counts the actual calls, including belief proposals, and shows each appraisal stage independently with precise inputs/results, raw answers and policy.

## Compatibility and host configuration

Native schema 4 begins at the first split appraised event. Earlier records retain their versions. Completion preserves version 4. Canonical replay reconstructs the changed belief context before emotional appraisal, verifies stage order and the complete trace, and performs no inference. Legacy version 1/2/3 histories and combined providers remain supported; a restored run may continue with either provider style. The inspection view and Playbox envelope remain version 1.

Playbox live mode configures `appraisalDecisionModel`. `OPENROUTER_APPRAISAL_MODEL` supplies generative belief proposals; the appraisal Jev ID uses `OPENROUTER_APPRAISAL_DECISION_MODEL`, then the effective Jev intention model, then a base Jev decision model, then `typesafe/jev-1.13`. Non-Jev intention overrides remain independent. The offline fixture retains the legacy path as a compatibility case; actual mocked hybrid browser records verify the split UI.

## Verification and review

[Runtime/adapter tests](../../packages/minds/test/split-appraisal.test.ts) cover ordering, belief rejection, confidence, exact thresholds, signed/fractional emotion scores, invalid evidence/answers, empty inference, secret redaction, rollback/retry, completion version preservation and mixed legacy/split replay with tamper checks. [API tests](../../apps/playbox/test/api.test.ts) verify model defaults/overrides. [Browser tests](../../tests/jev-inspection.spec.ts) exercise real hybrid records, revised belief input, deltas and supplemental call counts.

Independent review identified an appraisal model fallback mismatch; it was fixed with configuration coverage. Additional review recommendations for mixed replay, fractional scores, low confidence, threshold boundaries and late planning failure were implemented. `npm test` passes 90 core/host/API tests and production build; `npm run typecheck` passes; `npm run test:e2e` passes 21 browser tests with unchanged minimal UI baselines. No live Jev inference was performed for this increment.
