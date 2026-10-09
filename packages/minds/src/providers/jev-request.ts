import type { JsonValue, ProviderMetadata } from '../types.js';
import { object, keys, string, number, fail } from '../validation.js';
import { postJson, redact, type RequestOptions } from './openrouter-request.js';
export const JEV_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export type JevQuestion = { type: 'noul'; instructions: string; criteria: Record<string, string> } |
  { type: 'choice'; instructions: string; criteria: Record<string, string> } |
  { type: 'score'; instructions: string; criteria: string[] };
export interface JevAnswer { type: 'noul' | 'choice' | 'score'; noul?: number; choice?: string; score?: number; probabilities?: Record<string, number>; confidence?: number }
export interface JevResponse { answers: Record<string, JevAnswer>; metadata: ProviderMetadata }
export type JevRequestOptions = Pick<RequestOptions, 'apiKey' | 'model' | 'timeoutMs' | 'fetch'>;
function distribution(value: unknown, expected: string[]): asserts value is Record<string, number> {
  object(value, 'probabilities'); keys(value, expected, 'probabilities');
  for (const id of expected) number(value[id], 'probability', 0, 1);
  if (Math.abs(Object.values(value).reduce<number>((sum, p) => sum + (p as number), 0) - 1) > 0.02) fail('Probabilities must sum to one');
}
function validateAnswer(value: unknown, question: JevQuestion): asserts value is JevAnswer {
  object(value, 'Jev answer'); if (value.type !== question.type) fail('Wrong Jev answer type');
  if (question.type === 'noul') { keys(value, ['type', 'noul'], 'noul answer'); number(value.noul, 'noul probability', 0, 1); return; }
  if (question.type === 'choice') {
    keys(value, ['type', 'choice', 'confidence', 'probabilities'], 'choice answer'); string(value.choice, 'choice');
    if (!Object.hasOwn(question.criteria, value.choice)) fail('Unknown Jev choice');
    distribution(value.probabilities, Object.keys(question.criteria));
  } else {
    keys(value, ['type', 'score', 'confidence', 'probabilities', 'legend'], 'score answer');
    number(value.score, 'Jev score', 0, question.criteria.length - 1);
    const indices = question.criteria.map((_, index) => String(index)); distribution(value.probabilities, indices);
    if (value.legend !== undefined) {
      object(value.legend, 'score legend'); keys(value.legend, indices, 'score legend');
      for (const id of indices) if (value.legend[id] !== question.criteria[Number(id)]) fail('Score legend differs from requested rubric');
    }
  }
  if (value.confidence !== undefined) number(value.confidence, 'confidence', 0, 1);
}
export async function jevRequest(options: JevRequestOptions, state: unknown, questions: Record<string, JevQuestion>): Promise<JevResponse> {
  const request = { model: options.model, state, questions };
  return postJson(options, JEV_ENDPOINT, request, raw => {
    object(raw, 'Jev response'); if (Object.hasOwn(raw, 'error')) fail('Jev error response');
    string(raw.model, 'resolved model'); object(raw.answers, 'answers'); keys(raw.answers, Object.keys(questions), 'answers');
    for (const [id, question] of Object.entries(questions)) validateAnswer(raw.answers[id], question);
    object(raw.usage, 'usage'); const usage: Record<string, JsonValue> = {};
    for (const name of ['input_tokens', 'output_tokens', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'cost']) {
      if (raw.usage[name] !== undefined) { number(raw.usage[name], 'usage', 0); usage[name] = raw.usage[name]; }
    }
    if (raw.id !== undefined) string(raw.id, 'response ID'); if (raw.provider !== undefined) string(raw.provider, 'upstream provider');
    const parameters: Record<string, JsonValue> = { integration: 'jev', endpoint: JEV_ENDPOINT, requestedModel: options.model,
      timeoutMs: options.timeoutMs ?? 30_000, providerCalls: 1, request: redact(request, options.apiKey) as JsonValue,
      response: { model: raw.model, id: typeof raw.id === 'string' ? raw.id : null, provider: typeof raw.provider === 'string' ? raw.provider : null,
        answers: raw.answers as JsonValue, usage }, usage };
    if (typeof raw.id === 'string') parameters.responseId = raw.id;
    return { answers: structuredClone(raw.answers) as Record<string, JevAnswer>,
      metadata: { provider: 'openrouter', model: raw.model, explanation: null, parameters } };
  });
}
