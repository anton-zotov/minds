import type { MindSnapshot, InspectionRecord, IntentionCall, IntentionCycle, GenerationResult, ReconsiderationResult, EvaluationContext, IntentionEvaluation, SufficiencyResult, ProviderMetadata } from '@minds/core';
export const intentionStageName = (stage: string) => ({
  'intention-generation': 'Generate intention candidates', 'intention-reconsideration': 'Reconsider commitments',
  'intention-evaluation': 'Evaluate intention candidate', 'intention-sufficiency': 'Check intention sufficiency', 'intention-summary': 'Planning outcome',
}[stage] ?? stage);
export const planningProviderCalls = (calls: { result: { metadata: ProviderMetadata } }[]) => calls.reduce((sum, call) => {
  const count = call.result.metadata.parameters.providerCalls;
  return sum + (typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : 1);
}, 0);
export function IntentionsPanel({ snapshot, records, onSelectRecord }: { snapshot: MindSnapshot; records: InspectionRecord[]; onSelectRecord: (id: string) => void }) {
  const intentions = snapshot.intentions ?? [];
  const evidenceLink = (id: string) => {
    const record = records.find(r => r.type === 'memory' && r.observationId === id);
    return record ? <button className="mi-link" key={id} onClick={() => onSelectRecord(record.id)}>Evidence: {id} ↗</button> : <small key={id}>Evidence unavailable: {id}</small>;
  };
  return <section className="mi-panel mi-intentions" data-testid="intentions"><div className="mi-panel-title"><h3>Intentions</h3><span>{intentions.filter(i => i.status === 'active').length} active · {intentions.length} retained</span></div>
    {!intentions.length && <p className="mi-empty">{snapshot.config.intentionPolicy ? 'No intentions adopted yet. Observe an event to begin planning.' : 'Intention planning is not enabled for this Mind.'}</p>}
    <div className="mi-intention-grid">{intentions.map(i => {
      const history = records.filter(r => r.type === 'transition').filter(r => {
        const p = r.payload as unknown as { before: MindSnapshot; after: MindSnapshot };
        return p.after.intentions?.some(n => n.id === i.id) && JSON.stringify(p.before.intentions?.find(n => n.id === i.id)) !== JSON.stringify(p.after.intentions?.find(n => n.id === i.id));
      });
      const legacyCompletion = records.some(r => r.type === 'observation' && i.evidenceIds.includes(r.observationId ?? '') && (r.payload as { intentionCompletions?: string[] }).intentionCompletions?.includes(i.id));
      return <article className="mi-intention" key={i.id}><div><span className="mi-tag">{i.status}</span><strong>priority {Math.round(i.priority * 100)}%</strong></div><h4>{i.description}</h4>
        <p className="mi-subtle">Adopted {i.createdAt / 1000}s · last changed {i.reconsideredAt / 1000}s</p>
        {i.status === 'completed' && <p className="mi-subtle">{legacyCompletion ? 'Legacy completion confirmed by the host.' : 'The Mind believes this strategy is fulfilled.'}</p>}
        <p className="mi-subtle">Supporting beliefs: {i.supportingBeliefIds.length ? i.supportingBeliefIds.map(id => snapshot.beliefs.find(b => b.id === id)?.statement ?? `${id} (unavailable)`).join('; ') : 'none recorded'}</p>
        <div className="mi-intention-links">{evidenceLink(i.originObservationId)}{i.evidenceIds.filter(id => id !== i.originObservationId).map(evidenceLink)}</div>
        <details><summary>Origin and revision history · {history.length} changes</summary><small>Stable ID: {i.id}</small><p className="mi-subtle">Serves goal: {i.goal}</p>{history.map(r => {
          const p = r.payload as unknown as { after: MindSnapshot }; const version = p.after.intentions!.find(n => n.id === i.id)!;
          return <div className="mi-intention-history" key={r.id}><span>{version.description} · {version.status} · {Math.round(version.priority * 100)}%</span><button className="mi-link" onClick={() => onSelectRecord(r.id)}>Transition #{r.sequence} · {r.time / 1000}s ↗</button></div>;
        })}</details>
      </article>;
    })}</div>
  </section>;
}
export function PlanningCallView({ call }: { call: IntentionCall }) {
  if (call.stage === 'intention-generation') return <><p>{(call.result as GenerationResult).candidates.length} generated candidates before runtime shuffle.</p><ol>{(call.result as GenerationResult).candidates.map(c => <li key={c.id}>{c.id}: {c.description} · priority {Math.round(c.priority * 100)}%</li>)}</ol></>;
  if (call.stage === 'intention-evaluation') {
    const input = call.input as EvaluationContext; const result = call.result as IntentionEvaluation;
    return <><p><strong>{result.accept ? 'Accepted' : 'Rejected'}: {input.candidate.description}</strong></p><p className="mi-subtle">Compared against {input.activeIntentions.length} active commitments.</p><div className="mi-score-grid">{Object.entries(result.scores).map(([name, value]) => <span key={name}>{name}: {value.toFixed(2)}</span>)}</div></>;
  }
  if (call.stage === 'intention-sufficiency') return <p>{(call.result as SufficiencyResult).sufficient ? 'The accepted set is sufficient; stop evaluating.' : 'The provider requests further candidates, subject to runtime limits.'}</p>;
  const result = call.result as ReconsiderationResult;
  return <><p>{result.revisions.length ? `${result.revisions.length} recorded revision decisions.` : 'Existing commitments kept unchanged.'} {result.generateMore ? 'Additional strategies requested.' : 'No additional strategies requested.'}</p>{result.revisions.map(r => <p key={r.intentionId}>{r.action}: {r.description ?? r.intentionId}</p>)}</>;
}
export function IntentionCycleView({ cycle }: { cycle: IntentionCycle }) {
  const generated = cycle.calls.find(c => c.stage === 'intention-generation')?.result as GenerationResult | undefined;
  return <div data-testid="intention-cycle"><p><strong>Stopped: {cycle.stoppingReason}</strong></p><p className="mi-subtle">Shuffle seed {cycle.seed} · {planningProviderCalls(cycle.calls)} planning calls · {cycle.acceptedIntentionIds.length} newly adopted</p>
    {!generated && <p className="mi-subtle">Candidate generation skipped · {cycle.stoppingReason === 'commitment-preserved' ? 'the Mind requested no additional strategies.' : 'the active intention limit is already reached.'}</p>}
    {!!cycle.candidateOrder.length && <><p className="mi-subtle">Evaluation order: {cycle.candidateOrder.join(' → ')}</p><ol className="mi-candidate-list">{cycle.candidateOrder.map(id => {
      const candidate = generated?.candidates.find(c => c.id === id); const evaluation = cycle.evaluations.find(e => e.candidateId === id);
      return <li key={id}><div><strong>{candidate?.description ?? id}</strong><span className="mi-tag">{evaluation?.reason ?? 'not evaluated · stopped'}</span></div><small>{id} · {evaluation ? `${evaluation.activeIntentionIds.length} active after decision` : 'provider evaluation skipped'}</small></li>;
    })}</ol></>}
  </div>;
}
