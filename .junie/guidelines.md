# Project Development Guidelines (Journey)

Audience: Advanced developers working on this TypeScript/Node.js API project.

## Tech Stack
- **Language**: Node.js with TypeScript
- **Framework**: Express
- **Database**: MongoDB
- **Async Processing**: setTimeout
- **Project Type**: API only

## Domain Model
This API manages journeys consisting of three node types:
- **MESSAGE** (ActionNode): An action to send a message to a patient
- **DELAY** (DelayNode): A waiting period before the next node is processed
- **CONDITIONAL** (ConditionalNode): A branch in the logic based on patient data

See `prompts/requirements.md` for detailed interface definitions.

### Core Types
- `JourneyNode` = `ActionNode | DelayNode | ConditionalNode`
- `Journey`: Contains `id`, `name`, `start_node_id`, and array of `nodes`
- `PatientContext`: Contains `id`, `age`, `language` ('en' | 'es'), `condition` ('hip_replacement' | 'knee_replacement')

## Project Structure
```
src/
├── index.ts                 # Application entry point, Express server setup
├── models/                  # MongoDB schemas and models
│   ├── Journey.ts          # Journey model definition
│   ├── Node.ts             # Node model (MESSAGE, DELAY, CONDITIONAL)
│   └── Patient.ts          # Patient model
├── routes/                  # Express route handlers
│   ├── journeys.ts         # Journey CRUD endpoints
│   ├── nodes.ts            # Node management endpoints
│   └── patients.ts         # Patient management endpoints
├── controllers/             # Business logic layer
│   ├── journeyController.ts
│   ├── nodeController.ts
│   └── patientController.ts
├── services/                # Core business services
│   ├── journeyEngine.ts    # Journey execution engine
│   ├── nodeProcessor.ts    # Node processing logic (MESSAGE, DELAY, CONDITIONAL)
│   └── messageService.ts   # Message sending logic
├── middleware/              # Express middleware
│   ├── errorHandler.ts     # Global error handling
│   └── validation.ts       # Request validation
├── types/                   # TypeScript type definitions
│   └── index.ts            # Shared types and interfaces
├── utils/                   # Utility functions
│   └── database.ts         # MongoDB connection setup
├── config/                  # Configuration files
│   └── index.ts            # Environment configuration
└── tests/                   # Test files
    ├── api/                # API endpoint tests
    └── services/           # Service/executor logic tests
```

## Build and Configuration
- **Toolchain**: TypeScript 5.x, CommonJS modules, target ES2016+, outDir=dist
- **Entry Point**: src/index.ts → compiled to dist/index.js
- **Build Commands**:
  - `npm run build` - Compile TypeScript to JavaScript
  - `npm run dev` - Development mode with hot reload (if configured)
  - `node dist/index.js` - Run compiled application
- **Type Checking**: Strict mode enabled ("strict": true)
- **Module Format**: CommonJS ("module": "commonjs")

## Development Guidelines

### Code Style
- Follow idiomatic, strict TypeScript
- Prefer explicit types at public boundaries
- Avoid `any`; use proper typing or `unknown` with type guards
- Keep functions small and focused
- Use async/await for asynchronous operations

### Actions and Stubbing
- **All actions should be stubbed with console.log**
- Message sending, external API calls, and side effects should log their intent rather than execute
- Example:
  ```typescript
  // Stubbed message action
  console.log(`[ACTION] Sending message to patient ${patientId}: "${message}"`);
  ```

### Async Processing
- Use `setTimeout` for async operations and delays
- Handle DELAY nodes by scheduling the next node execution with setTimeout
- Example:
  ```typescript
  setTimeout(() => {
    processNextNode(nextNodeId);
  }, delayMs);
  ```

### Error Handling
- Use try-catch blocks for async operations
- Implement global error handling middleware in Express
- Return consistent error responses with appropriate HTTP status codes
- Log errors with sufficient context for debugging

### Database
- Define Mongoose schemas with TypeScript interfaces
- Use proper validation in schemas
- Handle connection errors gracefully
- Close connections properly on shutdown

## Testing

### Test Strategy
Tests should be written for:
1. **API Endpoints**: All REST endpoints for journeys, nodes, and patients
2. **Executor Logic**: Journey execution engine and node processing logic

### Test Framework
- Use Jest or Vitest for testing
- Place tests in `src/tests/` directory
- Name test files with `.test.ts` or `.spec.ts` suffix

### Test Coverage Requirements
- API endpoints: Test happy paths, error cases, validation, and edge cases
- Executor logic: Test each node type (MESSAGE, DELAY, CONDITIONAL), journey flow, and error handling

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Example Test Structure
```typescript
// tests/api/journeys.test.ts
describe('Journey API', () => {
  describe('POST /api/journeys', () => {
    it('should create a new journey', async () => {
      // Test implementation
    });

    it('should return 400 for invalid data', async () => {
      // Test implementation
    });
  });
});

// tests/services/nodeProcessor.test.ts
describe('Node Processor', () => {
  it('should process MESSAGE node and log action', () => {
    // Test implementation
  });

  it('should schedule DELAY node with setTimeout', () => {
    // Test implementation
  });

  it('should evaluate CONDITIONAL node and branch correctly', () => {
    // Test implementation
  });
});
```

## API Design

### RESTful Endpoints
Follow REST conventions:
- GET /api/journeys - List all journeys
- GET /api/journeys/:id - Get journey by ID
- POST /api/journeys - Create new journey
- PUT /api/journeys/:id - Update journey
- DELETE /api/journeys/:id - Delete journey

Similar patterns for /api/nodes and /api/patients

### Request/Response Format
- Use JSON for all requests and responses
- Include proper Content-Type headers
- Return consistent error format:
  ```json
  {
    "error": "Error message",
    "code": "ERROR_CODE",
    "details": {}
  }
  ```

### Validation
- Validate all incoming requests
- Use middleware for common validations
- Return clear validation error messages

## Node Type Specifications

### MESSAGE Node (ActionNode)
- **Type**: `'MESSAGE'`
- **Fields**: `id`, `type`, `message`, `next_node_id`
- Contains message content to send to patient
- When executed: Log the message action (stubbed with console.log)
- Proceed to `next_node_id` immediately after logging, or end if `null`

### DELAY Node
- **Type**: `'DELAY'`
- **Fields**: `id`, `type`, `duration_seconds`, `next_node_id`
- Contains delay duration in seconds (not milliseconds)
- When executed: Use setTimeout to schedule next node after `duration_seconds * 1000` ms
- Log the delay being applied
- Proceed to `next_node_id` after delay, or end if `null`

### CONDITIONAL Node
- **Type**: `'CONDITIONAL'`
- **Fields**: `id`, `type`, `condition`, `on_true_next_node_id`, `on_false_next_node_id`
- Contains condition logic based on patient data
- `condition` object has: `field` (e.g., 'patient.age'), `operator` (e.g., '>', '=', '!='), `value` (comparison value)
- Evaluates condition against PatientContext and branches accordingly
- Support operators: '=', '!=', '>', '<', '>=', '<='
- Log the condition evaluation result
- Navigate to `on_true_next_node_id` if true, `on_false_next_node_id` if false, or end if respective value is `null`

## Journey Execution Flow
1. Start journey for a patient
2. Load first node
3. Process node based on type:
   - MESSAGE: Log action → next node
   - DELAY: Schedule next node with setTimeout
   - CONDITIONAL: Evaluate condition → branch to appropriate next node
4. Continue until journey completes or encounters error
5. Track journey state for each patient

## Environment Configuration
- Use environment variables for configuration
- Required variables:
  - `PORT` - Server port (default: 3000)
  - `MONGODB_URI` - MongoDB connection string
  - `NODE_ENV` - Environment (development/production/test)
- Store in `.env` file (not committed to git)
- Provide `.env.example` template

## Git and Version Control
- Keep commits focused and atomic
- Write clear commit messages
- Do not commit `node_modules/`, `dist/`, or `.env`
- Use `.gitignore` appropriately

## Project Hygiene
- Keep src/ clean of experimental files
- Remove unused imports and variables
- Format code consistently
- Document complex logic with comments
- Update this guidelines file when making architectural changes
