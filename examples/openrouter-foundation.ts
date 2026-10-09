import { createMind } from '@minds/core';
import { createOpenRouterProvider } from '@minds/core/openrouter';
import { exampleConfig } from './library-foundation.js';

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_APPRAISAL_MODEL;
if (!apiKey?.trim() || !model?.trim()) {
  console.error('Set OPENROUTER_API_KEY and OPENROUTER_APPRAISAL_MODEL in the server environment or local .env file.');
  process.exitCode = 1;
} else {
  try {
    const mind = createMind(exampleConfig(), createOpenRouterProvider({ apiKey, model }));
    await mind.ingest({ id: 'live-observation', time: 0, source: 'example-host', kind: 'speech',
      content: 'Our partner says they broke the agreement.' });
    console.log(JSON.stringify(mind.exportRecording(), null, 2));
  } catch (error) {
    // The adapter returns sanitized errors; never print request options or environment data.
    console.error(error instanceof Error ? error.message : 'OpenRouter example failed'); process.exitCode = 1;
  }
}
