# Detailed Task List — Enhancements Plan

1. [x] Scaffolding and Dependencies
   - [x] Add runtime dependencies: express, mongoose, dotenv, cors
   - [x] Add dev dependencies: jest, ts-jest, supertest, @types/express, @types/jest, @types/supertest, @types/node
   - [x] Update package.json scripts: build, start, dev (optional), test, test:watch, test:coverage
   - [x] Ensure tsconfig.json uses "strict": true, target ES2016+, module commonjs, outDir=dist
   - [x] Create Jest configuration (jest.config.ts) using ts-jest preset

2. [x] Types and Configuration
   - [x] Implement src/types/index.ts with interfaces: ActionNode, DelayNode, ConditionalNode, JourneyNode (union), Journey, PatientContext
   - [x] Define Operator type to restrict to: '=', '!=', '>', '<', '>=', '<='
   - [x] Export shared helper types (e.g., NodeById map)
   - [x] Implement config/index.ts to load env via dotenv and export PORT, MONGODB_URI, NODE_ENV
   - [x] Implement utils/database.ts to connect Mongoose, log connection events, and handle graceful shutdown

3. [x] Database Models (Mongoose)
   - [x] Implement models/Patient.ts with validation (age number; language in 'en'|'es'; condition in 'hip_replacement'|'knee_replacement') and id mapping
   - [x] Implement models/Node.ts with type field and conditional required for MESSAGE, DELAY, CONDITIONAL
   - [x] Implement models/Journey.ts with embedded nodes array, start_node_id, and name
   - [x] Add toJSON transforms to expose id as string and hide internal fields
   - [x] Add schema-level validation (or service-level) to ensure all referenced node IDs exist within journey.nodes

4. [x] Core Services
   - [x] Implement services/messageService.ts with stubbed sendMessage(patientId, message) using console.log with [ACTION] prefix
   - [x] Implement services/nodeProcessor.ts
     - [x] evaluateCondition: support '=', '!=', '>', '<', '>=', '<=' and resolve field path like 'patient.age' or 'age'
     - [x] processMessage: log action and return next_node_id
     - [x] processDelay: log [DELAY], schedule next using setTimeout(duration_seconds * 1000)
     - [x] processConditional: evaluate condition, log [CONDITIONAL], return chosen next node id
   - [x] Implement services/journeyEngine.ts
     - [x] Build nodeById map; validate start_node_id exists
     - [x] Implement run loop: MESSAGE -> next; DELAY -> schedule; CONDITIONAL -> branch
     - [x] Inject scheduler for tests (default to setTimeout)
     - [x] Pre-run validation: all referenced node IDs exist; non-empty nodes
     - [x] Log [ENGINE] start/completion and node transitions

5. [x] Controllers (Business Logic Layer)
   - [x] controllers/patientController.ts: CRUD with try/catch and forwarding errors
   - [x] controllers/journeyController.ts: CRUD, plus POST /api/journeys/:id/start to begin execution for a patient/context
   - [x] controllers/nodeController.ts: not applicable — nodes are embedded within journeys and managed via Journey CRUD

 6. [x] Routes (Express Routers)
   - [x] routes/patients.ts: GET/POST/PUT/DELETE
   - [x] routes/journeys.ts: GET/POST/PUT/DELETE and optional POST /api/journeys/:id/start
   - [x] routes/nodes.ts: not applicable — nodes are embedded; no separate top-level routes required
   - [x] Wire routers in src/index.ts under /api/*

7. [x] Middleware
   - [x] middleware/errorHandler.ts: global error formatter { error, code, details } with status code mapping (400/404/500)
   - [x] middleware/validation.ts: request validation for journeys and patients
     - [x] Validate at least one node on journey create/update
     - [x] Validate start_node_id exists within nodes
     - [x] Validate all referenced node IDs exist within nodes

8. [x] App Bootstrap
   - [x] Initialize Express app in src/index.ts with JSON parser and CORS
   - [x] Register routes and global error handler
   - [x] Read PORT from config and start server
   - [x] Close MongoDB connection gracefully on shutdown signals

9. [x] Logging and Stubbing Conventions
   - [x] Ensure all side effects are stubbed with console.log only
   - [x] Use standard log prefixes: [ACTION], [DELAY], [CONDITIONAL], [ENGINE], [API], [DB], [ERROR]
   - [x] Add targeted logs in services and controllers for traceability

10. [x] Testing Setup and Coverage
  - [x] Install and configure Jest with ts-jest; set up test scripts
  - [x] Use Jest fake timers in tests that involve DELAY nodes
  - [x] Write service tests: tests/services/nodeProcessor.test.ts
    - [x] MESSAGE logs action and returns next immediately
    - [x] DELAY schedules next with setTimeout (verified with fake timers)
    - [x] CONDITIONAL evaluates all operators and branches correctly
    - [x] Unsupported operator throws descriptive error
  - [x] Write service tests: tests/services/journeyEngine.test.ts
    - [x] Executes linear journeys (MESSAGE -> MESSAGE)
    - [x] Handles DELAY via advancing timers
    - [x] Handles CONDITIONAL branching
    - [x] Errors on missing node references
  - [x] Write API tests: tests/api/journeys.test.ts (CRUD, validation errors)
  - [x] Write API tests: tests/api/patients.test.ts (CRUD, validation)
  - [x] Ensure npm test and npm run test:coverage succeed locally

11. [x] Validation and Error Handling Details
   - [x] Implement robust pre-run validation for journey graphs (IDs set, start node exists, references valid)
   - [x] In nodeProcessor, handle missing patient fields: '=' false (unless undefined), '!=' true (unless undefined), others false; log warnings
   - [x] Return consistent Express error responses with proper HTTP codes

12. [x] Documentation and Examples
  - [x] Provide .env.example with PORT, MONGODB_URI, NODE_ENV
  - [x] Update/author README with setup, scripts, endpoints, and testing instructions
  - [x] Include example payloads for Journey and Patient in README or docs

13. [x] Acceptance Criteria Verification
  - [x] Verify TypeScript types match prompts/requirements.md exactly
  - [x] Verify MESSAGE, DELAY, CONDITIONAL behaviors align with spec (manual run and logs)
  - [x] Verify validation rejects invalid journeys (bad references, missing start node)
  - [x] Verify Express API returns errors in the specified JSON format
  - [x] Verify all logs use the defined prefixes consistently
  - [x] Confirm all tests pass and coverage includes services and API

14. [x] Polish
   - [x] Ensure consistent formatting and remove unused imports/variables
   - [x] Add clarifying comments where logic is complex
   - [x] Review logging consistency and minor refactors as needed