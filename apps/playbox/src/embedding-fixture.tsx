import { useState } from 'react';
import { createMind, type CognitionProvider } from '@minds/core';
import { Inspector, type InspectionView } from '@minds/inspector';
// Independent client-game embedding: only public core and Inspector imports.
export async function embeddingView(): Promise<InspectionView> {
  const fixture: CognitionProvider = { appraise: async c => ({ beliefUpdates: [], moodDeltas: {}, emotionDeltas: { anger: 0.4 }, metadata: { provider: 'deterministic-fixture', model: null, explanation: 'Independent host demonstration.', parameters: {} } }) };
  const minds = ['marta', 'leon'].map(id => createMind({ runId: 'embedding-demo', mindId: id, identity: { name: id === 'marta' ? 'Marta' : 'Leon', description: 'Independent host character.' }, goal: id === 'marta' ? 'Keep public access' : 'Reserve water', time: 0, beliefs: [], mood: {}, emotions: { anger: { value: 0, baseline: 0, halfLifeMs: 1000 } } }, fixture));
  await minds[0]!.ingest({ id: 'embedding-observation', time: 0, source: 'independent-host', kind: 'speech', content: 'The agreement was broken.' });
  return { schemaVersion: 1, runId: 'embedding-demo', time: 0, providerMode: 'fixture', status: 'ready', errors: [], minds: minds.map(m => ({ snapshot: m.getSnapshot(), records: m.getRecords() })) };
}
export function EmbeddingFixture({ view }: { view: InspectionView }) {
  const [mind, setMind] = useState<string | null>('marta'); const [record, setRecord] = useState<string | null>(null);
  return <main style={{ padding: 24, maxWidth: 1100, margin: 'auto' }}><Inspector view={view} selectedMindId={mind} selectedRecordId={record} onSelectMind={setMind} onSelectRecord={setRecord} /></main>;
}
