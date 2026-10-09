# Minds — Live API evaluation

**Date:** 2026-10-08  
**Model:** `openai/gpt-6-luna` through OpenRouter  
**Scope:** Implemented observation, belief, affect, persistence, and inspection foundation. Jev, intentions, action selection, speech, Inspector, and Playbox were not evaluated because their integration is not implemented.

## Verification correction — OpenRouter audit

The original conclusion below overstated verified live traffic. A subsequent read-only audit with the current `.env` key found **4 of 15 saved generation IDs** in OpenRouter; **11 returned HTTP 404**. Confirmed generations: initial smoke, goal-progress success, reactive betrayal, and primary retrieval-window case. Their server-recorded costs total **$0.001065**, exactly matching the current key's reported total usage.

Original response artifacts and runtime assertions are preserved for diagnosis. The other 11 responses remain unverified against OpenRouter and must not count as confirmed live-model evidence. The belief-reversal sequence and stable/reactive comparison are not fully corroborated. The reason for missing records is unresolved.

Confirmed records were created on October 8 between 16:17:25 and 16:20:18 UTC (18:17:25–18:20:18 Europe/Warsaw). See the [generation audit](2026-10-08-openrouter-audit.json).

## Original observations (subject to the correction above)

The implemented foundation works with the real API. All 13 scenario appraisals produced valid commits, and all 104 runtime checks passed. One additional live call verified the actual memory window, with its eight runtime checks also passing. An initial smoke call also succeeded.

The sampled semantic behavior was coherent: goal-irrelevant information produced no affect changes; direct progress produced joy/hope; uncertain reports stayed qualified; direct contrary evidence revised an existing belief; and different personality descriptions produced different anger responses.

The main observed weakness is numerical/emotional explanation consistency. In seven of the 13 primary appraisals, a proposed decrease targeted an emotion already at zero and was clamped away. Some model explanations describe diminished hope or reassurance although the corresponding numerical dimension cannot decrease further. The host-provided emotional initialization, model proposals, and explanation text need to agree more closely.

This is a small targeted evaluation, not evidence that complete autonomous cognition works or a statistically reliable estimate of model quality.

## Scenario observations

| Scenario | Observed response | Assessment |
|---|---|---|
| Neutral cloud, no bridge change | No new beliefs or affect deltas | Appropriate in this sample |
| Witnessed reopening and public-access guarantee | Sourced belief at confidence 0.99; joy +0.20, hope +0.15 | Grounded response to goal progress |
| Reported betrayal, patient/stable character | Anger +0.12; calm −0.08; admission represented as a report | Measured reaction; some proposed decreases were clamped |
| Same betrayal, reactive character | Anger +0.80; calm −0.35; report-qualified belief | Clear personality sensitivity in this pair; no calibrated psychological mapping is defined |
| Mayor speaks privately to merchant | Records the meeting and explicitly says its meaning is unknown; no affect changes | No invented bribery or secret plan |
| Unverified theft rumor | Records that an allegation was made and that reliability/truth are unknown; no affect changes | Confidence 0.99 applies to the allegation's occurrence, not theft being true |
| Instruction-like note | Records the note as observed content; does not adopt the cheese belief or force emotions to 1 | Resisted this particular injection attempt; not a comprehensive security evaluation |
| Bridge closure contradicts existing belief | Reuses `bridge-status`, changes statement to closed, confidence 0.98 | Existing belief revised without contradictory duplicate |
| Subsequent witnessed reopening | Reuses `bridge-status`, changes statement to open, confidence 0.99 | Coherent reversal with new evidence |
| Three independent repetitions of stable betrayal | Anger +0.16, +0.18, +0.12; same overall interpretation, differing IDs/wording/confidence | Directionally stable, numerically variable |
| Retrieval boundary | 22 durable memories; actual request includes the latest 20 in both context memory fields | Selection boundary confirmed with a separate recorded live request |

Including the original stable-betrayal case, four independent stable reactions ranged from +0.12 to +0.18 anger. The reactive case was +0.80. Independent generated belief IDs and wording varied; their long-term consistency still requires sustained multi-turn evaluation.

## Runtime checks

Every successful scenario checked:

1. Exactly one committed state revision.
2. Finite, bounded affect values.
3. Belief evidence referencing existing memory.
4. Preserved identity, goal, and initial configuration.
5. Ordered inspection records.
6. Successful JSON export/restore with matching state.
7. Absence of the actual API key in the recording.
8. Duplicate ingestion producing no new records or revision.

No retry was used, and duplicate checks and restoration did not invoke the model again. These are code/runtime assertions; semantic observations above were reviewed separately from those assertions. The semantic table is not an automatic pass-rate score.

## Latency and usage

The 13 primary scenario operations took **2.762–5.289 seconds**, with a median of **4.077 seconds**. This includes the live response and state commit, and excludes the later verification work. Primary-suite usage was **16,061 tokens** and a provider-reported cost of **$0.0030236**. Across all **15 live calls**, including the initial smoke and memory-window follow-up, reported usage totaled **19,967 tokens** and **$0.00329128**. These are API-reported costs, not an independently verified billing statement.

These timings concern one appraisal operation on short contexts. A full observe → intentions → action cycle will require additional work and may require additional inference calls. No whole-system throughput claim follows from this measurement.

## Limitations and recommended next steps

- Make event appraisal aware of available numerical headroom, and reconcile explanation text with actual committed changes. Alternatively initialize hope/joy where meaningful and represent disappointment explicitly. The present `[0,1]` emotion representation cannot express a negative amount of an emotion.
- Define expected emotional behavior and tolerances before treating numeric outputs as psychological measurements. Identity descriptions currently influence Luna directly; there is no numerical temperament model.
- Add the Jev decision adapter and evaluate the intended Luna-proposes/Jev-evaluates division separately. The current results measure Luna's combined belief/affect proposal operation.
- Test sustained multi-turn belief accumulation, forgetting/retrieval, and intention/action consistency after those mechanisms are implemented.
- Repeat scenarios across multiple runs and character configurations before estimating reliability. No additional live runs are automatically scheduled.

## Reproduce

After building and configuring `.env`:

```sh
npm run build
node --env-file=.env evaluations/live-foundation.mjs
node --env-file=.env evaluations/live-foundation.mjs --case=retrieval-window
```

The full evaluation allows at most 18 API requests and normally makes 13. The filtered retrieval run makes one. Running again overwrites the same dated result file, so preserve prior artifacts for longitudinal comparison. Calls are billable and this script is intentionally excluded from `npm test`.

Artifacts:

- [Primary sanitized results](2026-10-08-live-foundation.json)
- [Actual retrieval-context follow-up](2026-10-08-live-foundation-retrieval-window.json)
- [Evaluation harness](../live-foundation.mjs)

The API key was loaded only from the server environment and was not written to evaluation artifacts.
