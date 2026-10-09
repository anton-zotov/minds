import type { BeliefUpdateResult, MindSnapshot } from './types.js';
/** Apply only already-validated changes; callers commit the entire event atomically. */
export function applyBeliefChanges(state: MindSnapshot, changes: Pick<BeliefUpdateResult,'beliefUpdates'|'beliefRetirements'>): void {
  const retired=new Set(changes.beliefRetirements?.map(b=>b.id));
  const beliefs=new Map(state.beliefs.filter(b=>!retired.has(b.id)).map(b=>[b.id,b]));
  for(const belief of changes.beliefUpdates)beliefs.set(belief.id,structuredClone(belief));
  state.beliefs=[...beliefs.values()];
}
