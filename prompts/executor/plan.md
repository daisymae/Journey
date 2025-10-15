# Journey Executor Implementation Plan

This plan translates the requirements in prompts/executor/requirements.md into concrete, incremental implementation steps aligned with the current repository’s structure and coding style.

Current repo snapshot (relevant components):
- src/services/nodeProcessor.ts — MESSAGE/DELAY/CONDITIONAL processing with logging and setTimeout scheduling callback.
- src/services/journeyEngine.ts — In-memory execution loop starting from start_node_id (no persistence).
- src/services/messageService.ts — Stubbed message sender (console log).
- src/models/Journey.ts, src/models/Node.ts, src/models/Patient.ts — Mongoose models for core entities (no run persistence yet).
- src/controllers/journeyController.ts — CRUD + POST /api/journeys/:id/start (fires in-memory engine, returns { status: 'started' }).
- src/index.ts — Express app + error handling + DB wiring.
- src/types/index.ts — Journey, PatientContext, and node types.

Goal: Add a persistent, resumable Journey Executor that:
- Persists run state (JourneyRun) and execution log in MongoDB.
- Supports DELAY nodes via setTimeout and resume after wake up.
- Provides API to start/resume/query/list/cancel runs.
- Boots with recovery: resumes overdue waiting runs.


## 1) Data and Type Layer

1.1 Add TypeScript shared types
- File: src/types/index.ts
- Add interfaces aligning with requirements:
  - ExecutionLogEntry { timestamp: string; nodeId: string; nodeType: 'MESSAGE'|'DELAY'|'CONDITIONAL'; action: string; details?: unknown }
  - JourneyRun { runId: string; journeyId: string; patientId: string; currentNodeId: string | null; status: 'active'|'waiting'|'completed'|'failed'; wakeUpAt: string | null; startedAt: string; completedAt: string | null; executionLog: ExecutionLogEntry[]; errorMessage?: string }

1.2 Add Mongoose model for JourneyRun
- File: src/models/JourneyRun.ts (new)
- Schema fields mirror JourneyRun interface. Notes:
  - runId: string, unique index.
  - journeyId: string (ref by value to Journey.id).
  - patientId: string (ref by value to Patient.id).
  - status: enum('active','waiting','completed','failed').
  - wakeUpAt: Date | null (store as Date, serialize to ISO string in toJSON transform).
  - startedAt: Date, completedAt: Date | null (same serialization behavior).
  - executionLog: array of subdocs with timestamp (Date), nodeId, nodeType, action, details (Mixed).
  - errorMessage?: string.
- Indexes:
  - { runId: 1 } unique.
  - { patientId: 1, status: 1, wakeUpAt: 1 } to support queries for listing and recovery.

1.3 Serialization
- Use schema toJSON transform to emit id-less document and convert Dates to ISO strings to match the required interface (wakeUpAt/startedAt/completedAt as ISO).


## 2) Executor Service

Create a new service encapsulating persistence, scheduling, and orchestration.
- File: src/services/journeyExecutor.ts (new)

2.1 Public API (as per requirements)
- startJourney(journeyId: string, patientId: string): Promise<JourneyRun>
- resumeJourney(runId: string): Promise<void>
- getRunStatus(runId: string): Promise<JourneyRun>
- getPatientRuns(patientId: string, status?: JourneyRun['status']): Promise<JourneyRun[]>
- cancelRun(runId: string): Promise<void>
- Optional bootstrap helpers:
  - recoverDueRuns(): Promise<void> — find waiting runs with wakeUpAt <= now and resume them.
  - stopAllTimers(): void — for clean shutdown/tests.

2.2 Internal components
- Timers registry: Map<string /*runId*/, NodeJS.Timeout> to track scheduled wake-ups; clear on cancel/complete/fail.
- Logging helper: prefix logs with [RUN:<runId>] and node type tags.
- Persistence helpers:
  - appendLog(runId, entry): atomic update using $push and $set as needed.
  - setStatus(runId, status, patch): atomic $set with status updates, currentNodeId, wakeUpAt timestamps, errorMessage, completedAt.

2.3 Execution loop (persistent)
- load journey by journeyId and build node map (reuse logic from journeyEngine or inline similar validation where appropriate).
- processing algorithm:
  - while (currentNodeId != null):
    - load node from map; if missing -> fail run (status 'failed', errorMessage) and break.
    - write execution log entry for entering node.
    - switch on node.type:
      - MESSAGE:
        - log action via messageService (already stubbed) and append execution log.
        - set currentNodeId = next_node_id; persist.
      - DELAY:
        - compute wakeUpAt = now + duration_seconds*1000.
        - persist: status='waiting', wakeUpAt, currentNodeId = node.next_node_id.
        - schedule setTimeout(() => resumeJourney(runId), durationMs) and store timer.
        - log [DELAY] entry and EXIT the loop (do not continue synchronously).
      - CONDITIONAL:
        - evaluate condition with existing evaluateCondition(node.condition, patientCtx).
        - log evaluation outcome.
        - set currentNodeId to on_true_next_node_id or on_false_next_node_id; persist.
  - when currentNodeId becomes null -> set status='completed', completedAt=now; clear timer if any; log [COMPLETE].
- Error handling (around the whole loop): catch exceptions, set status='failed', completedAt=now, errorMessage=err.message; clear timer; log [ERROR].

2.4 startJourney implementation
- Validate Journey exists; validate Patient exists; build PatientContext from PatientDoc.
- Create run with:
  - runId: uuid v4
  - journeyId, patientId
  - currentNodeId = journey.start_node_id
  - status = 'active'
  - startedAt = now
  - wakeUpAt = null, completedAt = null, executionLog = []
- Persist and then call internal process(run) asynchronously (no await for long-running loop, but method returns created run after creation + first state write).
- Ensure any thrown errors during immediate startup update the run to 'failed' before rethrowing/returning.

2.5 resumeJourney implementation
- Load run by runId; if not found -> no-op error through controller (404).
- If status !== 'waiting' -> ignore or 409; controller will translate.
- Reset status='active', wakeUpAt=null; persist and proceed with processing from currentNodeId.

2.6 getRunStatus / getPatientRuns / cancelRun
- getRunStatus: fetch by runId; 404 if not found.
- getPatientRuns: filter by patientId; optional status filter; sort by startedAt desc.
- cancelRun: if active or waiting, clear timer if present, set status='failed', completedAt=now, errorMessage='Cancelled by user'.
  - Note: Requirements don’t define 'cancelled' status; use 'failed' with errorMessage to remain compliant.

2.7 Recovery on startup
- recoverDueRuns(): query JourneyRun where status='waiting' and wakeUpAt <= now, and for each call resumeJourney(runId). Log summary.
- Wire this into server startup after successful DB connection.


## 3) Controllers and Routes

3.1 Runs controller
- File: src/controllers/runController.ts (new)
- Handlers:
  - POST /api/journeys/:journeyId/start { patientId }: returns JourneyRun from executor.startJourney.
    - Replace existing startJourney in journeyController.ts to delegate to executor and return the created run (instead of { status: 'started' }).
    - Validate body includes patientId or allow extending later; current repo already supports passing inline patient context, but executor will use persisted Patient by id.
  - POST /api/runs/:runId/resume → executor.resumeJourney
  - GET /api/runs/:runId → executor.getRunStatus
  - GET /api/patients/:patientId/runs[?status=...] → executor.getPatientRuns
  - DELETE /api/runs/:runId → executor.cancelRun
- Use try/catch and delegate errors to errorHandler; return JSON in standard format.

3.2 Runs routes
- File: src/routes/runs.ts (new)
- Wire endpoints above.

3.3 Register routes
- File: src/index.ts
  - import runRoutes and app.use('/api', runRoutes) or app.use('/api/runs', runsRouter) depending on structure:
    - If routes/runs.ts defines router mounted at '/runs', use app.use('/api', runsRouter) with absolute paths inside.
    - Or simpler: app.use('/api', journeysRouter) already exists; we’ll add `app.use('/api', runsRouter)` and define the full paths in the runs router.
- Update journey start route
  - Keep POST /api/journeys/:id/start in routes/journeys.ts but replace controller logic to call executor.startJourney and return JourneyRun.


## 4) Integration with Existing Services

4.1 Reuse nodeProcessor
- Use evaluateCondition and process node-specific side effects.
- For DELAY node, do not rely on nodeProcessor to schedule next directly; instead, executor will drive scheduling to make sure persistence happens first. Two approaches:
  - A) Keep nodeProcessor for evaluation and logging, but handle DELAY persistence + setTimeout in the executor (recommended).
  - B) Supply a scheduler wrapper that first writes run state and then triggers resume; still requires executor integration.
- Plan adopts (A): executor inspects node types and orchestrates, leveraging evaluateCondition and message sending.

4.2 Validation
- Continue to rely on Journey model validation and middleware/validation.ts for API input.
- Executor will defensively validate node references when building the node map (similar to journeyEngine.validateJourney) to fail fast.


## 5) Logging and Observability

- All executor logs are prefixed with [RUN:<runId>] and include node type:
  - [RUN:abc123] [MESSAGE] Sending message to patient p456: "..."
  - [RUN:abc123] [DELAY] Waiting 3600 seconds before next node
  - [RUN:abc123] [CONDITIONAL] Evaluating patient.age > 65 = true
  - [RUN:abc123] [RESUME] Journey resumed after delay
  - [RUN:abc123] [COMPLETE] Journey completed successfully
- ExecutionLogEntry mirrors these events with timestamps and details for auditing.


## 6) Error Handling

- Wrap processing in try/catch; on error:
  - Update run: status='failed', completedAt=now, errorMessage=err.message.
  - Append execution log entry with action='ERROR' and details.
  - Log console error with [RUN:<runId>] prefix and context.
- Controllers should map not-found and conflict states to appropriate HTTP codes (404, 409) and pass through to errorHandler for consistent JSON error format.


## 7) Startup and Shutdown Hooks

- Startup (in src/index.ts after DB connect): await executor.recoverDueRuns().
- Shutdown: optionally clear timers via executor.stopAllTimers() in server close callback to avoid dangling timeouts during tests/shutdown.


## 8) Testing Plan

8.1 Unit tests
- src/tests/services/nodeProcessor.test.ts — already present: extend/add to assert evaluateCondition operators and edge cases.
- New tests for executor internals (mock DB with in-memory Mongo or jest mocks):
  - State transitions: active → waiting (after DELAY) → active (on resume) → completed.
  - Error handling: missing node; invalid operator.
  - Cancel behavior: sets status to 'failed' with errorMessage; clears timers.

8.2 Integration tests (with supertest)
- Start Journey: POST /api/journeys/:id/start returns JourneyRun; verify DB state fields and logs appended.
- Delayed path: MESSAGE → DELAY → MESSAGE using a short delay (e.g., 10ms) with fake timers (jest.useFakeTimers) to assert wake-up resumes and completes.
- Conditional branching: true and false paths by varying patient age.
- List Patient Runs: GET /api/patients/:id/runs with and without status filter.
- Get Run Status: GET /api/runs/:runId reflects live changes.
- Resume endpoint: POST /api/runs/:runId/resume works only from 'waiting' state; 409 for other states.

8.3 Test utilities
- Use jest fake timers to control setTimeout.
- Use test MongoDB (e.g., mongo-memory-server) or existing test DB configuration; if not available, mock Mongoose model layer where feasible for unit tests and reserve integration tests for a configured environment.


## 9) Implementation Steps (Chronological)

1) Types
- Add ExecutionLogEntry and JourneyRun interfaces to src/types/index.ts.

2) Model
- Create src/models/JourneyRun.ts with schema, indexes, and toJSON transforms.

3) Service
- Implement src/services/journeyExecutor.ts:
  - Timers registry and helpers.
  - Node map builder + validation (reuse logic from journeyEngine.ts with adaptation).
  - Core processing loop with persistence and logging.
  - Public API methods: startJourney, resumeJourney, getRunStatus, getPatientRuns, cancelRun, recoverDueRuns.

4) Controllers/Routes
- Create src/controllers/runController.ts implementing endpoints via executor.
- Create src/routes/runs.ts mapping:
  - POST /api/runs/:runId/resume
  - GET /api/runs/:runId
  - GET /api/patients/:patientId/runs
  - DELETE /api/runs/:runId
- Update existing journey start handler:
  - In journeyController.startJourney: delegate to executor.startJourney and return the created run (JSON).
- Register runs router in src/index.ts.

5) Startup recovery
- In src/index.ts after successful DB connect, call journeyExecutor.recoverDueRuns().

6) Tests
- Extend existing service tests for nodeProcessor if needed.
- Add tests for executor service and HTTP endpoints (happy paths + error paths), using fake timers for DELAY.

7) Documentation and Examples
- Ensure README documents new endpoints and provides a quick example to start and query a run.


## 10) Non-Functional Considerations and Trade-offs

- Atomicity: Use findOneAndUpdate with $set and $push to minimize race conditions; full Mongo transactions can be added later if needed.
- Concurrency: Each run is independent; ensure timers map operations are guarded (clear/set) to avoid duplicates on resume.
- Cancel semantics: Using status='failed' with errorMessage='Cancelled by user' to comply with the allowed status values.
- Scheduling persistence: setTimeout is volatile; recovery scans waiting runs with wakeUpAt in the past to resume after restarts.
- Performance: Add indexes on (status, wakeUpAt) and (patientId, status) for efficient queries and recovery.
- Logging: Keep console logs concise and tagged; executionLog keeps full context for audits.


## 11) Minimal Changes Strategy

To satisfy the requirement with minimal disruption:
- Introduce new files for JourneyRun model, executor service, runs controller/routes, and minimal edits to existing journeyController and index.ts.
- Reuse existing nodeProcessor and messageService unchanged; orchestration shifts to journeyExecutor.
- Avoid refactoring journeyEngine.ts; leave it intact for backwards compatibility and tests, but route API calls to the new executor.
