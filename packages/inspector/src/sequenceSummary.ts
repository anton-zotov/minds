import type { InspectionRecord, MindSnapshot, Observation, Memory, AppraisalCall, BeliefUpdateResult, EmotionalAppraisalResult, IntentionCall, GenerationResult, IntentionEvaluation, EvaluationContext, SufficiencyResult, ReconsiderationResult, IntentionCycle, ActionGenerationResult, ActionSelectionResult, ActionSelectionContext, ActionExpressionResult, ActionPlanOperation, ActionStatusOperation, CognitionProposal } from '@minds/core';
function affect(result: Pick<CognitionProposal, 'moodDeltas'|'emotionDeltas'>) {
  const changes=Object.entries({...result.moodDeltas,...result.emotionDeltas}).filter(([,v])=>v!==0).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  return changes.length?changes.slice(0,3).map(([name,v])=>`${name} ${v>=0?'+':''}${v.toFixed(3)}`).join(' · '):'Affect unchanged';
}
export function sequenceSummary(record: InspectionRecord): string {
  if(record.type==='initialized') {const s=record.payload as unknown as MindSnapshot;return s.config.goal;}
  if(record.type==='observation') {const o=record.payload as unknown as Observation;return `${o.source} · ${o.content}`;}
  if(record.type==='memory') return (record.payload as unknown as Memory).observation.content;
  if(record.type==='transition') {
    const {before,after}=record.payload as unknown as {before:MindSnapshot;after:MindSnapshot};
    const changed=<T extends {id:string}>(a:T[],b:T[])=>[...new Set([...a,...b].map(v=>v.id))].filter(id=>JSON.stringify(a.find(v=>v.id===id))!==JSON.stringify(b.find(v=>v.id===id))).length;
    const parts:string[]=[];
    const beliefs=changed(before.beliefs,after.beliefs), intentions=changed(before.intentions??[],after.intentions??[]), actions=changed(before.actions??[],after.actions??[]);
    if(beliefs)parts.push(`${beliefs} belief${beliefs===1?'':'s'} changed`);
    if(intentions)parts.push(`${intentions} intention${intentions===1?'':'s'} changed`);
    if(actions) {const action=after.actions?.find(v=>JSON.stringify(v)!==JSON.stringify(before.actions?.find(old=>old.id===v.id)));parts.push(action?`${action.candidate.capabilityId} → ${action.status}`:`${actions} actions changed`);}
    const deltas={moodDeltas:Object.fromEntries(Object.entries(after.mood).map(([n,v])=>[n,v.value-(before.mood[n]?.value??0)])),emotionDeltas:Object.fromEntries(Object.entries(after.emotions).map(([n,v])=>[n,v.value-(before.emotions[n]?.value??0)]))};
    if(affect(deltas)!=='Affect unchanged')parts.push(affect(deltas));
    const memories=after.memories.length-before.memories.length;if(memories)parts.push(`${memories>0?'+':''}${memories} ${Math.abs(memories)===1?'memory':'memories'}`);
    return parts.join(' · ')||'Cognitive state unchanged';
  }
  const stage=(record.payload as {stage?:string}).stage;
  if(stage==='belief-update') {const r=(record.payload as unknown as AppraisalCall).result as BeliefUpdateResult;const parts=r.beliefUpdates.map(b=>b.statement);if(r.beliefRetirements?.length)parts.push(`${r.beliefRetirements.length} beliefs retired or merged`);return parts.join(' · ')||'Beliefs unchanged';}
  if(stage==='emotional-appraisal') return affect((record.payload as unknown as AppraisalCall).result as EmotionalAppraisalResult);
  if(stage==='intention-generation') {const r=(record.payload as unknown as IntentionCall).result as GenerationResult;return r.candidates.length?`${r.candidates.length} candidates · ${r.candidates[0]!.description}`:'No strategy candidates proposed';}
  if(stage==='intention-evaluation') {const p=record.payload as unknown as IntentionCall;return `${(p.result as IntentionEvaluation).accept?'Accepted':'Rejected'} · ${(p.input as EvaluationContext).candidate.description}`;}
  if(stage==='intention-sufficiency')return (record.payload as unknown as {result:SufficiencyResult}).result.sufficient?'Current strategies are sufficient':'More strategies needed';
  if(stage==='intention-reconsideration') {const r=(record.payload as unknown as {result:ReconsiderationResult}).result;return `${r.revisions.length?r.revisions.map(v=>v.action).join(' · '):'Commitments preserved'}${r.generateMore?' · more strategies requested':''}`;}
  if(stage==='intention-summary'){const c=(record.payload as unknown as {cycle:IntentionCycle}).cycle;return `${c.stoppingReason.replaceAll('-',' ')} · ${c.acceptedIntentionIds.length} adopted`;}
  if(stage==='action-generation'){const r=(record.payload as unknown as {result:ActionGenerationResult}).result;return r.candidates.length?`${r.candidates.length} candidates · ${r.candidates[0]!.objective}`:'No action candidates proposed';}
  if(stage==='action-selection'){const p=record.payload as unknown as {input:ActionSelectionContext;result:ActionSelectionResult};return p.result.candidateId===null?'No action selected':`Selected · ${p.input.candidates.find(c=>c.id===p.result.candidateId)?.objective??p.result.candidateId}`;}
  if(stage==='action-expression')return (record.payload as unknown as {result:ActionExpressionResult}).result.speech;
  if(stage==='action-operation'){const o=(record.payload as unknown as {operation:ActionPlanOperation|ActionStatusOperation}).operation;return o.kind==='action-status'?`${o.status}${o.reason?` · ${o.reason}`:''}`:o.selection.candidateId===null?'No action proposed':`Proposed · ${o.generation.candidates.find(c=>c.id===o.selection.candidateId)?.objective??''}`;}
  const p=record.payload as unknown as {proposal?:CognitionProposal};return p.proposal?`${p.proposal.beliefUpdates.length} belief updates · ${affect(p.proposal)}`:'Recorded decision';
}
