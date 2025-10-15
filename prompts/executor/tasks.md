# Journey Executor Enhancement Tasks

Generate and implement tasks according to prompts/executor/plan.md. Use [ ] to mark incomplete and [x] to mark completed as you work.

1. [x] Types: Extend shared TypeScript interfaces in src/types/index.ts
   - 1.1 [x] Add ExecutionLogEntry { timestamp: string; nodeId: string; nodeType: 'MESSAGE'|'DELAY'|'CONDITIONAL'; action: string; details?: unknown }
   - 1.2 [x] Add JourneyRun { runId; journeyId; patientId; currentNodeId; status; wakeUpAt; startedAt; completedAt; executionLog; errorMessage? }

2. [x] Data Model: Create JourneyRun Mongoose model in src/models/JourneyRun.ts
   - 2.1 [x] Define schema fields mirroring JourneyRun interface
   - 2.2 [x] Configure toJSON transform to output ISO strings for Date fields and omit internal _id/__v
   - 2.3 [x] Add indexes:
     - 2.3.1 [x] Unique index on runId
     - 2.3.2 [x] Compound index on { patientId, status, wakeUpAt }
     - 2.3.3 [x] (Optional) Index on { status, wakeUpAt } for recovery scans

3. [x] Executor Service: Implement src/services/journeyExecutor.ts
   - 3.1 [x] Timers registry: Map<string, NodeJS.Timeout> and helpers (set/clear/stopAll)
   - 3.2 [x] Persistence helpers: appendLog(runId, entry); setStatus(runId, status, patch)
   - 3.3 [x] Node map builder + validation (ensure referenced node IDs exist)
   - 3.4 [x] Core processing loop (while currentNodeId != null) with try/catch error handling
     - 3.4.1 [x] MESSAGE: stub-send via messageService, log action, advance to next_node_id
     - 3.4.2 [x] DELAY: compute wakeUpAt, persist status='waiting' and next currentNodeId, schedule setTimeout to resume
     - 3.4.3 [x] CONDITIONAL: evaluate condition using nodeProcessor helpers, log result, branch to appropriate next node
     - 3.4.4 [x] Completion: when currentNodeId === null, set status='completed', completedAt, clear timer, log COMPLETE
     - 3.4.5 [x] Failure: on error, set status='failed', completedAt, errorMessage, clear timer, log ERROR
   - 3.5 [x] Public API methods
     - 3.5.1 [x] startJourney(journeyId, patientId): create run (uuid), persist initial state, kick off processing
     - 3.5.2 [x] resumeJourney(runId): move from 'waiting' to 'active', clear wakeUpAt, continue processing
     - 3.5.3 [x] getRunStatus(runId): fetch and return JourneyRun (404 if not found)
     - 3.5.4 [x] getPatientRuns(patientId, status?): list runs sorted by startedAt desc
     - 3.5.5 [x] cancelRun(runId): clear timer (if any), set status='failed' with errorMessage='Cancelled by user'
     - 3.5.6 [x] recoverDueRuns(): resume all runs with status='waiting' and wakeUpAt <= now
   - 3.6 [x] Logging: prefix console logs with [RUN:<runId>] and node-type tags

4. [x] Controllers and Routes
   - 4.1 [x] Create src/controllers/runController.ts with handlers using executor
     - 4.1.1 [x] POST /api/journeys/:journeyId/start { patientId } → executor.startJourney → return JourneyRun
     - 4.1.2 [x] POST /api/runs/:runId/resume → executor.resumeJourney
     - 4.1.3 [x] GET /api/runs/:runId → executor.getRunStatus
     - 4.1.4 [x] GET /api/patients/:patientId/runs[?status=...] → executor.getPatientRuns
     - 4.1.5 [x] DELETE /api/runs/:runId → executor.cancelRun
     - 4.1.6 [x] Use try/catch and error middleware; consistent JSON error format
   - 4.2 [x] Create src/routes/runs.ts wiring endpoints to controller
   - 4.3 [x] Register runs router in src/index.ts (e.g., app.use('/api', runsRouter))
   - 4.4 [x] Update existing journey start handler to delegate to executor.startJourney and return full run record

5. [x] Startup and Shutdown Hooks
   - 5.1 [x] After DB connection in src/index.ts, call journeyExecutor.recoverDueRuns()
   - 5.2 [x] On server shutdown, call journeyExecutor.stopAllTimers() to avoid dangling timeouts (esp. for tests)

6. [x] Integration with Existing Services
   - 6.1 [x] Reuse nodeProcessor for condition evaluation and messageService for stubbed message sending
   - 6.2 [x] Ensure DELAY scheduling is orchestrated by executor (not nodeProcessor)

7. [x] Error Handling and Validation
   - 7.1 [x] Map not-found and conflict states to 404/409 in controllers; delegate to global errorHandler
   - 7.2 [x] Defensive validation of journey structure when building node map; fail fast on invalid references

8. [x] Testing
   - 8.1 [x] Unit tests for executor service
     - 8.1.1 [x] State transitions: active → waiting → active → completed
     - 8.1.2 [x] Error handling: missing node; invalid operator
     - 8.1.3 [x] Cancel behavior: sets status='failed' and clears timers
   - 8.2 [x] Integration tests with supertest
     - 8.2.1 [x] POST /api/journeys/:id/start returns JourneyRun and persists initial state
     - 8.2.2 [x] MESSAGE → DELAY → MESSAGE flow using short delay with jest fake timers (covered in executor unit test)
     - 8.2.3 [x] CONDITIONAL branching true/false by varying patient context (covered in existing engine tests)
     - 8.2.4 [x] GET /api/patients/:id/runs with and without status filter
     - 8.2.5 [x] GET /api/runs/:runId reflects live changes
     - 8.2.6 [x] POST /api/runs/:runId/resume works only from 'waiting' (409 otherwise)
   - 8.3 [x] Test utilities/setup
     - 8.3.1 [x] Use jest.useFakeTimers() to control setTimeout
     - 8.3.2 [x] Configure in-memory MongoDB (mongodb-memory-server) or mock Mongoose as appropriate (mocked)

9. [x] Documentation
   - 9.1 [x] Update README with new run-related endpoints and example usage
   - 9.2 [x] Document run status values and sample executionLog entries

10. [x] Non-Functional/Operational
   - 10.1 [x] Confirm necessary indexes exist and are used (status/wakeUpAt, patientId/status)
   - 10.2 [x] Ensure timers map operations are guarded to prevent duplicate resumes
   - 10.3 [x] Keep logs concise and tagged; ensure executionLog covers key events
