# Minds
## Design Document — AI Character Cognition Engine

**Version:** 0.1 — Initial Design  
**Status:** Conceptual architecture  
**Purpose:** Reusable, game-independent library for simulating autonomous AI characters

---

# 1. Overview

**Minds** is a reusable AI character cognition engine designed to power autonomous, psychologically coherent characters in games and interactive simulations.

Rather than treating characters as conversational interfaces backed by language models, Minds treats them as persistent agents with goals, intentions, beliefs, memories, emotions, and the ability to make independent decisions.

Characters operate within external environments, observe events, maintain internal state, pursue their objectives, and adapt their behavior as their circumstances change.

The central architectural principle is to **combine generative AI with structured decision-making**.

- Generative LLMs create intentions, strategies, action candidates, and natural-language expressions.
- Jev-like decision models evaluate candidates, select actions, appraise events, and determine when cognitive changes are warranted.
- A deterministic runtime maintains persistent cognitive state, applies updates, manages lifecycle transitions, and coordinates external interactions.
- The host application owns the world, validates actions, and determines their consequences.

The goal is to minimize hardcoded character behaviors while preserving consistency, testability, and meaningful autonomy.

Minds should become more capable as its underlying AI models improve, without requiring major architectural changes.

# 2. Design Goals

## 2.1 Autonomous agency

Characters independently pursue their goals, generate intentions, select actions, and react to environmental changes.

They do not require the player to initiate every interaction.

They may cooperate, deceive, investigate, negotiate, avoid conflict, change strategies, or take unexpected initiatives.

## 2.2 Persistent identity

A character's cognitive state persists independently of the AI model used to operate it.

Changing an LLM or decision model should not erase the character's memories, established relationships, beliefs, or intentions.

## 2.3 Emergent behavior

Complex behavior should emerge from the interaction of simple cognitive systems rather than from manually scripted behavior trees.

For example, a character might abandon a negotiation after experiencing humiliation, pursue retaliation, subsequently discover that retaliation damaged their reputation, and reconsider their strategy.

The developer should not need to script this sequence.

## 2.4 Minimal domain-specific hardcoding

Minds should not contain concepts such as political elections, commercial negotiations, medieval towns, inventories, or particular game objectives.

Such concepts belong to the host application.

The library should provide general mechanisms for cognition, motivation, affect, memory, and agency.

## 2.5 Model independence

Different cognitive operations can use different AI backends.

The architecture should support replacing Jev with another decision model or implementing all cognition through a general-purpose LLM.

## 2.6 Observability and testability

The runtime must expose enough information to inspect why a character adopted an intention, changed an emotional state, or selected an action.

This is essential for development, debugging, benchmarking, and evaluating psychological coherence.

# 3. Conceptual Model

A Mind consists of several interacting cognitive systems.

| System | Responsibility |
|---|---|
| Identity | Personality, temperament, values, background |
| Motivation | Goals, intentions, priorities, commitment |
| Epistemics | Knowledge, beliefs, uncertainty, inference |
| Memory | Observations, experiences, recollections |
| Affect | Mood, emotional state, event appraisal |
| Agency | Generating and selecting actions |
| Expression | Producing speech and observable behavior |

These systems form an ongoing cognitive loop:

**Observe → Remember → Update beliefs → Update emotions → Reconsider intentions → Select action → Act → Observe**

The systems are logically distinct but mutually influential.

For example:

1. A character observes an ally breaking a promise.
2. The event is stored in memory.
3. The character revises its belief about the ally's reliability.
4. The event produces anger and disappointment.
5. These changes affect the attractiveness of existing intentions.
6. The character may adopt a new intention to find another ally.
7. The character acts on that intention.
8. The consequences produce new observations.

# 4. Character Identity

Identity contains the relatively stable characteristics that influence how a Mind interprets events and makes decisions.

Potential characteristics include:

- Background and personal history
- Personality traits
- Temperament and emotional reactivity
- Values and moral preferences
- Risk tolerance
- Social preferences
- Behavioral tendencies

Minds should not enforce a particular psychological taxonomy.

A host application may describe personality through structured traits, natural language, or an extensible combination of the two.

Personality must influence cognition rather than merely determine a character's tone of speech.

Two characters experiencing the same event may react differently because of differences in temperament, values, beliefs, and goals.

# 5. Goals and Intentions

## 5.1 Goals

A goal describes a desired outcome.

Examples:

- Gain control of the town's river.
- Secure a profitable contract.
- Protect a family member.
- Obtain access to a restricted location.
- Improve one's political standing.

For the initial implementation, a Mind receives a fixed goal from the host application.

The character is responsible for determining how to pursue that goal.

Support for multiple, conflicting, or dynamically generated goals may be introduced later.

## 5.2 Intentions

An intention represents a course of action that the character has committed to pursuing.

Unlike a goal, an intention expresses a strategy or intermediate objective.

**Goal:** Gain control of the town's river.

**Possible intentions:**

- Persuade the mayor to support exclusive water rights.
- Build a coalition of local merchants.
- Negotiate an agreement with farmers.
- Investigate political vulnerabilities of competing factions.
- Develop an alternative technical solution.

A character can maintain multiple intentions simultaneously.

Intentions can reinforce one another, compete for attention, become redundant, or conflict.

The number of active intentions should vary based on the character and circumstances rather than being fixed globally.

# 6. Dynamic Intention Generation

This is one of the central mechanisms of Minds.

Jev-like models require candidate options for structured decision-making. Minds addresses this by using a generative LLM to produce intention candidates dynamically.

**The developer does not define an exhaustive list of possible intentions.**

## 6.1 Initial generation

When a Mind is initialized, it begins with a goal but no active intentions.

The generation process is:

1. The LLM receives the character's goal, identity, beliefs, emotional state, available resources, and relevant world context.
2. It generates a relatively large and diverse set of potential intentions.
3. The candidate list is shuffled.
4. One candidate is selected from the remaining pool.
5. Jev evaluates whether the candidate should be adopted.
6. If accepted, the intention is added to the active set.
7. Jev evaluates whether the character needs additional intentions.
8. If additional intentions are needed, the process repeats.

The generation prompt should encourage diversity, including unconventional and initially far-fetched strategies.

An unusual strategy may prove appropriate to a particular character or situation.

## 6.2 Candidate evaluation

Candidate acceptance must be evaluated in the context of the entire current intention set.

A candidate may independently be sensible but offer little additional value because it duplicates an existing intention.

Relevant evaluation factors include:

- Goal alignment
- Feasibility based on the character's beliefs
- Compatibility with personality and values
- Compatibility with current emotional state
- Redundancy with existing intentions
- Conflicts with existing intentions
- Resources and capabilities available
- Expected strategic value

The central decision is:

**Does adopting this candidate meaningfully improve or alter the character's current approach to its goal?**

## 6.3 Stopping condition

After each accepted intention, Jev evaluates whether the character has enough intentions.

This allows the number of active intentions to emerge from decision-making.

A focused character might maintain two intentions. A highly ambitious or impulsive character might maintain many more.

The runtime should nevertheless enforce operational safeguards, including:

- Maximum candidate evaluations
- Maximum active intentions
- Detection of duplicate candidates
- Termination when the candidate pool is exhausted
- Optional regeneration of candidates when diversity or coverage is insufficient

These limits prevent infinite loops and uncontrolled inference costs without defining the character's actual strategies.

## 6.4 Order dependence

Random candidate ordering introduces behavioral variety but creates potential order bias.

An early accepted candidate may prevent a later, superior candidate from being considered.

For the prototype, this is acceptable as a source of bounded variation, but it should be observable and testable.

Future versions may use multiple candidate pools, comparison rounds, or periodic strategic reconsideration to reduce undesirable order dependence.

# 7. Intention Lifecycle

Intentions are persistent cognitive objects, not disposable text strings.

Each intention should have:

- Unique identifier
- Description
- Status
- Priority
- Supporting goal
- Supporting beliefs
- Creation timestamp
- Last reconsideration timestamp
- Optional originating event
- Optional history of revisions

## 7.1 Lifecycle states

| State | Meaning |
|---|---|
| Active | Currently being pursued |
| Suspended | Temporarily deprioritized |
| Completed | Desired intermediate outcome achieved |
| Abandoned | Character no longer intends to pursue it |

A character should not regenerate its entire strategy at every opportunity.

Intentions persist until an event or internal change gives sufficient reason to reconsider them.

## 7.2 Reconsideration

When an event is observed, the runtime asks Jev whether intentions require updating.

Rather than using only a binary decision, the system may support several revision types:

- **Keep:** Preserve the existing intention set.
- **Reprioritize:** Change the relative importance of intentions.
- **Revise:** Modify an existing intention.
- **Suspend or retire:** Stop pursuing an intention.
- **Generate:** Request new intention candidates from the LLM.

Major events may trigger several revisions.

Examples of triggers:

- A strategy succeeds or fails.
- An important belief changes.
- A relationship deteriorates.
- A new opportunity becomes available.
- The character loses access to necessary resources.
- An emotional response significantly changes motivation.
- Continued effort fails to produce progress.

Reconsideration should also be possible without a new external event, for example after repeated frustration or during periodic reflection.

### Implemented completion policy

The host decides whether an intermediate strategy succeeded and supplies `Observation.intentionCompletions` with unique active or suspended intention IDs. The runtime validates the IDs and completes those intentions before cognition, preserving identity, goal, description, priority and origin while setting the change time and evidence to the confirming observation. The event commits atomically with its appraisal and planning; memory-only confirmation performs no inference. Models cannot issue completion revisions or revive completed/abandoned identities. Completion does not imply the assigned goal is finished. New strategies may reuse a terminal strategy's wording under a fresh identity.

Native recordings upgrade from version 2 to version 3 on the first confirmation, retain earlier records, and replay host confirmations alongside model judgments. Old version 1/2 recordings remain unchanged and restorable. Playbox observation injection validates IDs on the serialized latest state before recording an intervention; Inspector links completed strategies to their evidence and history. See [implementation evidence](docs/implementation/host-completion.md).

# 8. Emotional System

Emotions are integral to the character's decision-making.

They should influence:

- Which intentions are adopted
- Which intentions are abandoned
- How priorities change
- Which actions are selected
- Willingness to take risks
- Treatment of other characters
- Speech acts and natural-language expression

Emotions must affect behavior, not merely change the tone of generated dialogue.

## 8.1 Emotional architecture

The proposed emotional system has three layers.

**Temperament**

Relatively stable emotional characteristics derived from identity and personality.

Examples include emotional reactivity, sensitivity to perceived threats, optimism, and emotional persistence.

**Mood**

A broader emotional condition that evolves comparatively slowly.

An initial representation may use:

- Valence: pleasant versus unpleasant affect
- Arousal: activation or intensity
- Dominance: perceived control

**Event-driven emotions**

Specific emotional responses such as:

- Anger
- Fear
- Anxiety
- Joy
- Shame
- Pride
- Hope
- Disappointment
- Jealousy

These are illustrative dimensions, not a mandatory or exhaustive psychological taxonomy.

## 8.2 Initial emotional state

At initialization, the system derives an emotional baseline from the character's temperament and circumstances.

Jev-like scoring decisions may be used to estimate individual emotional dimensions from the character description.

Because Jev selects or scores supplied options rather than generating arbitrary structured objects, initial emotional state construction is coordinated by the runtime.

The emotional state is stored persistently.

## 8.3 Emotional appraisal

Every meaningful observed event can trigger emotional appraisal.

The character evaluates what the event means from its own perspective.

Possible appraisal dimensions include:

- Relevance to current goals
- Perceived threat
- Perceived opportunity
- Responsibility or blame
- Unexpectedness
- Degree of personal control
- Social or reputational significance

For example, a farmer publicly insulting a merchant may be appraised as a significant threat to social status.

The resulting emotion depends on the merchant's temperament, prior beliefs, social context, and existing emotional state.

Another character could react to the same event with amusement or indifference.

## 8.4 Incremental emotional updates

The system should not regenerate emotional state from scratch after every event.

Instead, Jev evaluates the event's emotional significance, and the runtime updates the persistent emotional state.

A conceptual update model is:

**New emotion = baseline + retained prior emotion + event-induced change**

The runtime applies bounded numerical updates and time-based decay.

Emotion persistence and recovery can vary between characters.

This prevents abrupt, unexplained emotional discontinuities.

## 8.5 Emotions and motivation

Emotional state participates directly in intention evaluation.

For example:

A merchant initially intends to negotiate with a farmer.

After experiencing a public humiliation, anger increases and the character may consider retaliatory intentions.

The character could:

- Continue negotiation despite anger.
- Suspend negotiation temporarily.
- Attempt to undermine the farmer's credibility.
- Avoid the farmer.
- Pursue reconciliation.

The outcome is not hardcoded.

Emotion changes the relative attractiveness of candidate intentions and actions.

A disciplined character may resist retaliation. An impulsive character may prioritize it despite the damage to their original goal.

The system should permit irrational, self-defeating, and emotionally driven behavior.

# 9. Beliefs and Subjective Reality

Minds must distinguish the objective state of the world from what a character believes about it.

This distinction is essential for deception, gossip, misunderstandings, persuasion, and learning.

Three categories should remain separate:

**World facts**

What is actually true according to the host simulation.

**Observations**

What the character has personally perceived or been told.

**Beliefs**

The character's current interpretation of the world, including uncertainty and potentially false conclusions.

Example:

- World fact: The mayor accepted a bribe.
- Observation: The character saw the mayor meet a merchant privately.
- Belief: The character suspects the mayor is corrupt.

The character should not gain access to the actual bribery merely because the world simulation knows about it.

Beliefs may influence emotional appraisals and decision-making.

New evidence can strengthen, weaken, or overturn existing beliefs.

The initial implementation may keep belief revision simple, while preserving the architectural distinction between perception and truth.

# 10. Memory

Memory preserves the character's experiences and provides context for future cognition.

## 10.1 Episodic memory

Stores meaningful observed events, including:

- Interactions with other characters
- Important statements
- Promises and betrayals
- Personal successes and failures
- Significant discoveries
- Emotional experiences
- Consequences of previous actions

## 10.2 Derived knowledge

The character may develop generalized beliefs from accumulated experiences.

For example:

After several unsuccessful conversations with the mayor, the character may conclude that the mayor is unwilling to negotiate directly.

This inferred belief is different from the underlying observations.

## 10.3 Memory retrieval

Cognitive operations should receive relevant memories rather than the entire event history.

Retrieval can consider recency, importance, emotional significance, relationships, and relevance to current goals or intentions.

Memory selection can evolve as better retrieval or reasoning models become available.

## 10.4 Persistence and provenance

Memories must record where information came from.

The runtime should distinguish:

- Directly witnessed events
- Statements made by others
- Character interpretations
- Recollections and summaries

Memory ingestion should also be idempotent to avoid processing the same event repeatedly.

# 11. Agency and Action Selection

Goals and intentions do not directly alter the world.

Characters must choose and execute concrete actions.

Minds separates:

**Goal → Intention → Action → World consequence**

For example:

- Goal: Gain control of the river.
- Intention: Persuade the mayor to support exclusive water rights.
- Action: Arrange a private meeting.
- Speech act: Present an economic argument.
- World consequence: The mayor's beliefs or political position may change.

## 11.1 Generating action candidates

The LLM proposes concrete actions based on:

- Active intentions
- Current beliefs
- Emotional state
- Relevant memories
- Available world capabilities
- Immediate circumstances

Jev evaluates and selects among the proposed actions.

## 11.2 Generic action capabilities

To avoid hardcoding game-specific behavior, the host application exposes composable world capabilities.

An initial capability set might include:

- Communicate
- Move
- Inspect
- Interact
- Transfer
- Wait

The exact vocabulary is a host/application contract, not a universal list that every game must support.

Complex behavior emerges from sequences of simpler operations.

For example, organizing a boycott does not require a dedicated `organizeBoycott` game mechanic.

A character might pursue that intention through conversations, meetings, offers, and commitments.

The host world determines whether other characters actually agree and whether the boycott takes effect.

## 11.3 World authority

Minds may propose actions but must not directly invent their results.

The host application is responsible for:

- Checking preconditions
- Validating action parameters
- Executing actions
- Updating world state
- Determining consequences
- Publishing resulting observations

An AI character cannot declare that a negotiation succeeded simply because it intended to succeed.

# 12. Speech Acts and Natural Language

Speech is treated as a form of action rather than an isolated chatbot interaction.

A character may intend to:

- Inform
- Persuade
- Ask
- Threaten
- Promise
- Conceal
- Reassure
- Accuse
- Negotiate
- Refuse

These categories are illustrative and should remain extensible.

A decision model can help choose a speech act or communication objective.

A generative LLM then expresses the selected act in natural language.

The output should reflect the character's identity, emotional state, beliefs, social relationship with the listener, and intended outcome.

For example, the same intention to request cooperation may produce radically different language when the character feels confident, anxious, angry, or ashamed.

The distinction between **communicative intention** and **spoken wording** is important for consistent agent behavior and independent model upgrades.

# 13. Event Processing Lifecycle

The following lifecycle describes how a Mind responds to an observed world event.

## Step 1 — Receive observation

The host simulation provides an event that the character is permitted to observe.

The event may represent speech, an action, a discovered fact, or a change in the environment.

## Step 2 — Store memory

The observation is recorded with appropriate provenance.

## Step 3 — Update beliefs

The character revises its understanding of the world when warranted.

## Step 4 — Appraise the event

Jev evaluates the emotional relevance of the event using the updated beliefs and current cognitive state.

## Step 5 — Update emotional state

The runtime applies event-induced emotional changes and appropriate temporal dynamics.

## Step 6 — Reconsider intentions

Jev evaluates whether the existing intention set remains appropriate.

Possible results include keeping, reprioritizing, revising, retiring, or generating intentions.

## Step 7 — Generate action candidates

When the character has an opportunity or reason to act, the LLM generates candidate actions.

## Step 8 — Select action

Jev selects an action based on the current cognitive state.

## Step 9 — Execute through the host

The action is submitted to the world simulation for validation and execution.

## Step 10 — Process consequences

The world produces resulting events.

Those events may become observations for the acting character and for other Minds.

The cycle repeats.

These steps describe logical dependencies, not a requirement that every event invoke every model. Trivial observations may require only memory storage, and actions may occur on a separate scheduling cycle.

### Implemented sequential appraisal policy

Live Playbox separates belief interpretation from emotional appraisal. Luna proposes a bounded set of sourced belief statements; Jev independently evaluates whether to adopt each update and the character's subjective confidence. Acceptance defaults to probability 0.65, with at most 16 proposals (configurable up to 32). Accepted upserts apply before the next Jev request, which therefore sees revised beliefs and existing time-decayed affect. Empty proposal pools skip the belief judgment call.

Emotional appraisal scores each host-defined mood/emotion dimension with nine signed ordinal levels centered at 4. Expected score maps to `(score - 4) / 4 * limit`; default maximum event deltas are 0.1 for mood and 0.3 for emotions. This is a recorded policy heuristic, with unchanged affect represented explicitly by the middle level. Existing affect bounds still apply. Relationships and calibrated behavioral claims are outside this increment.

The optional staged provider contract preserves legacy combined appraisal. Belief update, emotional update, completion and intention planning all operate on detached state and commit atomically. Native schema 4 records each appraisal stage's actual context/result and supplemental proposal calls. Replay follows the same order without inference, including mixed histories from versions 1–3, and validates the complete causal trace. See [implementation evidence](docs/implementation/split-appraisal.md).

# 14. AI Model Architecture

Minds should use replaceable providers rather than depend directly on any specific AI service.

## 14.1 Generative model

Responsible for tasks requiring open-ended creation:

- Intention generation
- Strategic alternatives
- Action proposals
- Natural-language dialogue
- Narrative interpretation when required

## 14.2 Decision model

Responsible for structured evaluation:

- Candidate intention acceptance
- Intention-set sufficiency
- Reconsideration decisions
- Action selection
- Emotional appraisal
- Other bounded classifications or scores

A Jev-like model is the initial target.

## 14.3 Cognition provider abstraction

The library exposes a model-independent cognition interface.

Conceptual operations include:

- `generateIntentions(context)`
- `evaluateIntention(context, candidate)`
- `needMoreIntentions(context)`
- `evaluateIntentRevision(context)`
- `appraiseEvent(context, event)`
- `generateActions(context)`
- `selectAction(context, candidates)`
- `generateSpeech(context, speechAct)`

The interface may be implemented through a hybrid LLM/Jev configuration or through another model architecture.

## 14.4 Model replacement

All durable cognitive state must be owned by Minds, not by a model's conversation history.

Model switching should preserve state.

Differences in model behavior are expected and should be evaluated rather than assumed to be improvements.

## 14.5 Inference efficiency

To control latency and cost:

- Use expensive generative planning sparingly.
- Prefer cheap structured decisions for frequent operations.
- Preserve intentions and plans between events.
- Avoid unnecessary full-state reevaluation.
- Batch independent evaluations when supported.
- Retrieve only relevant memories.
- Support asynchronous scheduling of NPC actions within the host application's simulation loop.

The runtime should not require every character to invoke a large generative model on every simulation tick.

# 15. Persistence and Observability

Each Mind must retain a durable, inspectable cognitive state.

At minimum:

- Identity and configuration
- Assigned goal
- Active and historical intentions
- Beliefs
- Emotional state
- Memories
- Relevant relationships
- Previous decisions
- Cognitive revision history

Significant state changes should be logged.

An example diagnostic timeline:

1. **09:00** — Edmund intends to negotiate with Marta.
2. **09:15** — Marta publicly insults Edmund.
3. **09:15** — Event stored in episodic memory.
4. **09:15** — Anger increases; perceived trustworthiness of Marta decreases.
5. **09:16** — Jev recommends strategic reconsideration.
6. **09:16** — Existing negotiation intention suspended.
7. **09:16** — New retaliatory intention adopted.
8. **10:30** — Retaliatory action damages Edmund's relationship with the mayor.
9. **10:31** — Anxiety increases as Edmund perceives a threat to his primary goal.
10. **10:32** — Intention set reconsidered again.

The development tooling should make these transitions visible.

Ideally, an engineer can inspect the exact candidate set, model inputs, selected output, and resulting state transition for every important decision.

For reproducibility, log model versions, candidate ordering, random seeds, and relevant inference parameters where available.

# 16. Intended Applications

Minds is designed as an independent library shared by multiple games.

## Counterplay

Characters act as negotiating opponents.

They have reservation points, incentives, beliefs, emotional reactions, and persistent intentions.

Their behavior changes in response to the player's negotiation tactics.

## The Council

Characters act as autonomous participants in a political community.

They negotiate, cooperate, compete, spread information, form coalitions, and pursue political objectives.

## Social Quest

Characters inhabit an interactive social environment with backstories, secrets, artifacts, relationships, and individual objectives.

Their interactions create emergent opportunities for the player.

The same Mind implementation should operate in all three applications, using different world capabilities and character configurations.

# 17. Prototype Scope

The first prototype should validate autonomous psychological behavior, not visual presentation.

## 17.1 Environment

A minimal headless simulation containing:

- Two or three characters
- Conflicting or partially conflicting goals
- A few relevant world facts
- Basic communication capabilities
- An event scheduler
- Persistent cognitive state

## 17.2 Required functionality

The prototype should demonstrate:

1. Character initialization from an identity and goal.
2. Generation of a diverse intention candidate pool.
3. Incremental intention acceptance using Jev.
4. Jev-controlled stopping conditions.
5. Persistence of active intentions.
6. Reception and memorization of observations.
7. Emotional initialization and incremental updates.
8. Belief revision based on observations.
9. Event-driven intention reconsideration.
10. Generation and selection of actions.
11. Natural-language communication influenced by internal state.
12. A complete inspectable timeline of cognitive transitions.

## 17.3 Validation scenario

A useful initial experiment involves two politically opposed characters.

Character A wants exclusive control over a resource.

Character B wants the resource to remain publicly accessible.

Both begin with different beliefs, personalities, and emotional temperaments.

The simulation runs for multiple turns without direct player intervention.

We then inspect whether:

- Their strategies differ meaningfully.
- They pursue intentions consistently.
- They react to each other's behavior.
- Their emotional states evolve coherently.
- They revise beliefs in response to evidence.
- They reconsider intentions when circumstances change.
- Their behavior remains compatible with what they know.
- Their chosen actions produce observable consequences.
- Interesting social dynamics emerge without scripted sequences.

# 18. Principal Technical Risks

## 18.1 Candidate-generation bottleneck

Jev cannot select an intention that the generative model never proposed.

Mitigations include diverse candidate generation, regeneration, retaining historical strategies, and strategic reconsideration.

## 18.2 Inconsistent beliefs

LLMs may confuse objective world facts with character-specific knowledge.

The runtime should enforce information boundaries and explicitly separate facts, observations, and beliefs.

## 18.3 Emotional instability

Repeated AI-generated emotional estimates may fluctuate unrealistically.

Persistent numerical state, bounded updates, temperament-informed responses, and decay should improve continuity.

## 18.4 Intention proliferation

Characters may accumulate redundant, incompatible, or obsolete intentions.

Candidate evaluation and lifecycle management must prevent uncontrolled growth.

## 18.5 Decision-model limitations

Structured model outputs are judgments conditioned on their inputs and candidate descriptions.

They should not be interpreted as objective measures of strategic correctness or psychological truth.

## 18.6 Behavioral incoherence

Individually plausible decisions may produce an incoherent character over time.

Long-running simulations, temporal consistency tests, and inspection of complete behavioral histories are required.

## 18.7 Performance and cost

Multiple autonomous characters can generate substantial inference workloads.

Planning frequency, decision scheduling, caching, model selection, and memory retrieval will be important optimization areas.

# 19. Open Design Questions

The following decisions remain unresolved.

**1. Emotional ontology**

Should Minds use a small fixed emotional vocabulary, a dynamically extensible set of emotions, or a hybrid representation?

**2. Belief representation**

Should beliefs be structured propositions with confidence levels, natural-language assertions, or both?

**3. Intentional commitment**

How strongly should a character resist abandoning established intentions? Should persistence depend on personality, sunk costs, and emotional attachment?

**4. Cognitive scheduling**

Should reconsideration happen after every significant event, periodically, when triggered by internal thresholds, or through a combination?

**5. Relationships**

Should relationships be stored within each Mind, or represented through an independent social graph accessible to multiple agents? The former captures subjective relationships; the latter could manage externally observable social connections.

**6. Strategic memory**

Should previously successful intentions be stored in a reusable strategy library that can supply future candidates?

**7. Mental-state extensibility**

How much cognitive structure should Minds define explicitly, and how much should be generated and maintained by AI?

**8. Action granularity**

What is the smallest set of generic actions that permits rich behavior without forcing game-specific mechanics into the core library?

**9. Decision stochasticity**

When should the runtime sample from model-generated scores or distributions, and when should it select the highest-ranked candidate deterministically?

**10. Evaluation**

How can we measure autonomy, adaptability, consistency, and behavioral diversity without conflating plausible storytelling with genuine state-driven cognition?

# 20. Long-Term Vision

Minds should evolve into a general-purpose runtime for persistent artificial characters.

An AI character created today should be capable of:

- Existing across different environments.
- Accumulating experiences.
- Developing and revising beliefs.
- Forming and abandoning intentions.
- Responding emotionally to events.
- Learning about other characters.
- Adapting strategies after successes and failures.
- Maintaining a recognizable identity across long periods.
- Benefiting from improved AI models without losing its history.

The library should not prescribe stories or behavioral outcomes.

Its responsibility is to maintain the cognitive conditions from which those outcomes emerge.

**The ultimate objective is not to make AI characters sound human. It is to create autonomous characters whose actions arise coherently from what they want, what they believe, what they remember, and how they feel.**

---

# 21. Core Design Principles — Summary

1. **Goals are assigned; intentions are generated.** A character determines how to pursue its objectives.

2. **Generative AI proposes; decision AI evaluates.** Open-ended creativity and structured judgment are distinct responsibilities.

3. **Intentions persist.** Characters maintain commitments instead of regenerating their strategies after every interaction.

4. **Experience changes cognition.** Observations update memory, beliefs, emotions, and potentially intentions.

5. **Emotions affect decisions.** Emotional state is part of the motivational system, not merely a dialogue modifier.

6. **Characters have subjective realities.** Each Mind acts according to its own knowledge and beliefs, which may be incomplete or incorrect.

7. **The world remains authoritative.** Minds proposes actions; the host simulation validates and executes them.

8. **Cognition is portable.** Character state and mental mechanisms are independent of the game environment and AI provider.

9. **Behavior should emerge, not be scripted.** The engine supplies cognitive mechanisms rather than predetermined strategies and reactions.

10. **Everything important should be observable.** Internal state transitions and AI decisions must be inspectable and testable.

---

**Document status:** This captures the current Minds design direction. It is a conceptual specification, not yet a finalized implementation contract. In particular, the exact emotional ontology, belief schema, cognition provider API, and event scheduling semantics remain open for prototyping and empirical evaluation.

# 22. Selected persistent-intention policy — 2026-10-08

The [persistent-intention specification](docs/superpowers/specs/2026-10-08-persistent-intentions-design.md) fixes the first implemented commitment policy. Planning is opt-in. Appraised evidence updates beliefs/affect before reconsideration; omitted revisions preserve commitments. Material revisions require the triggering memory. Supported lifecycle states are active, suspended and abandoned; completion awaits a host-authoritative outcome contract.

Generative proposals and evaluation/reconsideration/sufficiency are separate provider operations. A seeded Fisher–Yates shuffle (uint32 LCG) makes candidate order inspectable. Exact normalized-description duplicates are runtime-rejected; semantic duplication/conflict judgments belong to providers. Default limits are six proposals, six evaluations and three active intentions with seed 42. Stop on provider sufficiency, pool exhaustion, evaluation limit, active limit or preserved commitment. Each observation commits appraisal and planning atomically.

Version-2 native recordings replay validated planning outputs through the same deterministic policies; version-1 appraisal-only recordings remain compatible. The Playbox retains its single-Mind subjective-turn flow and exposes intentions, candidate judgments, stopping reasons and historical revisions through the reusable Inspector. OpenRouter supports separate generative chat and Jev planning judgments. Jev probabilities use recorded thresholds (default 0.65); five-level expected ordinal scores normalize by four. Jev selects lifecycle changes, with generative wording proposals and a second Jev check only when revision is requested. Runtime bounds and zero-active generation fallback remain authoritative. See [persistent-intention evidence](docs/implementation/persistent-intentions.md) and [Jev implementation evidence](docs/implementation/jev.md) for verified scope.
