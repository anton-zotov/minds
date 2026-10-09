# Actions and two-Mind trade

The library now separates action proposals, structured selection, speech expression, and host execution. `ActionProvider.generate`, `select`, and `express` can be replaced independently. OpenRouter uses a generative model for proposals and wording and Jev for scores and selection, including explicit no action.

Hosts describe permitted capabilities and required typed parameters. The runtime checks targets, active intention links, candidate limits, complete score coverage and speech length before committing a plan. A selected objective stays separate from wording. Planning receives only the acting Mind's state and recent memories; built-in requests omit diagnostic history and redundant fields.

```ts
const planned = await mind.planAction({
  id: 'conversation-1', time: mind.getSnapshot().time,
  capabilities: [{
    id: 'speak', description: 'Speak to the other character',
    targets: ['other-character'], parameters: [], expression: 'speech',
  }],
});
if (planned.action) {
  await mind.submitAction(planned.action.id);
  // The host validates and executes the structured candidate.
  await mind.resolveAction({
    actionId: planned.action.id, status: 'executed', reason: null,
  });
  // Deliver the actual observable consequences with mind.ingest(...).
}
```

Receipts record proposed, submitted, executed or rejected status. They do not tell the Mind to complete a strategy. Consequence observations run normal belief, affect and intention cognition. Repeated opportunities and receipts are idempotent. Failed selection retains validated proposals; failed expression retains the selected candidate. One transient pending cache is invalidated by any committed state change. Pending failures do not commit partial state or traces. This cache is not persisted across process restarts.

Action histories use expanded schema 8 and compact journal 9. Both replay without inference and preserve earlier event schemas. Inspection reconstructs candidates, scores, speech, provider requests and lifecycle transitions. [Core tests](../../packages/minds/test/actions.test.ts) and [mocked OpenRouter tests](../../packages/minds/test/openrouter-actions.test.ts) cover these boundaries.

Playbox hosts Marta, who wants to buy apples cheaply with a private ceiling of 8 coins, and Ivo, who wants to sell dearly with a private floor of 6. Only each Mind receives its own private configuration. The host permits speech, offers and acceptance of the latest other-party offer; validates inventory, funds and whole-number prices; and executes transfers once. Words alone cannot transfer assets.

**Step conversation** schedules one alternating actor. **Run conversation** allows at most 12 turns, stopping on a deal, provider/delivery failure or the turn limit. Rejected actions become observable outcomes and later turns can continue. Retry preserves completed execution, utterances and successful deliveries, and maintains per-recipient observation order. The deterministic offline fixture offers 5, counters with 7 and accepts 7, leaving Marta with the apples and 3 coins, and Ivo with 7 coins. Live models choose their own actions and wording.

The UI displays the public ledger and transcript alongside either Mind's subjective state and action diagnostics. Exports contain the public world and both restorable journals; importing/resuming the host world is not implemented. [Host tests](../../apps/playbox/test/host.test.ts), [API tests](../../apps/playbox/test/api.test.ts), and [browser tests](../../tests) verify the integration. Fixture and mocked HTTP checks establish mechanics; live trading model quality has not been evaluated.

Verification: `npm test` passed 111 tests (with loopback access for API tests); `npm run typecheck` and production build passed. Playwright passed 14 browser tests after all six changed screenshot baselines were visually inspected. Independent review verified atomic retry caching and found no remaining actionable issue. No paid inference was used.

## Live schema correction

Browser testing on 2026-10-09 reproduced an OpenRouter HTTP 400: strict structured output rejects quoted string enum literals. Durable intention IDs and action-derived observation IDs contain quotes, affecting both planning and later belief proposals. The shared request adapter omits affected enum restrictions while retaining other schema constraints and authoritative runtime reference validation. Regression tests cover intention and speech-evidence IDs, and ordinary capability enums stay constrained.

Live testing also exposed sequential appraisal downgrading action state from schema 8 to 4. Both live and replay appraisal now preserve schemas 6 and 8. A regression verifies post-action sequential cognition, inspection and compact restoration. Full offline suite: 114 passed; typecheck and build passed.

Final live browser check: two OpenRouter turns completed with no errors and a readable Inspector. Marta offered 6 coins; Ivo countered with 10. Both speech and trade-outcome deliveries completed, and the run returned to Ready. This verifies live mechanics, not negotiation quality or a completed deal. Final browser regression suite: 14 passed. [Screenshot](screenshots/live-trade-fixed.jpg).

## Transition inspection

Commit state transition now shares a reusable before/after comparison with Record detail. Cards show changed beliefs/confidence, affect with actual/requested deltas, intention description/status/priority, and action speech/status. Summary chips show revision, memory count and elapsed time; raw transition JSON is collapsed. Narrow layouts stack before/after vertically. Browser regression checks and manual narrow screenshot inspection passed; 15 browser tests and typecheck pass.
