# Journey API (TypeScript/Express/MongoDB)

API for managing patient journeys composed of MESSAGE, DELAY, and CONDITIONAL nodes.

## Tech Stack
- Node.js + TypeScript (strict)
- Express
- MongoDB (Mongoose)
- Jest + ts-jest + Supertest for tests

## Getting Started

1. Install dependencies
   npm install

2. Configure environment
   - Copy .env.example to .env and set values
   - Required variables:
     - PORT (default: 3000)
     - MONGODB_URI
     - NODE_ENV (development|production|test)

3. Build
   npm run build

4. Run
   node dist/index.js

During development, you can run TypeScript in watch mode:
   npm run dev

## Scripts
- npm run build — Compile TS to JS (dist)
- npm start — Run compiled app
- npm test — Run tests (uses Jest config at jest.config.js)
- npm run test:watch — Jest in watch mode
- npm run test:coverage — Jest with coverage

## API Endpoints
Base URL: /api

- Journeys
  - GET /api/journeys — List all
  - GET /api/journeys/:id — Get by id
  - POST /api/journeys — Create
  - PUT /api/journeys/:id — Update
  - DELETE /api/journeys/:id — Delete
  - POST /api/journeys/:id/start — Start execution for a patient/context

- Patients
  - GET /api/patients — List all
  - GET /api/patients/:id — Get by id
  - POST /api/patients — Create
  - PUT /api/patients/:id — Update
  - DELETE /api/patients/:id — Delete

- Health
  - GET /health — Service health check

## Request/Response
- JSON only
- Errors follow the format:
  {
    "error": "Error",
    "code": "ERROR_CODE",
    "details": {}
  }

## Example Payloads

- Patient
  {
    "age": 62,
    "language": "en",
    "condition": "hip_replacement"
  }

- Journey (MESSAGE -> CONDITIONAL -> MESSAGE)
  {
    "name": "Recovery Journey",
    "start_node_id": "start",
    "nodes": [
      { "id": "start", "type": "MESSAGE", "message": "Welcome!", "next_node_id": "checkAge" },
      {
        "id": "checkAge",
        "type": "CONDITIONAL",
        "condition": { "field": "age", "operator": ">=", "value": 60 },
        "on_true_next_node_id": "seniorMsg",
        "on_false_next_node_id": "adultMsg"
      },
      { "id": "seniorMsg", "type": "MESSAGE", "message": "Senior guidance.", "next_node_id": null },
      { "id": "adultMsg", "type": "MESSAGE", "message": "Adult guidance.", "next_node_id": null }
    ]
  }

- Journey with DELAY
  {
    "name": "Follow Up",
    "start_node_id": "m1",
    "nodes": [
      { "id": "m1", "type": "MESSAGE", "message": "Initial note", "next_node_id": "d1" },
      { "id": "d1", "type": "DELAY", "duration_seconds": 3600, "next_node_id": "m2" },
      { "id": "m2", "type": "MESSAGE", "message": "After one hour", "next_node_id": null }
    ]
  }

## Development Notes
- All side effects are stubbed with console.log (prefixes: [ACTION], [DELAY], [CONDITIONAL], [ENGINE], [API], [DB], [ERROR])
- DELAY nodes use setTimeout; tests use Jest fake timers.
- In tests, the Express app is created via createApp() without starting a server or connecting to a real DB.
