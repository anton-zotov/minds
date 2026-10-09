import { createServer, type IncomingMessage } from 'node:http';
import { createOpenRouterProvider, isJevModel } from '@minds/core/openrouter';
import type { CognitionProvider } from '@minds/core';
import { createHost, InputError, type Injection } from './host.ts';
import { createFixtureProvider } from './scenario.ts';
interface Options { env?: Record<string, string | undefined>; providerFactory?: (mode: 'fixture' | 'openrouter') => CognitionProvider }
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  let data = ''; for await (const chunk of request) { data += chunk; if (data.length > 50000) throw new InputError('Request is too large.'); }
  if (!data.trim()) return {};
  try { const result: unknown = JSON.parse(data); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result as Record<string, unknown>; }
  catch { throw new InputError('Request must be a JSON object.'); }
}
export function createApiServer(options: Options = {}) {
  const env = options.env ?? process.env; const available = Boolean(env.OPENROUTER_API_KEY?.trim() && env.OPENROUTER_APPRAISAL_MODEL?.trim());
  const generationModel = env.OPENROUTER_INTENTION_GENERATION_MODEL?.trim() || env.OPENROUTER_GENERATIVE_MODEL?.trim() || env.OPENROUTER_APPRAISAL_MODEL!;
  const decisionModel = env.OPENROUTER_INTENTION_DECISION_MODEL?.trim() || env.OPENROUTER_DECISION_MODEL?.trim() || 'typesafe/jev-1.13';
  const baseDecisionModel = env.OPENROUTER_DECISION_MODEL?.trim() || 'typesafe/jev-1.13';
  const appraisalDecisionModel = env.OPENROUTER_APPRAISAL_DECISION_MODEL?.trim() || (isJevModel(decisionModel) ? decisionModel : isJevModel(baseDecisionModel) ? baseDecisionModel : 'typesafe/jev-1.13');
  const provider = (mode: 'fixture' | 'openrouter') => options.providerFactory ? options.providerFactory(mode) : mode === 'fixture' ? createFixtureProvider() : createOpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY!, model: env.OPENROUTER_APPRAISAL_MODEL!, intentions: true, actions: true, actionGenerationModel: env.OPENROUTER_ACTION_GENERATION_MODEL?.trim() || generationModel, actionDecisionModel: env.OPENROUTER_ACTION_DECISION_MODEL?.trim() || decisionModel, actionExpressionModel: env.OPENROUTER_ACTION_EXPRESSION_MODEL?.trim() || env.OPENROUTER_ACTION_GENERATION_MODEL?.trim() || generationModel,
    intentionGenerationModel: generationModel, intentionDecisionModel: decisionModel, appraisalDecisionModel });
  let serial = 1; let host = createHost(provider('fixture'), 'fixture', `playbox-${serial}`);
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.setHeader('Cache-Control', 'no-store');
    function send(status: number, result: unknown) { response.writeHead(status); response.end(JSON.stringify(result)); }
    // Mutations are local browser operations. Reject cross-origin requests.
    const origin = request.headers.origin;
    if (origin) {
      try { const parsed = new URL(origin); if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.port !== String(env.PLAYBOX_WEB_PORT ?? '5183')) { send(403, { error: 'Origin is not allowed.' }); return; } }
      catch { send(403, { error: 'Origin is not allowed.' }); return; }
    }
    try {
      const path = request.url?.split('?')[0];
      if (request.method === 'GET') {
        if (path === '/api/config') { send(200, { openrouterAvailable: available, model: available ? env.OPENROUTER_APPRAISAL_MODEL : null,
          appraisalDecisionModel: available ? appraisalDecisionModel : null,
          actionGenerationModel: available ? env.OPENROUTER_ACTION_GENERATION_MODEL?.trim() || generationModel : null, actionDecisionModel: available ? env.OPENROUTER_ACTION_DECISION_MODEL?.trim() || decisionModel : null, actionExpressionModel: available ? env.OPENROUTER_ACTION_EXPRESSION_MODEL?.trim() || env.OPENROUTER_ACTION_GENERATION_MODEL?.trim() || generationModel : null,
          intentionGenerationModel: available ? generationModel : null,
          intentionDecisionModel: available ? decisionModel : null,
          intentionDecisionEndpoint: available ? (isJevModel(decisionModel) ? 'decisions' : 'chat/completions') : null }); return; }
        if (path === '/api/run') { send(200, host.getView()); return; }
        if (path === '/api/status') { send(200, host.getStatus()); return; }
        if (path === '/api/recording') {
          if (host.getStatus().status === 'pending') { send(409, { error: 'Wait for the pending operation to finish.' }); return; }
          response.setHeader('Content-Disposition', `attachment; filename="${host.getStatus().runId}.json"`);
          const compact = new URL(request.url!, 'http://localhost').searchParams.get('format') === 'compact';
          send(200, compact ? host.exportCompactRecording() : host.exportRecording()); return;
        }
      }
      if (request.method === 'POST') {
        const input = await body(request);
        if (path === '/api/run') {
          if (host.getStatus().status === 'pending') { send(409, { error: 'Wait for the pending operation before resetting.' }); return; }
          const mode = input.mode; if (mode !== 'fixture' && mode !== 'openrouter') throw new InputError('Choose fixture or OpenRouter mode.');
          if (mode === 'openrouter' && !available) throw new InputError('Configure OPENROUTER_API_KEY and OPENROUTER_APPRAISAL_MODEL in the server environment.');
          host = createHost(provider(mode), mode, `playbox-${++serial}`); send(200, host.getView()); return;
        }
        if (path === '/api/conversation') { send(200, await host.runConversation()); return; }
        if (path === '/api/step') { send(200, await host.step()); return; }
        if (path === '/api/advance') { send(200, await host.advanceTime()); return; }
        if (path === '/api/inject') { send(200, await host.inject(input as unknown as Injection)); return; }
        if (path === '/api/retry') { send(200, await host.retry()); return; }
      }
      send(404, { error: 'Endpoint not found.' });
    } catch (error) { send(error instanceof InputError ? 400 : 500, { error: error instanceof InputError ? error.message : 'Operation failed. Check server configuration and try again.' }); }
  });
}




