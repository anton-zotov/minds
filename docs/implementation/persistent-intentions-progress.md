# Execution ledger — docs/superpowers/plans/2026-10-08-persistent-intentions.md

Design and plan recorded. User approved persistent intentions and explicitly waived further approval questions. Inline execution. No Git metadata; retain documents instead of Git-dependent scripts/commits.
Pre-flight: core produces optional version-2 intention state and staged decision payloads consumed by persistence, provider and Inspector. Playbox envelope remains version 1 with versioned native recordings. Interfaces consistent.
Task 1 complete: core planning tests RED on unsupported config, then GREEN; atomic appraisal/planning, seeded ordering, candidate safeguards, revisions, version-2 replay. Version-1 legacy suite remains green.
Task 2 complete: mocked OpenRouter planning tests RED on missing planning operations, then GREEN; shared structured request/error/redaction helper and role-specific schemas/settings.
Task 3 implemented: host scenario test RED (intentions absent), browser test RED (panel absent), then GREEN. Full unit/host/API suite 57/57; browser interactions 13/13; typecheck/build pass. Old fixed record-number assertions adapted to expanded decision traces. Candidate visual baselines pending review.
Task 4 in progress: independent code review requested; documentation and final verification pending.
Environment: sandbox API tests failed on loopback EACCES; identical tests pass with approved escalation. No code change required.
Final review: independent reviewer found unsupported strict-output uniqueItems. Regression failed then passed after removal; nonempty/uniqueness remain locally enforced. Reconsideration duplicate bypass reproduced with a failing test and fixed atomically. Full suite 59/59 green.
Spec clarifications: recommended 6/6/3/42 values are supplied explicitly by hosts; Playbox generation honors existing GENERATIVE_MODEL before appraisal fallback. Both facts documented. No material unresolved findings or deferred minors.
Visual verification: seven baselines opened; candidate decision baseline's mask originally covered hidden JSON locations. Restricted masking to first visible appraisal run-ID line and inspected regenerated image. Full final browser suite 17/17 including all seven screenshot comparisons.
Task 4 complete: CAPABILITIES v0.4 updated with 16 newly checked capability items and partial evidence for broader pending features. README, DESIGN and implementation evidence updated. Final npm test 59/59, typecheck exit 0, test:e2e 17/17; production build included. No live inference.
Preview refreshed: prior server had schema 1/planning disabled; verified its launcher/children, restarted, and confirmed Marta schema 2 with policy 6/6/3/42 and empty initial intentions. Running in session 98367 on ports 5183/5184; opened in Codex.
