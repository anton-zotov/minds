# Wall-clock timing

Playbox uses monotonic performance.now() measurements, independent from simulation time. Each actor step gets its own turn when running the bounded conversation. Queue waiting and idle time between retries are excluded; retry processing adds to the same turn.

Provider operation durations include awaited generation, judging, and expression requests. The runtime measures receipt preparation, memory insertion, and state/action commits. Initialization and intention summaries measure inspection preparation. Commit durations include trace and journal work; paired action-operation and transition records describe the same commit and are not additive. They are diagnostics, not cognitive state, and never enter model contexts or causal journals. Older recordings without telemetry show an em dash.

Playbox turn metadata retains turn durations on export. Per-record measurements are live diagnostics and are unavailable when restoring a causal journal.
