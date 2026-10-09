import type { JsonValue, ProviderMetadata } from '../types.js';
import { object, string, number, integer, keys } from '../validation.js';
export interface RequestOptions { apiKey: string; model: string; fetch?: typeof globalThis.fetch; timeoutMs?: number; temperature?: number; maxTokens?: number }
export class OpenRouterError extends Error {
  constructor(public readonly code: 'http' | 'timeout' | 'network' | 'response', public readonly status: number | null = null) {
    super(`OpenRouter ${code} failure${status === null ? '' : ` (${status})`}`); this.name = 'OpenRouterError';
  }
}
export function validateOptions(options: RequestOptions): void {
  string(options.apiKey, 'API key'); string(options.model, 'model');
  number(options.timeoutMs ?? 30_000, 'timeout', 1, 2_147_483_647);
  if (options.temperature !== undefined) number(options.temperature, 'temperature', 0, 2);
  integer(options.maxTokens ?? 2000, 'maxTokens', 1);
  if (typeof (options.fetch ?? globalThis.fetch) !== 'function') throw new TypeError('Fetch implementation required');
}
export function redact(value: unknown, secret: string): unknown {
  if (typeof value === 'string') return value.split(secret).join('[REDACTED]');
  if (Array.isArray(value)) return value.map(item => redact(item, secret));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.split(secret).join('[REDACTED]'), redact(item, secret)]));
  return value;
}
// Shared transport for chat and typed Decisions, including response-body timeouts.
export async function postJson<T>(options: Pick<RequestOptions, 'apiKey' | 'fetch' | 'timeoutMs'>, endpoint: string,
  body: unknown, parse: (raw: unknown) => T): Promise<T> {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { reject(new OpenRouterError('timeout')); controller.abort(); }, options.timeoutMs ?? 30_000);
  });
  async function request(): Promise<T> {
    let response: Response;
    try {
      response = await (options.fetch ?? globalThis.fetch)(endpoint, { method: 'POST',
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify(body) });
    } catch { throw new OpenRouterError('network'); }
    if (!response.ok) throw new OpenRouterError('http', response.status);
    try { return parse(redact(await response.json(), options.apiKey)); }
    catch { throw new OpenRouterError('response'); }
  }
  try { return await Promise.race([request(), timeout]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
export async function structuredRequest<T>(options: RequestOptions, operation: {
  name: string; prompt: string; context: unknown; schema: unknown; fields: string[]; validate: (output: unknown) => void;
}): Promise<T> {
  // Strict structured outputs reject quote-bearing string enum literals.
  // IDs remain in the context and every operation validates returned membership.
  function compatibleSchema(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(compatibleSchema);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key, item]) =>
      key !== 'enum' || !Array.isArray(item) || !item.some(v => typeof v === 'string' && v.includes('"'))
    ).map(([key, item]) => [key, compatibleSchema(item)]));
  }
  const { apiKey, model } = options; const timeoutMs = options.timeoutMs ?? 30_000, maxTokens = options.maxTokens ?? 2000;
    const requestBody = { model, ...(options.temperature === undefined ? {} : { temperature: options.temperature }), max_tokens: maxTokens,
      stream: false, provider: { require_parameters: true }, messages: [{ role: 'system', content: operation.prompt }, { role: 'user', content: JSON.stringify(operation.context) }],
      response_format: { type: 'json_schema', json_schema: { name: operation.name, strict: true, schema: compatibleSchema(operation.schema) } } };
    return postJson(options, 'https://openrouter.ai/api/v1/chat/completions', requestBody, raw => {
      object(raw, 'response');
      if (Object.hasOwn(raw, 'error') || !Array.isArray(raw.choices) || raw.choices.length !== 1) throw new OpenRouterError('response');
      const choice: unknown = raw.choices[0]; object(choice, 'choice');
      if (choice.finish_reason !== 'stop') throw new OpenRouterError('response');
      object(choice.message, 'message'); string(choice.message.content, 'content');
      const output: unknown = redact(JSON.parse(choice.message.content), apiKey); object(output, 'operation output');
      keys(output, [...operation.fields, 'explanation'], 'operation output');
      if (output.explanation !== null && typeof output.explanation !== 'string') throw new OpenRouterError('response');
      const parameters: Record<string, JsonValue> = { requestedModel: model, maxTokens, timeoutMs,
        request: redact(requestBody, apiKey) as JsonValue,
        response: { id: typeof raw.id === 'string' ? raw.id : null, model: typeof raw.model === 'string' ? raw.model : null,
          choices: [{ message: { content: JSON.stringify(output) }, finish_reason: 'stop' }] } };
      if (options.temperature !== undefined) parameters.temperature = options.temperature;
      if (typeof raw.id === 'string') parameters.responseId = raw.id;
      if (raw.usage && typeof raw.usage === 'object' && !Array.isArray(raw.usage)) {
        const usage: Record<string, JsonValue> = {};
        for (const name of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'cost']) {
          const value = (raw.usage as Record<string, unknown>)[name];
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0) usage[name] = value;
        }
        parameters.usage = usage;
      }
      const metadata: ProviderMetadata = { provider: 'openrouter', model: typeof raw.model === 'string' ? raw.model : model,
        explanation: output.explanation as string | null, parameters };
      const result = redact({ ...Object.fromEntries(operation.fields.map(field => [field, output[field]])), metadata }, apiKey);
      operation.validate(result); return result as T;
    });
}
