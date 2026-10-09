# Sequential appraisal implementation plan

> Execute inline using superpowers:executing-plans. Standing user instruction waives approval pauses. No Git metadata exists; retain evidence in documentation.

**Goal:** Jev belief evaluation followed by Jev emotional appraisal using revised beliefs, atomic and inspectable.
**Spec:** [Sequential appraisal design](../specs/2026-10-08-split-appraisal-design.md).
**Stack:** TypeScript core, OpenRouter Decisions/structured chat, React Inspector, Node tests, Playwright.

1. [x] Write failing staged-runtime/adapter tests for context ordering, rollback, judgment mapping and replay.
2. [x] Add stage types, validators and deterministic apply/replay helpers. Integrate native schema 4 and recording generation without changing legacy traces.
3. [x] Add bounded generative belief proposals and Jev judgments; add signed emotion rubrics and recorded policies. Preserve redaction and transport failures.
4. [x] Configure Playbox live staged cognition. Teach Inspector to render/classify both decision stages and actual provider counts; add real mocked hybrid browser records.
5. [x] Run core/API, typecheck/build and browser checks. Review independently, resolve findings, update capabilities/design/README and implementation evidence. Refresh preview without paid inference.

Evidence: [implementation record](../../implementation/split-appraisal.md). Ruling: retain the legacy offline fixture rather than changing its scripted trace; live Playbox and mocked hybrid browser records use the staged contract. Ruling: inherit the effective Jev intention model for appraisal unless overridden; preserve chat-only intention overrides by falling back to a base/default Jev model.
