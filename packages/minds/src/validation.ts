import type { AffectDimension, Belief, MindConfig, Observation, LegacyObservation, RecordedObservation, CognitionProposal, MindSnapshot } from './types.js';

export function fail(message: string): never { throw new TypeError(message); }
export function object(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be a plain object`);
}
export function string(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a nonempty string`);
}
export function number(value: unknown, label: string, min = -Infinity, max = Infinity): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${label} is out of range`);
}
export function integer(value: unknown, label: string, min = 0): asserts value is number {
  number(value, label, min, Number.MAX_SAFE_INTEGER); if (!Number.isSafeInteger(value)) fail(`${label} must be an integer`);
}
export function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail(`${label} contains unsupported fields`);
}
export function json(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { number(value, 'JSON number'); return; }
  if (!value || typeof value !== 'object') fail('Value must be JSON-compatible');
  if (seen.has(value)) fail('JSON cannot contain cycles'); seen.add(value);
  if (!Array.isArray(value)) object(value, 'JSON object');
  else {
    const indices = Object.keys(value);
    if (indices.length !== value.length || indices.some(key => !Number.isInteger(Number(key)) || Number(key) < 0 || Number(key) >= value.length || String(Number(key)) !== key)) fail('JSON arrays must be dense and have no extra properties');
  }
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if ('get' in descriptor || 'set' in descriptor) fail('JSON cannot contain accessors');
    if (!descriptor.enumerable && !(Array.isArray(value) && name === 'length')) fail('JSON fields must be enumerable');
    if (descriptor.enumerable) json(descriptor.value, seen);
  }
  if (Object.getOwnPropertySymbols(value).length) fail('JSON cannot contain symbol properties');
  seen.delete(value);
}
export function strings(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  for (const entry of value) string(entry, label);
  if (new Set(value).size !== value.length) fail(`${label} contains duplicate IDs`);
}
export function beliefs(value: unknown, evidence: Set<string>): asserts value is Belief[] {
  if (!Array.isArray(value)) fail('beliefs must be an array'); const ids = new Set<string>();
  for (const entry of value) {
    object(entry, 'belief'); keys(entry, ['id', 'statement', 'confidence', 'evidenceIds'], 'belief');
    string(entry.id, 'belief ID'); string(entry.statement, 'belief statement'); number(entry.confidence, 'confidence', 0, 1);
    strings(entry.evidenceIds, 'evidence IDs');
    if (entry.evidenceIds.some(id => !evidence.has(id))) fail('Unknown belief evidence');
    if (ids.has(entry.id)) fail('Duplicate belief ID'); ids.add(entry.id);
  }
}
export function affect(value: unknown): asserts value is Record<string, AffectDimension> {
  object(value, 'affect');
  for (const [name, dimension] of Object.entries(value)) {
    string(name, 'affect dimension'); object(dimension, 'affect dimension'); keys(dimension, ['baseline', 'value', 'halfLifeMs'], 'affect dimension');
    number(dimension.baseline, 'baseline', 0, 1); number(dimension.value, 'affect value', 0, 1);
    number(dimension.halfLifeMs, 'half-life'); if (dimension.halfLifeMs <= 0) fail('half-life must be positive');
  }
}
export function validateConfig(value: unknown): asserts value is MindConfig {
  json(value); object(value, 'configuration'); keys(value, ['runId', 'mindId', 'identity', 'goal', 'time', 'beliefs', 'mood', 'emotions', 'intentionPolicy'], 'configuration');
  string(value.runId, 'run ID'); string(value.mindId, 'Mind ID'); string(value.goal, 'goal'); number(value.time, 'time', 0);
  object(value.identity, 'identity'); keys(value.identity, ['name', 'description'], 'identity'); string(value.identity.name, 'name'); string(value.identity.description, 'description');
  beliefs(value.beliefs, new Set()); affect(value.mood); affect(value.emotions);
  if (value.intentionPolicy !== undefined) {
    object(value.intentionPolicy, 'intention policy'); keys(value.intentionPolicy, ['maxCandidates', 'maxEvaluations', 'maxActive', 'seed'], 'intention policy');
    for (const name of ['maxCandidates', 'maxEvaluations', 'maxActive']) {
      integer(value.intentionPolicy[name], name, 1); number(value.intentionPolicy[name], name, 1, name === 'maxActive' ? 8 : 32);
    }
    integer(value.intentionPolicy.seed, 'seed'); number(value.intentionPolicy.seed, 'seed', 0, 0xffffffff);
  }
}
export function validateObservation(value: unknown): asserts value is Observation {
  json(value); object(value, 'observation'); keys(value, ['id', 'time', 'source', 'kind', 'content'], 'observation');
  observationFields(value);
}
function observationFields(value: Record<string, unknown>): void {
  for (const name of ['id', 'source', 'kind', 'content']) string(value[name], name);
  number(value.time, 'time', 0);
}
export function validateLegacyObservation(value: unknown): asserts value is LegacyObservation {
  json(value); object(value, 'observation'); keys(value, ['id', 'time', 'source', 'kind', 'content', 'provenance', 'processing', 'intentionCompletions'], 'observation');
  observationFields(value);
  if (!['witnessed', 'reported'].includes(value.provenance as string)) fail('Invalid provenance');
  if (!['appraise', 'memoryOnly'].includes(value.processing as string)) fail('Invalid processing mode');
  if (value.intentionCompletions !== undefined) {
    strings(value.intentionCompletions, 'intention completion IDs');
    if (!value.intentionCompletions.length) fail('Completion confirmation requires at least one intention');
  }
}
export function isLegacyObservation(observation: RecordedObservation): observation is LegacyObservation { return 'processing' in observation; }
export function validateRecordedObservation(value: unknown, allowNew: boolean, current: MindSnapshot): asserts value is RecordedObservation {
  object(value, 'observation');
  if ('processing' in value) {
    if ([6,8].includes(current.schemaVersion)) fail('Legacy controls cannot follow self-driven events');
    validateLegacyObservation(value);
  } else {
    if (!allowNew) fail('Legacy recording requires legacy observation');
    validateObservation(value);
  }
}
export function validateProposal(value: unknown, state: MindSnapshot): asserts value is CognitionProposal {
  json(value); object(value, 'proposal'); keys(value, ['beliefUpdates', 'beliefRetirements', 'moodDeltas', 'emotionDeltas', 'metadata'], 'proposal');
  beliefs(value.beliefUpdates, new Set(state.memories.map(memory => memory.id)));
  if (value.beliefRetirements !== undefined) {
    if (!Array.isArray(value.beliefRetirements) || value.beliefRetirements.length > 32) fail('Invalid belief retirements');
    const retired=new Set<string>(), updates=new Set((value.beliefUpdates as Belief[]).map(b=>b.id));
    for(const retirement of value.beliefRetirements){
      object(retirement,'belief retirement');keys(retirement,['id','evidenceIds','supersededBy'],'belief retirement');string(retirement.id,'retired belief ID');strings(retirement.evidenceIds,'retirement evidence');
      if(retired.has(retirement.id)||updates.has(retirement.id)||!state.beliefs.some(b=>b.id===retirement.id))fail('Unknown, repeated or conflicting retirement');retired.add(retirement.id);
      if(!retirement.evidenceIds.length||!retirement.evidenceIds.includes(state.memories.at(-1)?.id??'')||retirement.evidenceIds.some(id=>!state.memories.some(m=>m.id===id)))fail('Retirement requires current known evidence');
      if(retirement.supersededBy!==null){string(retirement.supersededBy,'replacement belief ID');if(!updates.has(retirement.supersededBy))fail('Retirement replacement must be updated in the same operation');}
    }
  }
  for (const [field, dimensions] of [['moodDeltas', state.mood], ['emotionDeltas', state.emotions]] as const) {
    object(value[field], field);
    for (const [name, delta] of Object.entries(value[field])) {
      if (!Object.hasOwn(dimensions, name)) fail('Unknown affect dimension'); number(delta, 'affect delta');
    }
  }
  validateMetadata(value.metadata);
}
export function validateMetadata(value: unknown): void {
  json(value); object(value, 'metadata'); keys(value, ['provider', 'model', 'explanation', 'parameters'], 'metadata');
  string(value.provider, 'provider');
  if (value.model !== null) string(value.model, 'model');
  if (value.explanation !== null && typeof value.explanation !== 'string') fail('Invalid explanation');
  object(value.parameters, 'parameters');
}

