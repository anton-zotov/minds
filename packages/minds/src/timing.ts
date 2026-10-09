import type { InspectionRecord } from "./types.js";
/** Ephemeral trace-operation timing; never included in causal payloads. */
export const measuredRecordDurations = new WeakMap<InspectionRecord, number>();
