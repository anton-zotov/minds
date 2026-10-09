import { duration } from './duration.js';
import { TransitionView, type TransitionPayload } from './TransitionView.js';
import { isActionStage, actionStageName, ActionCallView } from './ActionPanels.js';
import type { InspectionRecord, CognitionContext, CognitionProposal, Observation, IntentionCall, IntentionCycle, AppraisalCall } from '@minds/core';
import { isAppraisalStage, appraisalStageName, AppraisalView } from './AppraisalView.js';
import { PlanningCallView, IntentionCycleView, intentionStageName } from './IntentionPanels.js';
import { recordName } from './Timeline.js';
export function RecordDetail({ durations, record, records, onSelectRecord }: { durations?: Record<string, number> | undefined; record: InspectionRecord | undefined; records: InspectionRecord[]; onSelectRecord: (id: string) => void }) {
  if (!record) return <section className="mi-panel mi-record-detail" data-testid="record-detail"><div className="mi-panel-title"><h3>Record detail</h3><span>CAUSAL TRACE</span></div><div className="mi-detail-empty"><span>↗</span><h4>Select a record</h4><p>Follow an observation through memory,<br />appraisal, and state changes.</p></div></section>;
  const causes = record.causeIds.map(id => records.find(r => r.id === id)); const effects = records.filter(r => r.causeIds.includes(record.id));
  const observation = record.type === 'observation' ? record.payload as unknown as Observation & { provenance?: string; processing?: string; intentionCompletions?: string[] } : null;
  const stage = (record.payload as { stage?: string } | null)?.stage;
  const appraisal = record.type === 'decision' && isAppraisalStage(stage) ? record.payload as unknown as AppraisalCall : null;
  const planning = record.type === 'decision' && stage && !appraisal && !isActionStage(stage) && stage !== 'intention-summary' ? record.payload as unknown as IntentionCall : null;
  const cycle = stage === 'intention-summary' ? (record.payload as unknown as { cycle: IntentionCycle }).cycle : null;
  const decision = record.type === 'decision' && !stage ? record.payload as unknown as { context: CognitionContext; proposal: CognitionProposal; retrievedMemoryIds: string[] } : null;
  return <section className="mi-panel mi-record-detail" data-testid="record-detail"><div className="mi-panel-title"><h3>{recordName(record.type)}</h3><span>#{record.sequence} · {duration(durations?.[record.id])}</span></div>
    <div className="mi-cause-links">{causes.map((r, i) => r ? <button className="mi-link" key={r.id} onClick={() => onSelectRecord(r.id)}>Cause #{r.sequence} · {recordName(r.type)}</button> : <span key={i}>Cause unavailable</span>)}{effects.map(r => <button className="mi-link" key={r.id} onClick={() => onSelectRecord(r.id)}>Effect #{r.sequence} · {recordName(r.type)}</button>)}</div>
    {observation && <><blockquote>{observation.content}</blockquote><p className="mi-subtle">{[observation.provenance, observation.source, observation.kind].filter(Boolean).join(' · ')}</p><p>{observation.processing === 'memoryOnly' ? 'Legacy memory-only observation · appraisal skipped.' : 'Mind interpretation · follow recorded effects for results.'}</p></>}
    {observation?.intentionCompletions && <p>Legacy host-confirmed completion: {observation.intentionCompletions.join(', ')}. Follow the transition for the committed result.</p>}
    {record.type === 'memory' && <><h4>Stored memory</h4><p>{(record.payload as unknown as { observation: Observation }).observation.content}</p><small>Memory ID: {(record.payload as unknown as { id: string }).id}</small></>}
    {decision && <><h4>Appraisal output</h4><p>{decision.proposal.metadata.explanation ?? 'Explanation unavailable.'}</p><p className="mi-tag">{decision.proposal.metadata.provider} · {decision.proposal.metadata.model ?? 'no model'}</p><p>Retrieved memories: {decision.retrievedMemoryIds.join(', ') || 'none'}</p><details><summary>Actual appraisal context</summary><pre>{JSON.stringify(decision.context, null, 2)}</pre></details><details><summary>Proposal and provider metadata</summary><pre>{JSON.stringify(decision.proposal, null, 2)}</pre></details></>}
    {isActionStage(stage) && <ActionCallView payload={record.payload} />}
    {planning && <><h4>{intentionStageName(planning.stage)}</h4><PlanningCallView call={planning} /><p>{planning.result.metadata.explanation}</p><details><summary>Recorded planning input and result</summary><pre>{JSON.stringify(planning, null, 2)}</pre></details></>}
    {appraisal && <><h4>{appraisalStageName(appraisal.stage)}</h4><AppraisalView call={appraisal} /><details><summary>Recorded appraisal input and result</summary><pre>{JSON.stringify(appraisal, null, 2)}</pre></details></>}
    {cycle && <><h4>Planning outcome</h4><IntentionCycleView cycle={cycle} /></>}
    {record.type === 'transition' && <>{!record.observationId && <p className="mi-tag">{record.schemaVersion === 8 ? 'Action lifecycle · no world observation' : 'Legacy time-only decay · no observation cause'}</p>}<TransitionView payload={record.payload as unknown as TransitionPayload} /></>}
    {record.type === 'initialized' && <p>Initial host-supplied state. No appraisal has run for this record.</p>}
    <details className="mi-raw"><summary>Full record · raw data</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
  </section>;
}

