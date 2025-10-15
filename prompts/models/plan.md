# Implementation Plan: Journey System (API in Node.js/TypeScript)

This plan translates the requirements in prompts/requirements.md into a concrete, phased implementation aligned with the development guidelines. It covers data types, persistence models, services (journey engine and node processing), API endpoints, middleware, configuration, and tests.

## 1) Objectives and Scope
- Implement an API-only service that manages patient journeys consisting of MESSAGE, DELAY, and CONDITIONAL nodes.
- Execute journeys for a patient with correct flow control:
  - MESSAGE: log action then continue immediately
  - DELAY: schedule next node with setTimeout after duration_seconds * 1000
  - CONDITIONAL: evaluate against PatientContext and branch
- Provide CRUD endpoints for journeys, nodes, and patients.
- Ensure strict TypeScript types, validation, and structured error handling.
- Provide comprehensive tests for API endpoints and journey execution logic.

## 2) Assumptions
- MongoDB is available via MONGODB_URI.
- External actions (sending messages) are stubbed with console.log (no external API calls).
- setTimeout is sufficient for DELAY scheduling (no job queue required).
- Execution state can be in-memory for the scope of this project; persistence of run-state is non-goal unless otherwise requested.

## 3) High-Level Architecture
- Language: TypeScript (strict), target ES2016+, CommonJS
- Framework: Express
- Database: MongoDB (Mongoose)
- Async/scheduling: setTimeout only
- Tests: Jest + ts-jest + supertest

Directory layout (as per guidelines):
- src/
  - index.ts (Express bootstrap)
  - models/ (Mongoose schemas)
  - routes/ (Express routers)
  - controllers/ (request handling -> services)
  - services/ (journeyEngine, nodeProcessor, messageService)
  - middleware/ (errorHandler, validation)
  - types/ (shared TS interfaces)
  - utils/ (database connection)
  - config/ (env configuration)
- tests/ (API and services tests)

## 4) Core Type Definitions (src/types/index.ts)
Define the strict TypeScript interfaces exactly as per requirements:
- ActionNode, DelayNode, ConditionalNode, JourneyNode (union), Journey, PatientContext.
- Narrow operators: '=', '!=', '>', '<', '>=', '<='.
- Derive internal helper types as needed (NodeById map, Operator type, etc.).

## 5) Database Models (src/models)
- Patient.ts
  - id: string (use Mongo _id mapped to string via toJSON transform)
  - age: number; language: 'en' | 'es'; condition: 'hip_replacement' | 'knee_replacement'
- Node.ts
  - Use a discriminator schema or a single schema with “type” field and conditional requireds.
  - Common: id (string), type ('MESSAGE' | 'DELAY' | 'CONDITIONAL')
  - MESSAGE: message: string, next_node_id: string|null
  - DELAY: duration_seconds: number, next_node_id: string|null
  - CONDITIONAL: condition: { field: string; operator: string; value: unknown }, on_true_next_node_id: string|null, on_false_next_node_id: string|null
- Journey.ts
  - id: string, name: string, start_node_id: string, nodes: embedded array of Node documents

Validation (schema-level):
- Required fields per type.
- Custom validator: all referenced node IDs exist within nodes array (can be re-validated in service layer for better messages).

## 6) Services
### 6.1 messageService.ts
- sendMessage(patientId: string, message: string): void
  - Stub: console.log(`[ACTION] Sending message to patient ${patientId}: "${message}"`)

### 6.2 nodeProcessor.ts
Expose processNode and helpers:
- evaluateCondition(condition, patient): boolean
  - Support operators: '=', '!=', '>', '<', '>=', '<='
  - Extract field path from condition.field (e.g., 'patient.age' or 'age')
  - Handle types (number/string) and missing fields gracefully (false by default; also log warning)
  - Throw on unsupported operator with descriptive error
- processMessage(node, ctx): { nextNodeId: string|null }
  - Log message via messageService
- processDelay(node, ctx, schedule): Promise<string|null> | void
  - Log: `[DELAY] Waiting ${duration_seconds}s before next node ${next_node_id ?? 'END'} (patient ${ctx.id})`
  - Use setTimeout(() => schedule(nextNodeId), duration_seconds*1000)
- processConditional(node, ctx): { nextNodeId: string|null, result: boolean }
  - Log: `[CONDITIONAL] Evaluated ${field} ${operator} ${value} => ${result} (patient ${ctx.id})`
- processNode(node, ctx, schedule): orchestrate based on node.type

### 6.3 journeyEngine.ts
- executeJourney(journey: Journey, patient: PatientContext, options?): void
  - Build a nodeById map for O(1) lookups; validate start_node_id exists.
  - Define function run(nodeId: string|null): void
    - If null => log completion and return
    - Lookup node; if missing => throw descriptive error
    - Switch by type:
      - MESSAGE: processMessage -> run(next)
      - DELAY: schedule next with setTimeout (via nodeProcessor)
      - CONDITIONAL: evaluate -> run(chosen)
  - Validation before start:
    - Non-empty nodes, all referenced IDs exist (validate graph references).
  - Logging start/finish of journey for traceability.

Note: For testability, inject a scheduler (default to setTimeout) so tests can use Jest fake timers.

## 7) Controllers (src/controllers)
- patientController.ts
  - create, read, update, delete (CRUD)
- journeyController.ts
  - create journey, get all, get by id, update, delete
  - start execution endpoint: POST /api/journeys/:id/start with patientId or embedded PatientContext
- nodeController.ts
  - Depending on design, nodes are embedded in journeys; separate node CRUD may be limited to update operations within a journey. Provide endpoints if needed by spec/guidelines.

Controllers use services and handle try/catch, passing errors to errorHandler.

## 8) Routes (src/routes)
- /api/patients: GET/POST/PUT/DELETE
- /api/journeys: GET/POST/PUT/DELETE
- Optional: /api/journeys/:id/start (kick off execution for a patient)
- /api/nodes: only if nodes are top-level; else nest under journeys

## 9) Middleware
- errorHandler.ts
  - Convert thrown errors to JSON: { error, code, details }
  - Map validation errors to 400, not-found to 404, others 500
- validation.ts
  - Request body validation. Keep minimal with custom checks or introduce zod later.
  - Validate Journey creation/update per Validation Requirements:
    - At least one node
    - start_node_id exists
    - All referenced node IDs exist within nodes array

## 10) Config and App Bootstrap
- config/index.ts
  - Load env via dotenv
  - Export PORT (default 3000), MONGODB_URI, NODE_ENV
- utils/database.ts
  - Connect to MongoDB using Mongoose, handle connection events
- src/index.ts
  - Initialize express, JSON body parser, routes, error handler
  - Start server on PORT
  - On shutdown, close DB connection

## 11) Testing Strategy
- Framework: Jest + ts-jest; supertest for HTTP tests.
- Setup:
  - jest.config.ts with ts-jest preset
  - Use jest fake timers to test DELAY behavior deterministically
- Service tests (src/tests/services):
  - nodeProcessor.test.ts
    - MESSAGE logs action and returns next immediately
    - DELAY schedules next with setTimeout (use fake timers)
    - CONDITIONAL evaluates each operator and branches correctly (true/false)
    - Unsupported operator throws error
  - journeyEngine.test.ts
    - Executes simple linear journeys (MESSAGE -> MESSAGE)
    - Handles DELAY correctly (advance timers)
    - Handles CONDITIONAL branching
    - Errors on missing node references
- API tests (src/tests/api):
  - journeys.test.ts: CRUD, validation errors
  - patients.test.ts: CRUD and validation
  - Optional: start journey endpoint returns 202/200 and logs stub actions

## 12) Validation and Error Handling Details
- Pre-run validation of Journey graph:
  - Build set of IDs from nodes.
  - Check start_node_id in set.
  - For each node:
    - MESSAGE/DELAY: next_node_id null or in set
    - CONDITIONAL: on_true_next_node_id and on_false_next_node_id null or in set
- Node processor errors:
  - Unsupported operator => throw Error('Unsupported operator: ...')
  - Missing patient field => log warning and treat as non-match (false) unless operator is '=' or '!='; handle reliably:
    - If field missing: '=' returns false unless value is undefined; '!=' returns true unless value is undefined; others return false
- Express error format:
  { "error": "Message", "code": "ERROR_CODE", "details": { ... } }

## 13) Logging and Stubbing
- All side effects are console.log only.
- Standard prefixes:
  - [ACTION], [DELAY], [CONDITIONAL], [ENGINE], [API], [DB], [ERROR]

## 14) Example Payloads
- Journey creation (embedded nodes):
```
{
  "id": "j1",
  "name": "Post-Op Knee",
  "start_node_id": "n1",
  "nodes": [
    { "id": "n1", "type": "MESSAGE", "message": "Welcome!", "next_node_id": "n2" },
    { "id": "n2", "type": "DELAY", "duration_seconds": 3600, "next_node_id": "n3" },
    { "id": "n3", "type": "CONDITIONAL", "condition": { "field": "age", "operator": ">=", "value": 65 }, "on_true_next_node_id": "n4", "on_false_next_node_id": null },
    { "id": "n4", "type": "MESSAGE", "message": "Senior care tips", "next_node_id": null }
  ]
}
```
- Patient:
```
{ "id": "p1", "age": 70, "language": "en", "condition": "knee_replacement" }
```

## 15) Phased Work Plan (Milestones)
1. Scaffolding and dependencies
   - Add deps: express, mongoose, dotenv, cors; dev: jest, ts-jest, supertest, @types/*
   - Update package.json scripts: build, start, dev (optional), test, test:watch, test:coverage
2. Types and configuration
   - Implement src/types/index.ts with all interfaces
   - Implement config/index.ts and utils/database.ts
3. Models
   - Implement Patient, Node (with discriminators or conditional fields), Journey schemas
   - Basic repository utility functions if needed
4. Services
   - messageService (stub)
   - nodeProcessor (operators, delay scheduling, logging)
   - journeyEngine (graph validation, execution loop, logging)
5. API layer
   - Controllers, routes wiring in index.ts
   - Validation middleware for requests
   - Global error handler
6. Tests
   - Configure Jest; add service tests for nodeProcessor and journeyEngine
   - Add API tests for patients and journeys
   - Ensure DELAY uses fake timers in tests
7. Polish
   - .env.example; README updates; logging consistency; minor refactors

## 16) Risks and Mitigations
- setTimeout drift in long delays
  - For tests, use fake timers; in production, document limitations
- Embedded nodes vs separate collection
  - Keep embedded for simplicity; change to references if needed later
- Operator typing and runtime values
  - Narrow Operator type; validate condition.operator at runtime

## 17) Acceptance Criteria
- All types match prompts/requirements.md exactly.
- MESSAGE, DELAY, CONDITIONAL behaviors match spec and are fully tested.
- Validation rejects journeys with invalid references and missing start node.
- Express API exposes CRUD for patients and journeys and returns errors in the specified format.
- All stubbed actions log with clear prefixes.
- Tests pass locally via npm test and coverage includes services and API.

## 18) Time & Effort Estimate (rough)
- Scaffolding & config: 0.5 day
- Types & models: 0.5–1 day
- Services (engine & processor): 1 day
- API (controllers/routes/middleware): 0.5–1 day
- Tests (services + API): 1–1.5 days
- Polish & docs: 0.5 day

Total: ~3.5–4.5 days of focused effort.
