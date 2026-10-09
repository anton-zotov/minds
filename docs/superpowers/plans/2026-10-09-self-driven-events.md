# Self-driven events implementation plan

**Goal:** Implement the approved host/Mind boundary across runtime, providers, replay and Playbox.

**Architecture:** Strict live observation validation; isolated legacy replay validation; existing shared intention machine owns completion. New clock observations use the same atomic cognition path. Versions distinguish new and legacy semantics.

**Spec:** [Self-driven events](../specs/2026-10-09-self-driven-events-design.md)

**Execution:** Use subagent-driven-development for the independent Playbox/Inspector and existing-test migrations; primary agent owns core implementation and new regression tests. No Git metadata is present. User has requested autonomous implementation without repeat approval.

- [x] Capture representative legacy recordings and add failing new-contract tests.
- [x] Implement strict observations, clock cognition, Mind completion, and versioned replay in core.
- [x] Update built-in model schemas/questions and lean context.
- [x] Update Playbox/Inspector and browser/API tests, preserving old-record display.
- [x] Migrate existing core/example tests to the new contract without dropping applicable guarantees.
- [x] Run full typecheck/build, core/API and browser suites; review replay/atomicity/boundaries.
- [x] Document completed behavior and refresh preview.

Review focus: malicious host controls; completion without evidence; terminal revival; late inference failure; timestamp monotonicity/deduplication; legacy mixed-history replay; redundant clock events during script delivery; no regeneration after Mind chooses to stop.

