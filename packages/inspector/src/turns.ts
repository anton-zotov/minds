import type { MindSnapshot } from '@minds/core';
import type { InspectionView, InspectionTurn } from './contract.js';
export function inspectionTurns(view: InspectionView, mind: InspectionView['minds'][number]): InspectionTurn[] {
  const supplied = view.turns?.filter(t => Boolean(t.recordRanges[mind.snapshot.config.mindId]));
  if (supplied?.length) return supplied;
  // Native recordings mark subjective turns with initialization or a received observation.
  const starts = mind.records.filter(r => r.type === 'initialized' || r.type === 'observation');
  return starts.map((record, index) => {
    return { id: String(index), mindId: record.mindId, kind: record.type === 'initialized' ? 'initial' : 'event', index,
      label: index === 0 ? 'Initial state' : `Received event ${index}`, time: record.time, errors: [],
      recordRanges: { [record.mindId]: { afterSequence: record.sequence - 1, throughSequence: starts[index + 1] ? starts[index + 1]!.sequence - 1 : mind.records.at(-1)!.sequence } } };
  });
}
export function turnState(mind: InspectionView['minds'][number], turn: InspectionTurn) {
  const range = turn.recordRanges[mind.snapshot.config.mindId];
  if (!range) return null;
  const history = mind.records.filter(r => r.sequence <= range.throughSequence);
  const committed = history.findLast(r => r.type === 'transition' || r.type === 'initialized');
  if (!committed) return null;
  const snapshot = (committed.type === 'initialized' ? committed.payload : (committed.payload as { after: unknown }).after) as unknown as MindSnapshot;
  return { snapshot, history, records: history.filter(r => r.sequence > range.afterSequence) };
}

