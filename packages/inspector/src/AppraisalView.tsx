import type { AppraisalCall, BeliefUpdateResult, EmotionalAppraisalResult } from '@minds/core';
export const isAppraisalStage = (stage: string | undefined) => stage === 'belief-update' || stage === 'emotional-appraisal';
export const appraisalStageName = (stage: string) => stage === 'belief-update' ? 'Update beliefs' : 'Appraise emotions';
export function AppraisalView({ call }: { call: AppraisalCall }) {
  if(call.stage==='belief-update'){
    const result=call.result as BeliefUpdateResult;
    return <>{result.beliefUpdates.map(b=><p key={b.id}>{b.statement} · {Math.round(b.confidence*100)}% confidence</p>)}{result.beliefRetirements?.map(retirement=><p key={retirement.id}><span className="mi-tag">{retirement.supersededBy?'Merged':'Retired'}</span> {call.input.mind.beliefs.find(b=>b.id===retirement.id)?.statement??retirement.id}{retirement.supersededBy&&<> → {result.beliefUpdates.find(b=>b.id===retirement.supersededBy)?.statement}</>}</p>)}{!result.beliefUpdates.length&&!result.beliefRetirements?.length&&<p>Beliefs unchanged.</p>}</>;
  }
  return (
    <div className="mi-score-grid">{(['moodDeltas', 'emotionDeltas'] as const).flatMap(layer => Object.entries((call.result as EmotionalAppraisalResult)[layer]).map(([name, delta]) => <span key={`${layer}-${name}`}>{layer === 'moodDeltas' ? 'Mood' : 'Emotion'} / {name}: {delta >= 0 ? '+' : ''}{delta.toFixed(3)}</span>))}</div>
  );
}
