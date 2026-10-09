import { duration } from './duration.js';
import type { InspectionTurn } from './contract.js';
export function TurnSelector({ turns, selected, followLatest, onSelect }: { turns: InspectionTurn[]; selected: InspectionTurn; followLatest: boolean; onSelect: (id: string | null) => void }) {
  const position = turns.findIndex(t => t.id === selected.id);
  return <div className="mi-turn-selector">
    <div><label htmlFor="mi-turn">Selected turn</label><select id="mi-turn" value={selected.id} onChange={e => onSelect(e.target.value)}>{turns.map(t => <option key={t.id} value={t.id}>Turn {t.index} · {t.label} · {duration(t.durationMs)}</option>)}</select></div>
    <div className="mi-turn-buttons"><button disabled={position === 0} onClick={() => onSelect(turns[position - 1]!.id)}>Previous turn</button><button disabled={position === turns.length - 1} onClick={() => onSelect(turns[position + 1]!.id)}>Next turn</button><button aria-pressed={followLatest} onClick={() => onSelect(null)}>Latest turn</button></div>
    <p>{followLatest ? 'Following latest turn' : 'Selected turn is pinned'}</p>
  </div>;
}
