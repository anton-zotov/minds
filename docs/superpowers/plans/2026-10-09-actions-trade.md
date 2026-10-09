# Actions and trade implementation plan

**Goal:** Autonomous bounded trade dialogue through reusable Mind actions and host-authoritative outcomes.

**Spec:** [Design](../specs/2026-10-09-actions-trade-design.md)

**Execution:** Subagent-driven development: core actions and Playbox/Inspector are independent implementer tasks; primary agent owns built-in action providers, integration review and documentation. Existing user authorization waives repeat approval. No Git metadata present.

- [x] Core action types, validation, runtime machine, idempotency and versioned replay; meaningful failing tests first.
- [x] Generative action proposals/expression and Jev selection; transport and boundary tests.
- [x] Trade host, fixture, execution ledger, retries, bounded scheduler and both-Mind observation delivery; host tests.
- [x] Minimal transcript/action inspection UI and browser/visual tests.
- [x] Full offline suite/typecheck/build and independent cross-boundary review.
- [x] Capability evidence, public API examples/docs and refreshed preview.

Review focus: hidden-limit leakage; selected versus executed distinction; no-action; forged parameters; duplicate opportunity/outcome/world execution; stale offers; failure after action execution or during recipient cognition; repeated speech; mixed recording replay; schema downgrade; bounded autonomous run.
