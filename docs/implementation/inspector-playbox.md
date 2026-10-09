# Inspector and Playbox implementation record

Date: 2026-10-08

Theme update: Playbox and the reusable Inspector now use a dark green palette with bright text, distinct selected states, dark native controls, and preserved focus indicators. All four dark-theme baselines were regenerated and opened for visual inspection. Playwright uses independent ports 5185/5186 so tests preserve the live preview.

The first visual slice adds a reusable `@minds/inspector` React package and a Playbox frontend/server over public `@minds/core` state. The scenario uses two characters with distinct goals, beliefs, and affect. It exposes scripted observations, recipient-scoped operator injection, time decay, fresh-run reset, fixture/OpenRouter selection, and recording export.

Inspector displays identity, goal, beliefs and evidence, affect values/baselines/half-lives, memories and provenance, per-Mind ordered records, causal navigation, actual appraisal context and proposals, before/after transitions, and raw snapshots/records. It explicitly identifies unsupported schema, empty data, skipped appraisal, and unimplemented cognitive systems. A standalone embedding fixture proves its public interface without server or Playbox scenario imports.

## Verification

- Existing baseline: 32 core tests passed before implementation.
- Host/API coverage exercises recipient isolation, native recording restoration, detached views, decay, monotonic time, serialized pending operations, partial failure/retry, malformed requests, reset rejection while pending, and credential-safe configuration/errors.
- Playwright behavior coverage exercises actual browser views and runtime data; provider failures are controlled at the boundary and tested independently in server tests. No automated test invokes live inference.
- Screenshot assertions are paired with literal state assertions and include desktop and 390px narrow layouts, long content, and a page-width check.
- Four candidate PNGs were opened with the image-view tool: `initial-desktop-win32.png`, `event-transition-win32.png`, `narrow-observation-win32.png`, and `narrow-inspector-win32.png`. Review confirmed selected controls, visible causal links, initial anger 0.000 and post-event anger 0.400, before/after values, readable text, wrapped content, and no page overflow. The narrow Inspector was opened separately at original resolution to verify small details rather than relying on a downscaled full-page image.
- Baseline environment: Windows, Playwright 1.64.0, Chromium 156.0.8078.4, Segoe UI/Arial system fonts, `en-US`, `Europe/Warsaw`, reduced motion, desktop 1440×1000 and narrow 390×844.

Final verification: `npm test` passed 41/41 core/host/API/environment tests and rebuilt all three packages; `npm run typecheck` passed; `npm run test:e2e` passed 12/12 browser tests, including comparisons against all four visually inspected baselines without updates. Playwright's inherited color environment emits a harmless NO_COLOR/FORCE_COLOR warning; browser page-error assertions passed.

Independent review found two defects: reload during a pending operation could leave controls disabled, and root dotenv port overrides were missing from Vite. Regression tests reproduced both gaps, then passed after polling was extended to received pending views and a shared environment loader propagated ports while stripping OpenRouter settings from the frontend process. No live inference was performed.

## Operational decisions

Use loopback ports 5183 (frontend) and 5184 (API), because another project owns port 5173. Playwright refuses server reuse so another application cannot silently satisfy readiness. `npm run dev` builds core before startup. API mutations serialize through the host. A partial appraisal failure blocks subsequent scenario/time/injection operations until failed recipients are retried or the run reset; successful recipients are retained and not reappraised during retry. Script timestamps clamp to current simulation time after manual time advancement.

Fixture mode labels deterministic proposals separately from real runtime commits. OpenRouter credentials and inference stay in the Node process. Tests verify configuration availability without key exposure; live provider behavior remains unverified in this slice.

## Capability scope

Complete foundation evidence: INT-006, INT-007, UI-001, UI-003, UI-005, UI-030, UI-031, UI-032, PLAY-006, and PLAY-007. UI-006 and UI-011 have foundation evidence for affect and before/after changes but retain unchecked status because broader cognitive systems are unavailable. Other broad capabilities retain unchecked status where only their foundation stages exist: timeline/action coverage, run configuration, lifecycle, complete world mechanics, imports, autonomous scheduling, all cognitive-role provider configuration, and historical/replay/comparison features.

No intentions, action generation, relationships, autonomous scheduler, recording import, or persistent storage is claimed implemented. No Git metadata exists in this workspace, so no commit or worktree was created.
