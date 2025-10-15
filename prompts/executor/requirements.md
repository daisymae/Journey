# Journey Executor Requirements

## Overview
The Journey Executor is responsible for managing the execution of patient care journeys. It processes nodes sequentially, maintains execution state, handles delays, and supports resumption after asynchronous operations.

## Core Responsibilities

### 1. Journey Run Management
When a journey is triggered for a patient, the executor must:
- Create a new "run" record with a unique `runId`
- Associate the run with a specific journey and patient
- Track the current state of execution
- Persist run state to handle system restarts and asynchronous operations

### 2. Node Processing
Process nodes sequentially starting from `journey.start_node_id`:
- **MESSAGE nodes**:
  - Log the message action (stubbed): `[ACTION] Sending message to patient {patientId}: "{message}"`
  - Immediately proceed to `next_node_id`
  - Update run state to reflect message was processed

- **DELAY nodes**:
  - Log the delay action: `[DELAY] Waiting {duration_seconds} seconds before next node`
  - Schedule the next node execution using `setTimeout`
  - Update run state to "waiting" with wake-up time
  - Store `next_node_id` for resumption after delay

- **CONDITIONAL nodes**:
  - Evaluate the condition against the `PatientContext`
  - Log the evaluation: `[CONDITIONAL] Evaluating {field} {operator} {value} = {result}`
  - Branch to `on_true_next_node_id` or `on_false_next_node_id` based on result
  - Update run state with the evaluation result

### 3. State Management
The run record must track:
- `runId`: Unique identifier for this execution
- `journeyId`: The journey being executed
- `patientId`: The patient this journey is for
- `currentNodeId`: The node currently being processed (or next to process)
- `status`: Current execution status
  - `'active'`: Currently processing a node
  - `'waiting'`: Paused for a DELAY node
  - `'completed'`: Journey finished successfully
  - `'failed'`: Journey encountered an error
- `wakeUpAt`: Timestamp when a delayed journey should resume (ISO 8601 format)
- `startedAt`: When the journey run was initiated
- `completedAt`: When the journey run finished (null if not completed)
- `executionLog`: Array of execution events for debugging and audit trail

### 4. Wake-Up Mechanism
After a DELAY node completes:
- The system must "wake up" the journey run
- Load the persisted run state from the database
- Retrieve the patient context
- Continue processing from the stored `currentNodeId`
- Update the run status from `'waiting'` to `'active'`

## Interface Definitions

### JourneyRun
```typescript
interface JourneyRun {
  runId: string;
  journeyId: string;
  patientId: string;
  currentNodeId: string | null;
  status: 'active' | 'waiting' | 'completed' | 'failed';
  wakeUpAt: string | null; // ISO 8601 timestamp
  startedAt: string; // ISO 8601 timestamp
  completedAt: string | null; // ISO 8601 timestamp
  executionLog: ExecutionLogEntry[];
  errorMessage?: string; // Set when status is 'failed'
}
```

### ExecutionLogEntry
```typescript
interface ExecutionLogEntry {
  timestamp: string; // ISO 8601 timestamp
  nodeId: string;
  nodeType: 'MESSAGE' | 'DELAY' | 'CONDITIONAL';
  action: string; // Human-readable description of what happened
  details?: any; // Additional context (e.g., condition evaluation result)
}
```

### ExecutorAPI
```typescript
interface JourneyExecutor {
  /**
   * Start a new journey run for a patient
   * @param journeyId - The journey to execute
   * @param patientId - The patient to execute the journey for
   * @returns The created run record
   */
  startJourney(journeyId: string, patientId: string): Promise<JourneyRun>;

  /**
   * Resume a journey run after a delay
   * @param runId - The run to resume
   */
  resumeJourney(runId: string): Promise<void>;

  /**
   * Get the current state of a journey run
   * @param runId - The run to query
   * @returns The run record
   */
  getRunStatus(runId: string): Promise<JourneyRun>;

  /**
   * List all runs for a patient
   * @param patientId - The patient to query
   * @returns Array of run records
   */
  getPatientRuns(patientId: string): Promise<JourneyRun[]>;

  /**
   * Cancel an active or waiting journey run
   * @param runId - The run to cancel
   */
  cancelRun(runId: string): Promise<void>;
}
```

## Execution Flow

### Starting a Journey
1. Validate that the journey and patient exist
2. Create a new `JourneyRun` record with:
   - Unique `runId` (e.g., UUID)
   - `status: 'active'`
   - `currentNodeId: journey.start_node_id`
   - `startedAt: new Date().toISOString()`
3. Begin processing from the start node
4. Return the created run record

### Processing Nodes
```
while (currentNodeId is not null) {
  1. Load the node from journey.nodes
  2. Add entry to executionLog
  3. Process based on node type:
     - MESSAGE: Log action, set currentNodeId = next_node_id
     - DELAY: Schedule wake-up, set status = 'waiting', return
     - CONDITIONAL: Evaluate condition, set currentNodeId based on result
  4. Update run record in database
  5. If currentNodeId is null, set status = 'completed'
}
```

### Handling DELAY Nodes
1. Calculate wake-up time: `new Date(Date.now() + duration_seconds * 1000)`
2. Update run record:
   - `status: 'waiting'`
   - `wakeUpAt: wakeUpTime.toISOString()`
   - `currentNodeId: node.next_node_id`
3. Schedule wake-up using `setTimeout`:
   ```typescript
   setTimeout(() => {
     resumeJourney(runId);
   }, duration_seconds * 1000);
   ```
4. Exit the processing loop (do not continue to next node immediately)

### Resuming After Delay
1. Load the `JourneyRun` by `runId`
2. Verify `status === 'waiting'`
3. Load the journey and patient context
4. Update run: `status: 'active'`, `wakeUpAt: null`
5. Continue processing from `currentNodeId`

### Error Handling
If an error occurs during execution:
1. Update run record:
   - `status: 'failed'`
   - `completedAt: new Date().toISOString()`
   - `errorMessage: error.message`
2. Log the error with full context
3. Do not continue processing
4. Consider notifying administrators of the failure

## Implementation Considerations

### Persistence
- All run state must be persisted to MongoDB
- Updates should be atomic to prevent race conditions
- Consider using database transactions for state updates

### Scheduling and Resilience
- Use `setTimeout` for in-memory scheduling during development
- In production, consider a persistent scheduler (e.g., job queue like Bull, Agenda)
- Handle system restarts: query for runs with `status: 'waiting'` and `wakeUpAt` in the past, then resume them

### Concurrency
- Each run is independent and can be processed concurrently
- Multiple patients can have runs of the same journey simultaneously
- Ensure thread-safe access to shared resources (journey definitions, patient context)

### Condition Evaluation
Support these operators in CONDITIONAL nodes:
- `'='`: Equality (use `==` for comparison)
- `'!='`: Inequality
- `'>'`: Greater than
- `'<'`: Less than
- `'>='`: Greater than or equal
- `'<='`: Less than or equal

Example condition evaluation:
```typescript
function evaluateCondition(
  condition: ConditionalNode['condition'],
  patient: PatientContext
): boolean {
  const fieldValue = getNestedField(patient, condition.field);

  switch (condition.operator) {
    case '=': return fieldValue == condition.value;
    case '!=': return fieldValue != condition.value;
    case '>': return fieldValue > condition.value;
    case '<': return fieldValue < condition.value;
    case '>=': return fieldValue >= condition.value;
    case '<=': return fieldValue <= condition.value;
    default: throw new Error(`Unsupported operator: ${condition.operator}`);
  }
}
```

### Logging and Observability
- Log all node processing actions to console (as per stubbing guidelines)
- Maintain detailed execution log in the run record
- Include timestamps and context in all log entries
- Example log formats:
  - `[RUN:abc123] [MESSAGE] Sending message to patient p456: "Take your medication"`
  - `[RUN:abc123] [DELAY] Waiting 3600 seconds before next node`
  - `[RUN:abc123] [CONDITIONAL] Evaluating patient.age > 65 = true`

## API Endpoints

### Start Journey
```
POST /api/journeys/:journeyId/start
Body: { "patientId": "string" }
Response: JourneyRun
```

### Resume Journey (Wake Up)
```
POST /api/runs/:runId/resume
Response: { "message": "Journey resumed" }
```

### Get Run Status
```
GET /api/runs/:runId
Response: JourneyRun
```

### List Patient Runs
```
GET /api/patients/:patientId/runs
Query params: ?status=active|waiting|completed|failed (optional)
Response: JourneyRun[]
```

### Cancel Run
```
DELETE /api/runs/:runId
Response: { "message": "Run cancelled" }
```

## Testing Requirements

### Unit Tests
- Condition evaluation logic
- Node type detection and routing
- State transitions (active → waiting → active → completed)
- Error handling and failure states

### Integration Tests
- Complete journey execution (MESSAGE → DELAY → MESSAGE)
- Conditional branching (test both true and false paths)
- Wake-up mechanism after delays
- Multiple concurrent runs
- Journey completion detection
- Error scenarios (missing nodes, invalid conditions, etc.)

### Test Scenarios
1. **Simple journey**: MESSAGE → MESSAGE → Complete
2. **Delayed journey**: MESSAGE → DELAY → MESSAGE → Complete
3. **Conditional journey**: MESSAGE → CONDITIONAL (branch based on age) → Different paths
4. **Long journey**: Multiple nodes of all types
5. **Circular journey**: CONDITIONAL that loops back to earlier node (with exit condition)
6. **Failed journey**: Invalid node reference, missing patient data
7. **Wake-up after restart**: Simulate system restart, resume waiting runs

## Example Journey Execution

Given this journey:
```json
{
  "id": "j1",
  "name": "Post-Surgery Care",
  "start_node_id": "n1",
  "nodes": [
    {
      "id": "n1",
      "type": "MESSAGE",
      "message": "Welcome to your care journey!",
      "next_node_id": "n2"
    },
    {
      "id": "n2",
      "type": "DELAY",
      "duration_seconds": 3600,
      "next_node_id": "n3"
    },
    {
      "id": "n3",
      "type": "CONDITIONAL",
      "condition": {
        "field": "age",
        "operator": ">",
        "value": 65
      },
      "on_true_next_node_id": "n4",
      "on_false_next_node_id": "n5"
    },
    {
      "id": "n4",
      "type": "MESSAGE",
      "message": "Senior-specific care instructions",
      "next_node_id": null
    },
    {
      "id": "n5",
      "type": "MESSAGE",
      "message": "Standard care instructions",
      "next_node_id": null
    }
  ]
}
```

Execution for a patient aged 70:
1. Start: Create run, set `currentNodeId: "n1"`, `status: 'active'`
2. Process n1: Log message, set `currentNodeId: "n2"`
3. Process n2: Schedule wake-up in 3600s, set `status: 'waiting'`, exit
4. [3600 seconds later]
5. Resume: Load run, set `status: 'active'`, continue from n3
6. Process n3: Evaluate `age > 65` → true, set `currentNodeId: "n4"`
7. Process n4: Log message, set `currentNodeId: null`
8. Complete: Set `status: 'completed'`, `completedAt: timestamp`

Console output:
```
[RUN:abc123] [MESSAGE] Sending message to patient p456: "Welcome to your care journey!"
[RUN:abc123] [DELAY] Waiting 3600 seconds before next node
[RUN:abc123] [RESUME] Journey resumed after delay
[RUN:abc123] [CONDITIONAL] Evaluating age > 65 = true
[RUN:abc123] [MESSAGE] Sending message to patient p456: "Senior-specific care instructions"
[RUN:abc123] [COMPLETE] Journey completed successfully
```
