# Self-driven event interpretation

Implement the approved sketch with the corrected provenance boundary. Incoming observations contain only id, time, source, kind and content. Reject processing, provenance and intentionCompletions rather than silently accepting host cognitive instructions. Models interpret evidence from observable content and character-held beliefs. No separate appraisal gate is added: processing the event can legitimately yield no updates.

Elapsed-time advancement becomes a clock observation, with a stable ID, explicit duration in its content and no invented world outcome. Equal-time advancement remains a no-op. Apply decay before cognition; then remember, update beliefs, update emotions, and reconsider intentions. Entire processing remains atomic, including failures after a proposed completion. Script delivery must not first send a redundant clock event to its recipients; its observation time already advances their clock.

Add complete to the Mind's intention revision actions. Only active/suspended strategies can complete, with known evidence including the triggering event. Completion means the Mind believes its strategy is fulfilled; it is not objective success. Jev uses the existing revision probability threshold. Completed strategies remain terminal. If reconsideration requests no more candidates, respect that decision even when all strategies are completed. Do not add host completion controls or certainty requirements.

New processed event state/records use version 6; compact journals use version 7. Preserve old recording versions 1–4 and journals 5 exactly, including their old host completion, memory-only and time-only semantics, in replay only. Mixed histories keep old records unchanged and upgrade on the next live event. Legacy replay helpers must not become public live-input escape hatches.

Update Playbox injection/scenario events, fixture judgments, Inspector labels, examples, tests and CAPABILITIES. Preserve actual model-call inspection and compact-history behavior. No live paid inference is needed for verification.
