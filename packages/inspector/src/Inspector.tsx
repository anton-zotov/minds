import { duration } from './duration.js';
import type { InspectionView } from './contract.js';
import { StatePanels } from './StatePanels.js';
import { Timeline } from './Timeline.js';
import { RecordDetail } from './RecordDetail.js';
import { inspectionTurns, turnState } from './turns.js';
import { TurnSelector } from './TurnSelector.js';
import { DecisionSequence } from './DecisionSequence.js';
export interface InspectorProps {
  view: InspectionView;
  selectedMindId: string | null;
  selectedRecordId: string | null;
  onSelectMind: (id: string) => void;
  onSelectRecord: (id: string | null) => void;
}
export function Inspector({ view, selectedMindId, selectedRecordId, onSelectMind, onSelectRecord }: InspectorProps) {
  const [turnSelection, setTurnSelection] = useState<{ runId: string; mindId: string; id: string } | null>(null);
  if (view.schemaVersion !== 1) return <section className="mi"><p role="alert">Unsupported inspection schema. This Inspector supports version 1.</p></section>;
  const selected = view.minds.find(m => m.snapshot.config.mindId === selectedMindId) ?? view.minds[0];
  if (!selected) return <section className="mi"><p>No Minds supplied</p></section>;
  const turns = inspectionTurns(view, selected);
  const pinnedId = turnSelection?.runId === view.runId && turnSelection.mindId === selected.snapshot.config.mindId ? turnSelection.id : null;
  const turn = turns.find(t => t.id === pinnedId) ?? turns.at(-1);
  if (!turn) return <section className="mi"><p>No turn history supplied.</p></section>;
  const state = turnState(selected, turn);
  if (!state) return <section className="mi"><p role="alert">State is unavailable for the selected turn.</p></section>;
  const snapshot = state.snapshot;
  const record = state.records.find(r => r.id === selectedRecordId);
  function selectTurn(id: string | null) { setTurnSelection(id === null ? null : { runId: view.runId, mindId: snapshot.config.mindId, id }); onSelectRecord(null); }
  function selectRecord(id: string | null) {
    if (id !== null && !state!.records.some(r => r.id === id)) {
      const linked = selected!.records.find(r => r.id === id);
      const owner = linked && turns.find(t => { const range = t.recordRanges[snapshot.config.mindId]; return range && linked.sequence > range.afterSequence && linked.sequence <= range.throughSequence; });
      if (owner) setTurnSelection({ runId: view.runId, mindId: snapshot.config.mindId, id: owner.id });
    }
    onSelectRecord(id);
  }
  return <section className="mi" aria-label="Minds Inspector">
    <div className="mi-top"><span className="mi-eyebrow">INSPECTOR</span><span className="mi-subtle">{view.status}</span></div>
    <div className="mi-mind-tabs" role="group" aria-label="Select Mind">{view.minds.map(m => <button key={m.snapshot.config.mindId} aria-pressed={m === selected} onClick={() => { onSelectMind(m.snapshot.config.mindId); onSelectRecord(null); }}>
      <span className="mi-avatar">{m.snapshot.config.identity.name[0]}</span><span><strong>{m.snapshot.config.identity.name}</strong><small>{m.snapshot.config.goal}</small></span><span className="mi-revision">r{m === selected ? snapshot.revision : m.snapshot.revision}</span>
    </button>)}</div>
    <TurnSelector turns={turns} selected={turn} followLatest={pinnedId === null} onSelect={selectTurn} />
    <header className="mi-identity"><div><span className="mi-eyebrow">CHARACTER PERSPECTIVE · TURN {turn.index}</span><h2>{snapshot.config.identity.name}</h2><p>{snapshot.config.identity.description}</p></div><div className="mi-time"><strong data-duration>{duration(turn.durationMs)}</strong><small>turn duration · revision {snapshot.revision}</small></div></header>
    {turn.errors.map(e => <p role="alert" key={e.mindId}>{e.message}</p>)}
    <StatePanels snapshot={snapshot} records={state.history} turnRecords={state.records} onSelectRecord={selectRecord} />
    <DecisionSequence durations={selected.recordDurations} records={state.records} failed={turn.errors.length > 0} />
    <div className="mi-trace-grid"><Timeline durations={selected.recordDurations} records={state.records} selectedRecordId={record?.id ?? null} onSelectRecord={selectRecord} /><RecordDetail durations={selected.recordDurations} record={record} records={state.records} onSelectRecord={selectRecord} /></div>
    <details className="mi-raw"><summary>Full selected-turn snapshot · raw data</summary><pre>{JSON.stringify(snapshot, null, 2)}</pre></details>
  </section>;
}
import { useState } from 'react';
