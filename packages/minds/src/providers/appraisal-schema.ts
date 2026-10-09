import type { CognitionContext } from '../types.js';
export function appraisalSchema(context: CognitionContext): Record<string, unknown> {
  const exactObject = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  const deltas = (dimensions: string[]) => exactObject(Object.fromEntries(dimensions.map(name => [name, { type: 'number', description: 'Signed incremental change; use zero when unchanged.' }])));
  return exactObject({
    beliefUpdates: { type: 'array', items: exactObject({ id: { type: 'string' }, statement: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 }, evidenceIds: { type: 'array', items: { type: 'string' } } }) },
    moodDeltas: deltas(Object.keys(context.mind.mood)), emotionDeltas: deltas(Object.keys(context.mind.emotions)),
    explanation: { type: ['string', 'null'], description: 'Brief explanation for inspection, or null.' },
  });
}
