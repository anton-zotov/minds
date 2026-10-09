import { duration } from './duration.js';
import { isActionStage, actionStageName, ActionCallView } from './ActionPanels.js';
import { TransitionView, type TransitionPayload } from './TransitionView.js';
import { sequenceSummary } from './sequenceSummary.js';
import type { InspectionRecord, CognitionContext, CognitionProposal, Observation, IntentionCall, IntentionCycle, AppraisalCall } from '@minds/core';
import { isAppraisalStage, appraisalStageName, AppraisalView } from './AppraisalView.js';
import { PlanningCallView, IntentionCycleView, intentionStageName, planningProviderCalls } from './IntentionPanels.js';
function Json({ value }: { value: unknown }) { return <pre>{JSON.stringify(value, null, 2).split('\n').map((line, index) => <span className="mi-json-line" data-run-id={line.includes('"runId":') ? true : undefined} key={index}>{line}{'\n'}</span>)}</pre>; }
export function DecisionSequence({ durations, records, failed }: { durations?: Record<string, number> | undefined; records: InspectionRecord[]; failed: boolean }) {
  const decisions = records.filter(r => r.type === 'decision');
  const appraisals = decisions.filter(r => !(r.payload as { stage?: string }).stage || isAppraisalStage((r.payload as { stage?: string }).stage));
  const staged = appraisals.filter(r => isAppraisalStage((r.payload as { stage?: string }).stage));
  const appraisalCount = appraisals.length - staged.length + planningProviderCalls(staged.map(r => r.payload as unknown as AppraisalCall));
  const planningCalls = decisions.filter(r => (r.payload as { stage?: string }).stage && !isAppraisalStage((r.payload as { stage?: string }).stage) && !isActionStage((r.payload as { stage?: string }).stage) && (r.payload as { stage?: string }).stage !== 'intention-summary');
  return <section className="mi-panel mi-decision-sequence" aria-label="Decision sequence" data-testid="decision-sequence">
    <div className="mi-panel-title"><h3>Under the hood · decision sequence</h3><span>{appraisalCount} appraisal{staged.length ? ' calls' : ''} · {planningProviderCalls(planningCalls.map(r => r.payload as unknown as IntentionCall))} planning calls</span></div>
    {records.map((r, index) => {
      const stage = (r.payload as { stage?: string } | null)?.stage;
      const appraisal = r.type === 'decision' && isAppraisalStage(stage) ? r.payload as unknown as AppraisalCall : null;
      const planning = r.type === 'decision' && stage && !appraisal && !isActionStage(stage) && stage !== 'intention-summary' ? r.payload as unknown as IntentionCall : null;
      const cycle = stage === 'intention-summary' ? (r.payload as unknown as { cycle: IntentionCycle }).cycle : null;
      const decision = r.type === 'decision' && !stage ? r.payload as unknown as { context: CognitionContext; proposal: CognitionProposal; retrievedMemoryIds: string[] } : null;
      const observation = r.type === 'observation' ? r.payload as unknown as Observation & { provenance?: string; processing?: string; intentionCompletions?: string[] } : null;
      const title = isActionStage(stage) ? actionStageName(stage!) : appraisal ? appraisalStageName(appraisal.stage) : stage ? intentionStageName(stage) : r.type === 'initialized' ? 'Initialize Mind' : r.type === 'observation' ? 'Receive observation' : r.type === 'memory' ? 'Store memory' : r.type === 'decision' ? 'Appraise observation' : 'Commit state transition';
      const actionMetadata = isActionStage(stage) ? (r.payload as unknown as { result?: { metadata?: CognitionProposal['metadata'] } }).result?.metadata : undefined;
      const metadata = actionMetadata ?? appraisal?.result.metadata ?? planning?.result.metadata ?? decision?.proposal.metadata;
      const actor = metadata ? `${metadata.provider} · ${metadata.model ?? 'no LLM (fixture)'}` : 'Deterministic runtime · no LLM';
      const brief=sequenceSummary(r);
      return <details className="mi-sequence-step" key={r.id} open={!!decision || !!cycle}><summary><span className="mi-step-number">{index + 1}</span><span className="mi-step-heading"><strong>{title}</strong><span className="mi-step-brief" title={brief}>{brief}</span></span><span className="mi-step-actor">{actor}</span><small data-duration>{duration(durations?.[r.id])} · record #{r.sequence}</small></summary>
        {isActionStage(stage) ? <ActionCallView payload={r.payload} /> : cycle ? <IntentionCycleView cycle={cycle} /> : planning || appraisal ? <>
          {appraisal ? <AppraisalView call={appraisal} /> : <PlanningCallView call={planning!} />}{metadata?.explanation && <p>{metadata.explanation}</p>}
          <div className="mi-sequence-io"><details><summary>{appraisal ? 'Exact recorded appraisal input' : 'Exact recorded planning input'}</summary><Json value={(appraisal ?? planning)!.input} /></details><details><summary>{appraisal ? 'Validated appraisal result' : 'Validated planning result'}</summary><Json value={(appraisal ?? planning)!.result} /></details></div>
          {metadata?.parameters.integration === 'jev' && <details><summary>{appraisal ? 'Jev judgments and policy' : 'Jev probabilities and decision thresholds'}</summary><Json value={{ policy: metadata.parameters.decisionPolicy, decisions: metadata.parameters.decisions }} /></details>}
          {metadata?.parameters.request && <details><summary>{metadata.parameters.integration === 'jev' ? 'Exact Jev request · state and questions' : 'Exact model request · prompts, schema and settings'}</summary><Json value={metadata.parameters.request} /></details>}
          {metadata?.parameters.response && <details><summary>Sanitized model response</summary><Json value={metadata.parameters.response} /></details>}
          {Array.isArray(metadata?.parameters.additionalOperations) && metadata.parameters.additionalOperations.map((operation, index) => {
            const item = operation as unknown as { role: string; metadata: { provider: string; model: string | null } };
            return <details key={index}><summary>Additional call · {item.role} · {item.metadata.provider} · {item.metadata.model}</summary><Json value={operation} /></details>;
          })}
          <details><summary>Provider/model metadata and usage</summary><Json value={metadata} /></details>
        </> : decision ? <>
          {decision.proposal.metadata.explanation && <p>{decision.proposal.metadata.explanation}</p>}
          <div className="mi-sequence-io"><details><summary>Exact recorded input to appraisal</summary><Json value={decision.context} /></details><details><summary>Validated result from appraisal</summary><Json value={decision.proposal} /></details></div>
          {decision.proposal.metadata.parameters.request && <details><summary>Exact model request · prompts, schema and settings</summary><Json value={decision.proposal.metadata.parameters.request} /></details>}
          {decision.proposal.metadata.parameters.response && <details><summary>Sanitized model response</summary><Json value={decision.proposal.metadata.parameters.response} /></details>}
          <details><summary>Provider/model metadata and usage</summary><Json value={decision.proposal.metadata} /></details>
        </> : r.type === 'transition' ? <TransitionView payload={r.payload as unknown as TransitionPayload} /> : <>
          {observation?.processing === 'memoryOnly' && <p>Appraisal skipped · memory-only observation. Planning skipped; {observation.intentionCompletions ? 'explicit host confirmations applied.' : 'commitments preserved.'} No LLM call.</p>}
          {observation?.intentionCompletions && <p>Legacy host-confirmed completion · {observation.intentionCompletions.length} strategies · follow the transition for the committed result.</p>}
          <Json value={r.payload} />
        </>}
      </details>;
    })}
    {!appraisals.length && <p className="mi-subtle">{failed ? 'Cognition failed before a decision was committed.' : 'No appraisal call ran in this turn.'}</p>}
  </section>;
}


