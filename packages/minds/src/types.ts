export type SimulationTime = number;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface Belief { id: string; statement: string; confidence: number; evidenceIds: string[] }
export interface AffectDimension { baseline: number; value: number; halfLifeMs: number }
export interface MindConfig {
  runId: string; mindId: string; identity: { name: string; description: string };
  goal: string; time: SimulationTime; beliefs: Belief[];
  mood: Record<string, AffectDimension>; emotions: Record<string, AffectDimension>;
  intentionPolicy?: IntentionPolicy;
}
export interface Observation {
  id: string; time: SimulationTime; source: string; kind: string; content: string;
}
/** Historical recording data only. Live ingest rejects these controls. */
export interface LegacyObservation extends Observation {
  provenance: 'witnessed' | 'reported'; processing: 'appraise' | 'memoryOnly';
  intentionCompletions?: string[];
}
export type RecordedObservation = Observation | LegacyObservation;
export interface Memory { id: string; observation: RecordedObservation }
export interface MindSnapshot {
  schemaVersion: 1 | 2 | 3 | 4 | 6 | 8; revision: number; config: MindConfig; time: SimulationTime;
  beliefs: Belief[]; mood: Record<string, AffectDimension>;
  emotions: Record<string, AffectDimension>; memories: Memory[];
  intentions?: Intention[]; actions?: MindAction[];
}
export interface CognitionContext { mind: MindSnapshot; observation: Observation; memories: Memory[] }
export interface CognitionProposal {
  beliefRetirements?: BeliefRetirement[];
  beliefUpdates: Belief[]; moodDeltas: Record<string, number>; emotionDeltas: Record<string, number>;
  metadata: { provider: string; model: string | null; explanation: string | null; parameters: Record<string, JsonValue> };
}
export interface BeliefRetirement { id: string; evidenceIds: string[]; supersededBy: string | null }
export interface BeliefUpdateResult { beliefUpdates: Belief[]; beliefRetirements?: BeliefRetirement[]; metadata: ProviderMetadata }
export interface EmotionalAppraisalResult { moodDeltas: Record<string, number>; emotionDeltas: Record<string, number>; metadata: ProviderMetadata }
export interface AppraisalStages {
  updateBeliefs(context: CognitionContext): Promise<BeliefUpdateResult>;
  appraiseEmotions(context: CognitionContext): Promise<EmotionalAppraisalResult>;
}
export interface AppraisalCall { stage: 'belief-update' | 'emotional-appraisal'; input: CognitionContext; result: BeliefUpdateResult | EmotionalAppraisalResult }
export interface CognitionProvider { appraise(context: CognitionContext): Promise<CognitionProposal>; stages?: AppraisalStages; intentions?: IntentionProvider; actions?: ActionProvider }
export interface InspectionRecord {
  schemaVersion: 1 | 2 | 3 | 4 | 6 | 8; id: string; runId: string; mindId: string; sequence: number;
  revision: number; time: SimulationTime;
  type: 'initialized' | 'observation' | 'memory' | 'decision' | 'transition';
  observationId: string | null; causeIds: string[]; payload: JsonValue;
}
export interface IngestResult { duplicate: boolean; snapshot: MindSnapshot; records: InspectionRecord[] }
export interface MindRecording { schemaVersion: 1 | 2 | 3 | 4 | 6 | 8; snapshot: MindSnapshot; records: InspectionRecord[]; processedObservationIds: string[] }
export type JournalOperation = { kind: 'time'; time: number } | { kind: 'observation'; observation: RecordedObservation;
  proposal?: CognitionProposal; appraisalCalls?: Omit<AppraisalCall, 'input'>[]; intentionCalls?: Omit<IntentionCall, 'input'>[] } | ActionPlanOperation | ActionStatusOperation;
export interface CompactMindRecording { schemaVersion: 5 | 7 | 9; config: MindConfig; operations: JournalOperation[] }
export interface MindRuntime {
  planAction(opportunity: ActionOpportunity): Promise<PlanActionResult>;
  submitAction(actionId: string): Promise<IngestResult>;
  resolveAction(receipt: { actionId: string; status: 'executed' | 'rejected'; reason: string | null }): Promise<IngestResult>;
  ingest(observation: Observation): Promise<IngestResult>;
  advanceTime(time: SimulationTime): Promise<IngestResult>;
  getSnapshot(): MindSnapshot;
  getRecordCount(): number;
  getRecordDurations(): Record<string, number>;
  getRecords(afterSequence?: number): InspectionRecord[];
  subscribe(listener: (records: InspectionRecord[]) => void): () => void;
  exportRecording(): MindRecording;
  exportCompactRecording(): CompactMindRecording;
}

export interface IntentionPolicy { maxCandidates: number; maxEvaluations: number; maxActive: number; seed: number }
export interface IntentionCandidate { id: string; description: string; priority: number; supportingBeliefIds: string[] }
export interface Intention {
  id: string; description: string; status: 'active' | 'suspended' | 'completed' | 'abandoned'; priority: number;
  goal: string; supportingBeliefIds: string[]; createdAt: SimulationTime; reconsideredAt: SimulationTime;
  originObservationId: string; evidenceIds: string[];
}
export type ProviderMetadata = CognitionProposal['metadata'];
export interface IntentionRevision {
  intentionId: string; action: 'keep' | 'reprioritize' | 'revise' | 'suspend' | 'abandon' | 'reactivate' | 'complete';
  description?: string; priority?: number; supportingBeliefIds?: string[]; evidenceIds: string[];
}
export interface ReconsiderationResult { revisions: IntentionRevision[]; generateMore: boolean; metadata: ProviderMetadata }
export interface GenerationResult { candidates: IntentionCandidate[]; metadata: ProviderMetadata }
export interface IntentionEvaluation {
  accept: boolean;
  scores: { goalAlignment: number; feasibility: number; emotionalCompatibility: number; novelty: number; compatibility: number };
  metadata: ProviderMetadata;
}
export interface SufficiencyResult { sufficient: boolean; metadata: ProviderMetadata }
export interface GenerationContext extends CognitionContext { limits: IntentionPolicy }
export interface EvaluationContext extends CognitionContext { candidate: IntentionCandidate; activeIntentions: Intention[] }
export interface SufficiencyContext extends CognitionContext { activeIntentions: Intention[] }
export interface IntentionProvider {
  reconsider(context: CognitionContext): Promise<ReconsiderationResult>;
  generate(context: GenerationContext): Promise<GenerationResult>;
  evaluate(context: EvaluationContext): Promise<IntentionEvaluation>;
  sufficient(context: SufficiencyContext): Promise<SufficiencyResult>;
}
export type IntentionStage = 'intention-reconsideration' | 'intention-generation' | 'intention-evaluation' | 'intention-sufficiency';
export interface IntentionCall { stage: IntentionStage; input: CognitionContext | GenerationContext | EvaluationContext | SufficiencyContext; result: ReconsiderationResult | GenerationResult | IntentionEvaluation | SufficiencyResult }
export interface IntentionCycle {
  calls: IntentionCall[]; seed: number; candidateOrder: string[];
  evaluations: { candidateId: string; accepted: boolean; reason: 'accepted' | 'provider-rejected' | 'duplicate'; activeIntentionIds: string[] }[];
  acceptedIntentionIds: string[];
  stoppingReason: 'commitment-preserved' | 'sufficient' | 'pool-exhausted' | 'evaluation-limit' | 'active-limit';
}

export interface ActionParameter { name: string; type: 'string' | 'number'; description: string; enum?: string[]; min?: number; max?: number }
export interface ActionCapability { id: string; description: string; targets: string[]; parameters: ActionParameter[]; expression: 'speech' | 'none' }
export interface ActionOpportunity { id: string; time: SimulationTime; capabilities: ActionCapability[] }
export interface ActionCandidate { id: string; capabilityId: string; targetId: string | null; intentionId: string | null; objective: string; parameters: Record<string, string | number> }
export interface ActionContext { mind: MindSnapshot; memories: Memory[]; opportunity: ActionOpportunity }
export interface ActionSelectionContext extends ActionContext { candidates: ActionCandidate[] }
export interface ActionExpressionContext extends ActionContext { candidate: ActionCandidate }
export interface ActionGenerationResult { candidates: ActionCandidate[]; metadata: ProviderMetadata }
export interface ActionSelectionResult { candidateId: string | null; scores: { candidateId: string; score: number }[]; metadata: ProviderMetadata }
export interface ActionExpressionResult { speech: string; metadata: ProviderMetadata }
export interface ActionProvider {
  generate(context: ActionContext): Promise<ActionGenerationResult>;
  select(context: ActionSelectionContext): Promise<ActionSelectionResult>;
  express(context: ActionExpressionContext): Promise<ActionExpressionResult>;
}
export interface MindAction { id: string; opportunityId: string; candidate: ActionCandidate; expression: string | null; status: 'proposed' | 'submitted' | 'executed' | 'rejected'; reason: string | null }
export interface PlanActionResult extends IngestResult { action: MindAction | null }
export interface ActionPlanOperation { kind: 'action-plan'; opportunity: ActionOpportunity; generation: ActionGenerationResult; selection: ActionSelectionResult; expression?: ActionExpressionResult }
export interface ActionStatusOperation { kind: 'action-status'; actionId: string; status: 'submitted' | 'executed' | 'rejected'; reason: string | null }

