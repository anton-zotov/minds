import { duration } from '../../../packages/inspector/src/duration';
import { useEffect, useRef, useState } from 'react';
import { Inspector, type InspectionView } from '@minds/inspector';
import { api } from './api';
import { ScenarioControls } from './ScenarioControls';
import type { Injection } from '../server/host';
export function App() {
  const [view, setView] = useState<InspectionView | null>(null); const [config, setConfig] = useState({ openrouterAvailable: false, actionGenerationModel: null as string | null, actionDecisionModel: null as string | null, actionExpressionModel: null as string | null, model: null as string | null, appraisalDecisionModel: null as string | null, intentionGenerationModel: null as string | null, intentionDecisionModel: null as string | null, intentionDecisionEndpoint: null as string | null });
  const [mind, setMind] = useState<string | null>('marta'); const [record, setRecord] = useState<string | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [connected, setConnected] = useState(true);
  const [mode, setMode] = useState<InspectionView['providerMode']>('fixture');
  const generation = useRef(0);
  const currentView = useRef(view); currentView.current = view;
  useEffect(() => {
    let active = true;
    void Promise.all([api<InspectionView>('run'), api<typeof config>('config')]).then(([next, settings]) => { if (active) { setView(next); setMode(next.providerMode); setConfig(settings); } }).catch(() => { if (active) { setConnected(false); setError('Could not connect to the Playbox server. Start npm run dev and reload.'); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!busy && view?.status !== 'pending') return;
    let active = true;
    let polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true; const current = generation.current;
      void api<{ runId: string; status: InspectionView['status']; recordCounts: number[] }>('status').then(async status => {
        const displayed = currentView.current;
        if (!displayed || status.runId !== displayed.runId || status.status !== displayed.status || status.recordCounts.some((count, i) => count !== displayed.minds[i]?.records.length)) {
          const next = await api<InspectionView>('run'); if (active && current === generation.current) setView(next);
        }
        if (active) setConnected(true);
      }).catch(() => { if (active) setConnected(false); }).finally(() => { polling = false; });
    }, 350);
    return () => { active = false; clearInterval(timer); };
  }, [busy, view?.status]);
  async function mutate(path: string, input: unknown = {}) {
    setBusy(true); setError(''); generation.current++;
    try {
      const next = await api<InspectionView>(path, input); generation.current++; setConnected(true);
      setView(next); if (path === 'run') { setMind('marta'); setRecord(null); setMode(next.providerMode); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed.'); }
    finally { setBusy(false); }
  }
  const operationPending = busy || view?.status === 'pending';
  const disabled = operationPending || !view; const failed = view?.status === 'failed';
  return <div className="playbox">
    <aside className="sidebar"><a href="/" className="brand"><span className="brand-mark">m</span><span>Minds<span className="brand-sub">PLAYBOX</span></span></a>
      <div className="sidebar-scenario"><h1>The apple market</h1><div className="scenario-badge">2 Minds · buyer / seller</div></div>
      <div className="run-controls"><div className="run-status"><span className={operationPending ? 'status-dot pending' : 'status-dot'} />{operationPending ? 'Processing cognition' : failed ? 'Stage failed' : 'Ready'}<strong data-duration title="Last turn duration">{duration(view?.turns?.at(-1)?.durationMs)}</strong></div>
        <button className="primary-button" disabled={disabled || failed || Boolean(view?.world?.stopReason)} onClick={() => void mutate('step')}>▶ <span>Step conversation</span><span>→</span></button>
        <div className="control-pair"><button disabled={disabled || failed || Boolean(view?.world?.stopReason)} onClick={() => void mutate('conversation')}>Run conversation</button><button disabled={disabled} onClick={() => void mutate('run', { mode })}>Reset run</button></div>
        {failed && <button className="sidebar-button" disabled={disabled} onClick={() => void mutate('retry')}>Retry failed stage</button>}
      </div>
      <div className="provider-control"><label htmlFor="provider" className="sidebar-section-label">PROVIDER</label><select id="provider" value={mode} onChange={e => { const next = e.target.value as typeof mode; void mutate('run', { mode: next }); }} disabled={disabled}><option value="fixture">Offline fixture</option><option value="openrouter" disabled={!config.openrouterAvailable}>OpenRouter{config.openrouterAvailable ? '' : ' · not configured'}</option></select>{view?.providerMode === 'openrouter' && <details className="provider-models"><summary>Models</summary><p>Belief proposals: {config.model}</p><p>Appraisal: {config.appraisalDecisionModel}</p><p>Strategies: {config.intentionGenerationModel}</p><p>Decisions: {config.intentionDecisionModel}</p><p>Actions: {config.actionGenerationModel}</p><p>Action selection: {config.actionDecisionModel}</p><p>Speech: {config.actionExpressionModel}</p></details>}</div>
      <ScenarioControls key={view?.runId} disabled={disabled || failed} inject={(input: Injection) => mutate('inject', input)} />
      <button className="export-button" disabled={disabled} onClick={() => { const link = document.createElement('a'); link.href = '/api/recording?format=compact'; link.download = `${view?.runId}.json`; link.click(); }}>↓ Export recording</button>
    </aside>
    <main className="workspace"><header className="workspace-header"><strong>Playbox</strong><span className="connection">● {connected ? 'Connected' : 'Disconnected · state may be stale'}</span></header>
      <details className="scenario-context"><summary>Scenario context</summary><p>Marta is buying one crate of apples from Ivo. Each Mind has its own private goal and price limit. The host executes structured offers and acceptances.</p></details>
      {error && <div role="alert" className="error-banner">{error}</div>}
      {view?.errors.map(e => <div role="alert" className="error-banner" key={e.mindId}>{e.mindId}: {e.message}</div>)}
      {view?.world && <section className="trade-state"><h2>{view.world.transaction ? `Deal executed · ${view.world.transaction.price} coins` : view.world.stopReason ?? `Next: ${view.world.nextActorId} · turn ${view.world.turnCount + 1} / 12`}</h2><p>Marta: {view.world.balances.marta} coins · {view.world.crates.marta} crate | Ivo: {view.world.balances.ivo} coins · {view.world.crates.ivo} crate</p>{view.world.offers.filter(o => o.status === 'open').map(o => <p key={o.id}>Open offer: {o.ownerId} → {o.recipientId} · {o.price} coins</p>)}<h3>Conversation</h3>{view.world.transcript.length ? view.world.transcript.map(t => <p key={t.id}><strong>{t.speakerId} → {t.recipientId}:</strong> {t.speech}</p>) : <p>No utterances yet. Step to let Marta choose an action.</p>}</section>}<div className="inspector-container">{view ? <Inspector view={view} selectedMindId={mind} selectedRecordId={record} onSelectMind={setMind} onSelectRecord={setRecord} /> : <p role="status">Connecting to the local host…</p>}</div>
    </main>
  </div>;
}


