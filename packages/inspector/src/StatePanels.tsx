import type { MindSnapshot, InspectionRecord, AffectDimension } from '@minds/core';
import { IntentionsPanel } from './IntentionPanels.js';
function Affect({ title, dimensions }: { title: string; dimensions: Record<string, AffectDimension> }) {
  return <div className="mi-affect-group"><h4>{title}</h4>{Object.entries(dimensions).map(([name, d]) => <div className="mi-dimension" key={name}>
    <div><span>{name}</span><strong data-testid={`${name}-value`}>{d.value.toFixed(3)}</strong></div>
    <div className="mi-meter"><meter aria-label={`${title} ${name}`} min={0} max={1} value={d.value} /><span className="mi-baseline" style={{ left: `${d.baseline * 100}%` }} title={`Baseline ${d.baseline}`} /></div>
    <small>baseline {d.baseline.toFixed(2)} · half-life {d.halfLifeMs / 1000}s</small>
  </div>)}</div>;
}
export function StatePanels({ snapshot, records, turnRecords, onSelectRecord }: { snapshot: MindSnapshot; records: InspectionRecord[]; turnRecords: InspectionRecord[]; onSelectRecord: (id: string) => void }) {
  const memoryIds = new Set(turnRecords.filter(r => r.type === 'memory').map(r => r.observationId));
  const turnMemories = snapshot.memories.filter(m => memoryIds.has(m.id));
  return <>
    <div className="mi-goal"><span>ASSIGNED GOAL</span><strong>{snapshot.config.goal}</strong></div>
    <div className="mi-state-grid">
      <section className="mi-panel" data-testid="beliefs"><div className="mi-panel-title"><h3>Beliefs</h3><span>{snapshot.beliefs.length}</span></div>
        {snapshot.beliefs.map(b => <article className="mi-belief" key={b.id}><p>{b.statement}</p><div><span className="mi-confidence">{Math.round(b.confidence * 100)}% confidence</span>{b.evidenceIds.length ? b.evidenceIds.map(id => {
          const evidence = records.find(r => r.type === 'memory' && (r.payload as { id?: string } | null)?.id === id);
          return evidence ? <button className="mi-link" key={id} onClick={() => onSelectRecord(evidence.id)}>Evidence: {id} ↗</button> : <span key={id}>Evidence unavailable: {id}</span>;
        }) : <small>Initial belief · no recorded evidence</small>}</div></article>)}
      </section>
      <section className="mi-panel"><div className="mi-panel-title"><h3>Affect</h3><span>0—1</span></div><Affect title="Mood" dimensions={snapshot.mood} /><Affect title="Emotions" dimensions={snapshot.emotions} /></section>
      <section className="mi-panel" data-testid="memories"><div className="mi-panel-title"><h3>Observations this turn</h3><span>{turnMemories.length}</span></div>
        {!turnMemories.length && <p className="mi-empty">No observations in this turn.<br />{snapshot.memories.length} memories retained in state.</p>}
        <div className="mi-memory-list">{turnMemories.map(memory => <article className="mi-memory" key={memory.id}><div><span className="mi-tag">{(memory.observation as typeof memory.observation & { provenance?: string }).provenance ?? memory.observation.kind}</span><small>{memory.observation.time / 1000}s · {memory.observation.source}</small></div><p>{memory.observation.content}</p><small>{memory.id}{(memory.observation as typeof memory.observation & { processing?: string }).processing ? ` · ${(memory.observation as typeof memory.observation & { processing?: string }).processing}` : ''}</small></article>)}</div>
      </section>
    </div>
    {snapshot.actions && <section className="mi-panel" data-testid="actions"><div className="mi-panel-title"><h3>Actions</h3><span>{snapshot.actions.length}</span></div>{snapshot.actions.map(a => <article className="mi-belief" key={a.id}><p>{a.candidate.objective}</p><small>{a.candidate.capabilityId} → {a.candidate.targetId ?? 'no target'} · {a.status}</small>{a.expression && <blockquote>{a.expression}</blockquote>}<p>{Object.entries(a.candidate.parameters).map(([k,v]) => `${k}: ${v}`).join(' · ')}</p>{a.reason && <p>{a.reason}</p>}</article>)}<p className="mi-subtle">Host execution receipts record action outcomes. The Mind judges strategy completion from observed consequences.</p></section>}
    <IntentionsPanel snapshot={snapshot} records={records} onSelectRecord={onSelectRecord} />
  </>;
}

