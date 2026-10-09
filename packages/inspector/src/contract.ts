import type { InspectionRecord, MindSnapshot } from '@minds/core';
export interface InspectionError { mindId: string; observationId: string; message: string }
export interface InspectionTurn {
  id: string;
  mindId: string;
  kind: 'initial' | 'event' | 'actionRequired';
  index: number;
  label: string;
  durationMs?: number;
  time: number;
  recordRanges: Record<string, { afterSequence: number; throughSequence: number }>;
  errors: InspectionError[];
}
export interface InspectionView {
  schemaVersion: 1;
  runId: string;
  time: number;
  status: 'ready' | 'pending' | 'failed';
  providerMode: 'fixture' | 'openrouter';
  minds: { snapshot: MindSnapshot; records: InspectionRecord[]; recordDurations?: Record<string, number> }[];
  errors: InspectionError[];
  world?: { balances: Record<string, number>; crates: Record<string, number>; offers: { id: string; ownerId: string; recipientId: string; price: number; status: string }[]; transaction: { actionId: string; offerId: string; price: number } | null; transcript: { id: string; speakerId: string; recipientId: string; speech: string }[]; turnCount: number; nextActorId: string; stopReason: string | null };
  /** Subjective event/action-request boundaries; time advancement is not a new turn. */
  turns?: InspectionTurn[];
}

