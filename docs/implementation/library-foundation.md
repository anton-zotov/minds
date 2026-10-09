# Library foundation — implementation record

**Date:** 2026-10-08  
**Plan:** [Approved implementation plan](../superpowers/plans/2026-10-08-library-foundation.md)  
**Status:** All five tasks implemented; final review findings fixed and verified

## Delivered

- Independent `@minds/core` TypeScript package with public declarations and no runtime package dependencies.
- Isolated Mind state, host-provided identity/goal/beliefs/affect, and explicit simulation time.
- Serialized, atomic observation processing with idempotent event IDs and bounded context retrieval.
- Validated provider proposals for sourced beliefs and incremental mood/emotion changes, including time-based decay.
- Detached snapshots, causal records, subscriptions, and versioned JSON recordings with validated restoration.
- Optional OpenRouter appraisal adapter with configurable model, strict structured-output requests, local validation, bounded requests, sanitized failures, and credential redaction.
- Offline public API example and an opt-in live OpenRouter example.
- Twenty-one checked capabilities with evidence in [CAPABILITIES.md](../../CAPABILITIES.md). Partial capabilities remain unchecked.

## Verification

| Check | Result |
|---|---|
| `npm test` | 31 passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed, including during the final tests/example |
| `npm run example:foundation` | Passed; duplicate ignored, second Mind unchanged, restored revision 2, anger decayed from 0.4 to 0.2 |
| Public package import | Passed without React, DOM usage, or a model SDK |
| `npm pack --workspace=@minds/core --dry-run` | Passed; built JavaScript and declarations included |
| Missing live configuration | Exits 1 with configuration guidance before requesting inference; tested with an isolated environment |
| Live OpenRouter inference | Not run; API key and model must be configured |

Tests were written and observed failing before each implementation stage. Regression tests for final-review findings were also observed failing before their fixes.

## Independent code review and fix pass

A fresh read-only reviewer checked the complete slice against the plan and ran compiled tests plus additional probes. It identified two Important findings, with no Critical or Minor findings:

1. Non-enumerable required fields passed validation but disappeared during cloning, producing corrupt observation/configuration state. Fixed by rejecting non-enumerable JSON fields except array length. Regression tests cover configuration and observation IDs.
2. Sparse arrays passed validation and could compare as empty arrays during restoration. Fixed by requiring dense arrays without extra properties and including array length in canonical comparison. A corrupted-recording regression test covers the failure.

The reviewer considered asynchronous callback failures outside the declared synchronous subscription contract. The implementer reproduced an unhandled async subscriber rejection terminating a Node host and treated it as Important. Returned promise rejections are now consumed without awaiting subscribers. A subprocess regression test confirms the host remains alive and the commit remains visible.

All fixes were performed in one fix pass, followed by the full 31-test suite, typecheck, and offline example. No deferred review findings remain.

## Implementation rulings and limits

| Decision | Reason | Consequence |
|---|---|---|
| Use the approved folder and native progress ledger instead of Git-dependent skill scripts | The workspace is not a Git repository, as specified by the plan | No commits, branch, PR, or Git-based rollback were created; the ledger is retained |
| Include only implemented systems in the snapshot | Empty intention/agency placeholders could imply capabilities exist | Future cognitive systems need compatible schema extensions or a new recording version |
| Clean generated output before each build | A removed test initially remained in compiler output | Builds recompile rather than relying on stale output |
| Continue using the supplied provider object's current `appraise` method | Immutable provider implementations were not specified; injected providers are host-owned | Host changes to a provider can affect later cognition; per-operation metadata remains the inspection source |
| Do not claim live OpenRouter behavior or semantic quality verified | No configured live key/model run was performed | Mocked contract tests establish runtime behavior; live compatibility and appraisal quality still need evaluation |
| Retain full traces and snapshots in memory for this increment | Transparent early debugging is the approved scope | Long runs can consume substantial memory; retention/storage optimization is future work |
| Keep intentions, agency, speech, relationship appraisal, React Inspector, and Playbox outside this slice | The approved first plan implements the observation/state foundation | Those capabilities remain unchecked and require later implementation plans |

The headless example is a deterministic mechanics fixture. It does not demonstrate autonomous model-driven planning or the complete P1 prototype.

## Next increments

1. Library intention generation/lifecycle and host-authoritative action selection.
2. Embeddable React Inspector over real state and inspection records.
3. Playbox scenario host and controls, embedding the same Inspector component.
