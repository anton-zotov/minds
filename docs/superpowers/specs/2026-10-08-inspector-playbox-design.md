# Inspector and Playbox: first visual slice

Date: 2026-10-08
Status: Approved and implemented

## Purpose and acceptance

Make the implemented Minds foundation visible and explorable. Developers can run a small scenario, inspect each character's actual state, and follow observations through memory, appraisal, and state transitions. The user approved this scope and requested Playwright interaction coverage and visual snapshots.

The first slice succeeds when the Playbox runs locally, embeds the reusable Inspector over real library data, and demonstrates distinct character perspectives, sourced beliefs, emotional changes, and decay. No synthetic traces or unsupported cognitive stages are presented as implemented.

## Project boundaries

- `packages/minds` remains the cognition library; use its public API.
- `packages/inspector` becomes an independently embeddable React package, exported as `@minds/inspector`, with its own stylesheet and typed public contract.
- `apps/playbox` owns scenario configuration, runtime instances, controls, recording files, and server-side provider configuration. Its React frontend uses Vite; a local Node HTTP server owns cognition operations. Vite proxies the API during development.

Keep React out of core. Keep Playbox code and provider credentials out of Inspector. Extend npm workspaces and build/typecheck commands to cover both new projects without breaking existing library examples and tests.

## Inspection contract

Use a versioned, read-only run view containing run ID, provider mode, simulation time, status, exposed Mind snapshots and ordered records, plus separately reported operational errors. Each Mind retains its own record sequence; cross-Mind records must not imply a global cognitive ordering that the library does not expose.

Inspector accepts this detached view as props and supports controlled Mind and record selection with navigation callbacks. Hosts own fetching, subscriptions, mutations, and file access. The same component can render server-fed views or host-supplied offline recordings. Unsupported schema versions produce an explicit message rather than a partial interpretation.

Represent the existing schema accurately: identity, description, goal, beliefs, mood, emotions, memories, revision, and simulation time. Intentions, actions, and relationships receive an explicit unimplemented label. Appraisal detail shows actual recorded context, proposal, and provider metadata; absent candidate lists or explanations are identified as unavailable.

## Inspector interface

Use a compact developer workspace with a Mind selector, overview/state panels, timeline, and record detail. Mood and emotion meters show values, baselines, and half-lives with numbers and labels. Beliefs link to recorded memory evidence; memories expose content, source, provenance, processing mode, and time.

Timeline entries distinguish initialization, observation, memory, decision, and transition. Selecting an entry exposes its payload and recorded causal links. Links navigate within the selected Mind's trace. Transition detail compares recorded before/after state and highlights belief, memory, and affect changes, including requested versus bounded affect deltas. Time-only transitions identify decay; memory-only observations identify skipped appraisal. An expandable raw-data view preserves access to full supplied fields.

Use keyboard-operable native controls, visible focus, semantic labels, and text alongside color. On narrow screens the main regions stack; desktop uses a scenario/control area beside the Inspector. Selection resets safely when the inspected run changes.

## Playbox scenario and controls

Provide two characters with partially conflicting goals around access to a shared resource, distinct initial beliefs and affect configurations, and a short scripted sequence of host-authored reports and witnessed events. Each event has explicit recipients; only recipients receive observations. Host facts and the character's perspective are labeled separately.

Start creates a fresh run at time zero. Step delivers the next scripted event at its configured simulation time. Advance time moves all Minds forward by a fixed displayed interval to demonstrate decay. Inject event validates nonempty content, recipient selection, provenance, and processing mode, then delivers at current simulation time with fresh IDs. Reset creates new instances and clears run-specific selections and errors.

Operations serialize at the host and controls display pending work. Multi-Mind deliveries may partially succeed: report outcomes per recipient and keep successful committed state visible. A failed appraisal does not appear as a committed cognitive record. Script progress advances after all recipient outcomes are known; retry targets failed recipients with the same observation IDs. Reset is disabled while an operation is pending. There is no autonomous action scheduler in this slice because action selection is not implemented.

Export downloads a versioned Playbox recording envelope containing configuration and each Mind's native recording. Import is outside this first slice; the Inspector contract nevertheless supports views built from validated recordings by a host.

## Providers and local API

Offline fixture mode is the default and clearly labeled throughout the run. It deterministically proposes scenario-related belief and affect updates using actual supplied context, exercising the real runtime. It does not claim autonomous cognition.

Optional OpenRouter mode uses the existing appraisal adapter and environment configuration in the Node server. The browser receives safe provider availability/model metadata, never the API key. Missing configuration produces an actionable preflight error. Provider mode is fixed when a run starts; switching mode creates a fresh run. API responses and export envelopes use allowlisted data, and raw provider error bodies are not exposed.

Local endpoints cover provider availability, current run view, fresh-run creation, scripted step, time advance, observation injection, and recording export. Validate bodies and reject malformed requests with clear errors. Bind the development server to loopback. No live inference is used by automated tests; an optional manual live smoke test is explicitly billable.

## Verification and Playwright snapshots

Keep the existing core tests passing. Add focused tests for the read-only adapter, scenario recipient isolation, monotonic time, host pending/failure behavior, and export compatibility with core restoration. Add an independent embedding fixture proving Inspector has no Playbox dependency.

Playwright starts the local frontend/server in fixture mode with fixed scenario inputs and a fresh run per test. Functional coverage includes initial state, switching characters, stepping an event, navigating observation-to-effects links, before/after details, time decay, memory-only injection, validation errors, reset isolation, recording download, and keyboard navigation. Mock the provider boundary for server failure cases; avoid external inference and nondeterministic time.

Commit screenshot baselines for the initial desktop workspace, an event-selected state with visible changes, and a narrow viewport. Use fixed viewport sizes, locale, timezone, browser version via the lockfile, fonts, and reduced motion; disable animations and exclude incidental wall-clock values. Assertions on meaningful state accompany screenshots so image comparisons cannot substitute for behavioral checks. Use Chromium as the initial baseline target and document the OS used to generate baselines; generate and compare baselines in the same OS/browser environment. Baseline updates are explicit commands and reviewed as visual changes.

Run builds, typechecks, focused host/component tests, and Playwright tests. Inspect rendered screenshots before accepting baselines. Document startup, provider configuration, embedding, test execution, and snapshot updates. Update capability evidence only for behavior actually implemented, preserving partial or future requirements as unchecked.

## Scope limits

This implements visualization of today's cognition foundation. Autonomous scheduling, intentions/actions, relationships, run comparisons, historical reconstruction, recording import, persistent scenario catalogs, and deployment remain subsequent work.

## Repository condition

The current workspace has no Git metadata. Save design, code, and screenshot artifacts in the workspace; commits cannot be created unless a repository is initialized separately.
