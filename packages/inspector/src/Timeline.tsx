import { duration } from './duration.js';
import type { InspectionRecord } from '@minds/core';
export const recordName = (type: string) => type[0]!.toUpperCase() + type.slice(1);
export function Timeline({ durations, records, selectedRecordId, onSelectRecord }: { durations?: Record<string, number> | undefined; records: InspectionRecord[]; selectedRecordId: string | null; onSelectRecord: (id: string) => void }) {
  return <section className="mi-panel mi-timeline"><div className="mi-panel-title"><h3>Cognitive timeline</h3><span>{records.length} records</span></div>
    {!records.length && <p>No records for this Mind in this turn.</p>}
    <ol>{records.map(r => <li key={r.id}><button aria-pressed={r.id === selectedRecordId} onClick={() => onSelectRecord(r.id)}>
      <span className={`mi-dot mi-dot-${r.type}`} /><span className="mi-seq">#{r.sequence}</span><strong>{recordName(r.type)}</strong><small data-duration title="Wall-clock operation duration; — means not measured">{duration(durations?.[r.id])}</small>
    </button></li>)}</ol>
  </section>;
}
