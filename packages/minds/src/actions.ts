import { measuredRecordDurations } from './timing.js';
import type {
  ActionContext, ActionSelectionContext, ActionExpressionContext, ActionOpportunity, ActionGenerationResult, ActionSelectionResult, ActionExpressionResult, ActionPlanOperation, ActionStatusOperation, MindSnapshot, MindAction, InspectionRecord, JsonValue
}
from './types.js';
import {
  json, object, keys, string, strings, number, fail, validateMetadata
}
from './validation.js';
import {
  transitionPayload
}
from './inspection.js';
export function validateActionOpportunity(value: unknown, time: number): asserts value is ActionOpportunity {
  json(value);
  object(value,'opportunity');
  keys(value,['id','time','capabilities'],'opportunity');
  string(value.id,'opportunity ID');
  number(value.time,'opportunity time',time,time);
  if (!Array.isArray(value.capabilities) || value.capabilities.length>32) fail('Capabilities must be bounded to 32');
  const ids=new Set<string>();
  for(const c of value.capabilities){
    object(c,'capability');
    keys(c,['id','description','targets','parameters','expression'],'capability');
    string(c.id,'capability ID');
    string(c.description,'capability description');
    if(ids.has(c.id))fail('Duplicate capability');
    ids.add(c.id);
    strings(c.targets,'targets');
    if(c.targets.length>32)fail('Too many targets');
    if(!['speech','none'].includes(c.expression as string))fail('Invalid expression');
    if(!Array.isArray(c.parameters)||c.parameters.length>32)fail('Invalid parameters');
    const names=new Set<string>();
    for(const p of c.parameters){
      object(p,'parameter');
      keys(p,['name','type','description','enum','min','max'],'parameter');
      string(p.name,'parameter name');
      string(p.description,'parameter description');
      if(names.has(p.name))fail('Duplicate parameter');
      names.add(p.name);
      if(p.type==='string'){
        if(p.min!==undefined||p.max!==undefined)fail('String bounds invalid');
        if(p.enum!==undefined){
          strings(p.enum,'enum');
          if(!p.enum.length)fail('Empty enum');
        }
      }
      else if(p.type==='number'){
        if(p.enum!==undefined)fail('Numeric enum invalid');
        if(p.min!==undefined)number(p.min,'min');
        if(p.max!==undefined)number(p.max,'max');
        if(p.min!==undefined&&p.max!==undefined&&(p.min as number)>(p.max as number))fail('Invalid bounds');
      }
      else fail('Invalid parameter type');
    }
  }
}
export function validateActionResult(stage:'action-generation'|'action-selection'|'action-expression',value:unknown,context:ActionContext|ActionSelectionContext|ActionExpressionContext):void {
  json(value);
  object(value,'action result');
  validateMetadata(value.metadata);
  if(stage==='action-generation'){
    keys(value,['candidates','metadata'],'generation');
    if(!Array.isArray(value.candidates)||value.candidates.length>6)fail('Candidates exceed limit 6');
    const ids=new Set<string>();
    for(const c of value.candidates){
      object(c,'candidate');
      keys(c,['id','capabilityId','targetId','intentionId','objective','parameters'],'candidate');
      string(c.id,'candidate ID');
      string(c.capabilityId,'capability ID');
      string(c.objective,'objective');
      if(ids.has(c.id))fail('Duplicate candidate');
      ids.add(c.id);
      const cap=context.opportunity.capabilities.find(x=>x.id===c.capabilityId);
      if(!cap)fail('Unknown capability');
      if(cap.targets.length ? !cap.targets.includes(c.targetId as string):c.targetId!==null)fail('Target not allowed');
      if(c.intentionId!==null&&!context.mind.intentions?.some(i=>i.id===c.intentionId&&i.status==='active'))fail('Unknown active intention');
      object(c.parameters,'candidate parameters');
      keys(c.parameters,cap.parameters.map(p=>p.name),'candidate parameters');
      for(const p of cap.parameters){
        const v=c.parameters[p.name];
        if(p.type==='string'){
          if(typeof v!=='string'||(p.enum&&!p.enum.includes(v)))fail('Invalid string parameter');
        }
        else number(v,p.name,p.min,p.max);
      }
    }
  }
  else if(stage==='action-selection'){
    keys(value,['candidateId','scores','metadata'],'selection');
    const candidates=(context as ActionSelectionContext).candidates;
    if(value.candidateId!==null&&!candidates.some(c=>c.id===value.candidateId))fail('Unknown selected candidate');
    if(!Array.isArray(value.scores)||value.scores.length!==candidates.length)fail('Missing candidate scores');
    const ids=new Set<string>();
    for(const score of value.scores){
      object(score,'score');
      keys(score,['candidateId','score'],'score');
      if(!candidates.some(c=>c.id===score.candidateId)||ids.has(score.candidateId as string))fail('Invalid scored candidate');
      ids.add(score.candidateId as string);
      number(score.score,'score',0,1);
    }
  }
  else {
    keys(value,['speech','metadata'],'expression');
    string(value.speech,'speech');
    if(value.speech.length>2000)fail('Speech exceeds 2000 characters');
  }
}
export function actionContext(mind:MindSnapshot,opportunity:ActionOpportunity):ActionContext{
  const memories=mind.memories.slice(-20);
  return structuredClone({
    mind:{
      ...mind,memories
    },memories,opportunity
  });
}
export function applyActionOperation(state:MindSnapshot,entry:ActionPlanOperation|ActionStatusOperation):MindAction|null {
  if(entry.kind==='action-plan'){
    keys(entry as unknown as Record<string,unknown>,['kind','opportunity','generation','selection','expression'],'action plan');
    validateActionOpportunity(entry.opportunity,state.time);
    const context=actionContext(state,entry.opportunity);
    validateActionResult('action-generation',entry.generation,context);
    validateActionResult('action-selection',entry.selection,{
      ...context,candidates:entry.generation.candidates
    });
    const candidate=entry.generation.candidates.find(c=>c.id===entry.selection.candidateId);
    let action:MindAction|null=null;
    if(candidate){
      const cap=entry.opportunity.capabilities.find(c=>c.id===candidate.capabilityId)!;
      if(cap.expression==='speech'){
        if(!entry.expression)fail('Missing speech');
        validateActionResult('action-expression',entry.expression,{
          ...context,candidate
        });
      }
      else if(entry.expression!==undefined)fail('Unexpected expression');
      action={
        id:JSON.stringify(['action',state.config.runId,state.config.mindId,entry.opportunity.id]),opportunityId:entry.opportunity.id,candidate:structuredClone(candidate),expression:entry.expression?.speech??null,status:'proposed',reason:null
      };
      (state.actions??=[]).push(action);
    }
    else if(entry.expression!==undefined)fail('No action cannot express');
    state.actions??=[];
    state.schemaVersion=8;
    state.revision++;
    return action;
  }
  keys(entry as unknown as Record<string,unknown>,['kind','actionId','status','reason'],'action status');
  string(entry.actionId,'action ID');
  if(entry.reason!==null&&typeof entry.reason!=='string')fail('Invalid reason');
  const action=state.actions?.find(a=>a.id===entry.actionId);
  if(!action)fail('Unknown action');
  if(entry.status==='submitted'){
    if(action.status!=='proposed'||entry.reason!==null)fail('Action cannot submit');
  }
  else if(['executed','rejected'].includes(entry.status)){
    if(action.status!=='submitted')fail('Action must be submitted');
  }
  else fail('Invalid action status');
  action.status=entry.status;
  action.reason=entry.reason;
  state.schemaVersion=8;
  state.revision++;
  return action;
}
export function buildActionRecords(before:MindSnapshot,after:MindSnapshot,start:number,entry:ActionPlanOperation|ActionStatusOperation):InspectionRecord[]{
  const out:InspectionRecord[]=[];
  const add=(type:InspectionRecord['type'],payload:unknown)=>{
    const started = performance.now();
    const sequence=start+out.length;
    const {
      runId,mindId
    }
    =after.config;
    out.push({
      schemaVersion:8,id:JSON.stringify([runId,mindId,sequence]),runId,mindId,sequence,revision:after.revision,time:after.time,type,observationId:null,causeIds:out.length?[out[out.length-1]!.id]:[],payload:structuredClone(payload) as JsonValue
    });
    measuredRecordDurations.set(out[out.length-1]!, performance.now() - started);
  };
  if(entry.kind==='action-plan'){
    const context=actionContext(before,entry.opportunity);
    add('decision',{
      stage:'action-generation',input:context,result:entry.generation
    });
    add('decision',{
      stage:'action-selection',input:{
        ...context,candidates:entry.generation.candidates
      },result:entry.selection
    });
    if(entry.expression)add('decision',{
      stage:'action-expression',input:{
        ...context,candidate:entry.generation.candidates.find(c=>c.id===entry.selection.candidateId)
      },result:entry.expression
    });
  }
  add('decision',{
    stage:'action-operation',operation:entry
  });
  add('transition',transitionPayload(before,after));
  return out;
}
