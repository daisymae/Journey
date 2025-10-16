# Journey API

A TypeScript/Express API for managing patient journeys with support for messages, delays, and conditional logic. Journeys are composable workflows that execute asynchronously with persistent state management.

## Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB (see installation instructions below)

### MongoDB Setup

You need a running MongoDB instance. Choose one of the following options:

#### Option 1: MongoDB Community Edition (Recommended for Development)

**Windows:**
1. Download MongoDB Community Server from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Run the installer (MSI) and follow the setup wizard
3. Choose "Complete" installation
4. Install as a Windows Service (checked by default)
5. MongoDB will start automatically on port 27017

**macOS (using Homebrew):**
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify it's running
brew services list
```

**Linux (Ubuntu/Debian):**
```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify it's running
sudo systemctl status mongod
```

#### Option 2: Docker (Quick Start)

```bash
# Run MongoDB in a Docker container
docker run -d \
  --name mongodb-journeys \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:7.0

# Verify it's running
docker ps | grep mongodb-journeys

# Stop MongoDB
docker stop mongodb-journeys

# Start MongoDB
docker start mongodb-journeys
```

#### Option 3: MongoDB Atlas (Cloud)

1. Sign up for free at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0)
3. Add your IP address to the IP Access List
4. Create a database user
5. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/journeys`)

#### Verify MongoDB Connection

```bash
# Using mongosh (MongoDB Shell)
mongosh

# Or specify connection string
mongosh "mongodb://localhost:27017"

# You should see:
# Current Mongosh Log ID: ...
# Connecting to: mongodb://127.0.0.1:27017/...
# test>
```

### Application Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/journeys
   NODE_ENV=development
   ```

   **For MongoDB Atlas**, use your connection string:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/journeys
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Start the server**
   ```bash
   npm start
   ```

   You should see:
   ```
   [DB] MongoDB connected successfully to journeys
   [ENGINE] Server listening on port 3000
   ```

### Development Mode

Run TypeScript in watch mode (auto-recompile on changes):
```bash
npm run dev
```

Then in a separate terminal, start the server:
```bash
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Tests use Jest with fake timers to simulate delays. MongoDB is mocked during tests.

### Testing with Postman

A Postman collection (`postman_collection.json`) is included to demonstrate the complete API workflow with automated tests.

![Postman Demo](assets/postman.gif)

#### Prerequisites
- Postman installed ([download here](https://www.postman.com/downloads/))
- Journey API server running on `http://localhost:3000`
- MongoDB running and connected

#### Import and Run the Collection

**Step 1: Import the Collection**
1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Click **Choose Files** and select `postman_collection.json` from the project root
5. Click **Import**

**Step 2: Verify Configuration**
1. In the left sidebar, click on the imported **Journey API - Demo Collection**
2. Select the **Variables** tab
3. Verify `base_url` is set to `http://localhost:3000`
4. If your server runs on a different port, update the **Current value**

**Step 3: Run as Automated Demo**

**Option A: Run Entire Collection (Recommended)**
1. Click the **Journey API - Demo Collection** name in the left sidebar
2. Click the **Run** button (top right, blue button)
3. In the Collection Runner window:
   - All requests should be checked
   - Keep default settings
   - Click **Run Journey API - Demo Collection**
4. Watch the automated execution:
   - ✅ Green tests = passed
   - ❌ Red tests = failed
5. View detailed results and response bodies for each request

**Note:** Request #10 may fail if run too quickly. The automated runner doesn't pause for the 5-second delay. To see this work correctly, run request #9 individually, wait 6+ seconds, then run request #10.

**Option B: Manual Step-by-Step Demo**
1. Execute requests **in order** (1 → 10):
   - Click each request in sequence
   - Click **Send** button
   - Review the response body and test results
   - Variables are automatically captured for subsequent requests

2. **Key steps to observe:**
   - **Request 1-3:** Creates three different journey types
     - Response includes `id` field (saved automatically)
   - **Request 4:** Trigger journey for senior patient (age 65)
     - Response includes `runId` and `status: "completed"`
     - Notice execution happens immediately for MESSAGE/CONDITIONAL nodes
   - **Request 5:** Trigger same journey for adult patient (age 45)
     - Different branch taken due to conditional logic
   - **Request 6:** Trigger journey with 5-second delay
     - Response shows `status: "waiting"` initially
   - **Request 7-8:** Check run status for completed journeys
     - View `executionLog` to see which nodes were executed
     - Verify conditional logic worked (senior vs adult messages)
   - **Request 9:** Check delayed run status immediately
     - Should show `status: "waiting"` and `wakeUpAt` timestamp
   - **Request 10:** Wait 6+ seconds, then check delayed run again
     - Should now show `status: "completed"`
     - View execution log showing all three nodes

**Step 4: Understanding the Results**

Each successful response demonstrates:
- **Journey Creation**: Returns journey definition with unique `id`
- **Journey Trigger**: Returns `JourneyRun` object with:
  - `runId` - Unique run identifier
  - `status` - Current state (active/waiting/completed/failed)
  - `currentNodeId` - Last executed node
  - `executionLog` - Array of all node executions
- **Run Status**: Real-time view of journey execution state

**Collection Overview:**

| # | Request | Purpose | Expected Result |
|---|---------|---------|-----------------|
| 1 | Create Journey - Simple | Two MESSAGE nodes | Creates journey, returns ID |
| 2 | Create Journey - Conditional | Age-based branching | Creates journey with CONDITIONAL node |
| 3 | Create Journey - Delay | 5-second wait between messages | Creates journey with DELAY node |
| 4 | Trigger - Senior Patient | Age 65 (≥60) | Takes senior branch, completes immediately |
| 5 | Trigger - Adult Patient | Age 45 (<60) | Takes adult branch, completes immediately |
| 6 | Trigger - With Delay | Starts delayed journey | Returns with `status: "waiting"` |
| 7 | Get Status - Senior | Check execution log | Shows senior message in log |
| 8 | Get Status - Adult | Check execution log | Shows adult message in log |
| 9 | Get Status - Delayed (Early) | Check while waiting | Shows `status: "waiting"` with `wakeUpAt` |
| 10 | Get Status - Delayed (After) | Check after 6+ seconds | Shows `status: "completed"` |

**Key Demonstrations:**
- ✅ **Conditional Branching**: Age-based logic (requests 4-5, 7-8)
- ✅ **Async Execution**: DELAY nodes with timer-based resumption (requests 6, 9-10)
- ✅ **Execution Logs**: Full audit trail of node processing (all status checks)
- ✅ **Inline Patient Creation**: No pre-existing patient records needed (requests 4-6)
- ✅ **State Management**: Active → Waiting → Completed transitions (request 6, 9-10)

**Troubleshooting:**

- **Connection refused**: Ensure the server is running (`npm start`)
- **404 errors**: Check `base_url` variable matches your server
- **MongoDB errors**: Verify MongoDB is running and accessible
- **Test failures**: Review the test script output for specific assertion failures
- **Variables not found**: Run earlier requests first to populate variables

## API Endpoints

All endpoints use JSON request/response format.

### Journeys

- `GET /journeys` - List all journeys
- `GET /journeys/:id` - Get journey by ID
- `POST /journeys` - Create a new journey
- `PUT /journeys/:id` - Update journey
- `DELETE /journeys/:id` - Delete journey
- `POST /journeys/:journeyId/trigger` - Start a journey run for a patient

### Journey Runs

- `GET /journeys/runs/:runId` - Get run status and execution log
- `POST /journeys/runs/:runId/resume` - Resume a waiting run (for DELAY nodes)
- `DELETE /journeys/runs/:runId` - Cancel an active/waiting run

### Patients

- `GET /patients` - List all patients
- `GET /patients/:id` - Get patient by ID
- `POST /patients` - Create patient
- `PUT /patients/:id` - Update patient
- `DELETE /patients/:id` - Delete patient

### Health

- `GET /health` - Health check endpoint

## Example Usage

### 1. Create a Patient

```bash
curl -X POST http://localhost:3000/patients \
  -H "Content-Type: application/json" \
  -d '{
    "age": 62,
    "language": "en",
    "condition": "hip_replacement"
  }'
```

### 2. Create a Journey

```bash
curl -X POST http://localhost:3000/journeys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Recovery Journey",
    "start_node_id": "start",
    "nodes": [
      {
        "id": "start",
        "type": "MESSAGE",
        "message": "Welcome to your recovery journey!",
        "next_node_id": "checkAge"
      },
      {
        "id": "checkAge",
        "type": "CONDITIONAL",
        "condition": {
          "field": "age",
          "operator": ">=",
          "value": 60
        },
        "on_true_next_node_id": "seniorMsg",
        "on_false_next_node_id": "adultMsg"
      },
      {
        "id": "seniorMsg",
        "type": "MESSAGE",
        "message": "Senior-specific guidance here.",
        "next_node_id": null
      },
      {
        "id": "adultMsg",
        "type": "MESSAGE",
        "message": "Adult-specific guidance here.",
        "next_node_id": null
      }
    ]
  }'
```

### 3. Trigger a Journey

```bash
curl -X POST http://localhost:3000/journeys/<journeyId>/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "<patientId>"
  }'
```

Or create a patient inline:
```bash
curl -X POST http://localhost:3000/journeys/<journeyId>/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "patient": {
      "age": 55,
      "language": "en",
      "condition": "knee_replacement"
    }
  }'
```

### 4. Check Run Status

```bash
curl http://localhost:3000/journeys/runs/<runId>
```

## Implementation Overview

### Architecture

The application follows a clean layered architecture:

```
src/
├── models/          # Mongoose schemas (Journey, Patient, JourneyRun)
├── routes/          # Express route handlers
├── controllers/     # Business logic for API endpoints
├── services/        # Core journey execution engine
├── middleware/      # Validation and error handling
├── types/           # TypeScript type definitions
└── tests/           # Jest test suites
```

### Key Components

**Journey Executor (`services/journeyExecutor.ts`)**
- Manages persistent journey execution with state recovery
- Handles MESSAGE, DELAY, and CONDITIONAL node types
- Uses in-memory timers for DELAY nodes with database backup
- Automatically recovers waiting runs on server restart

**Journey Engine (`services/journeyEngine.ts`)**
- Core execution logic for processing nodes
- Evaluates conditional expressions against patient context
- Produces detailed execution logs for debugging

**Models**
- `Journey`: Defines the workflow structure (nodes and transitions)
- `Patient`: Stores patient demographic and condition data
- `JourneyRun`: Persists execution state, logs, and status

### Node Types

1. **MESSAGE** - Logs a message to the execution log
   ```json
   {
     "id": "welcome",
     "type": "MESSAGE",
     "message": "Welcome!",
     "next_node_id": "next"
   }
   ```

2. **DELAY** - Pauses execution for a specified duration
   ```json
   {
     "id": "wait",
     "type": "DELAY",
     "duration_seconds": 3600,
     "next_node_id": "next"
   }
   ```

3. **CONDITIONAL** - Branches based on patient data
   ```json
   {
     "id": "ageCheck",
     "type": "CONDITIONAL",
     "condition": {
       "field": "age",
       "operator": ">=",
       "value": 60
     },
     "on_true_next_node_id": "senior",
     "on_false_next_node_id": "adult"
   }
   ```

### Run Status

Journey runs progress through the following states:

- `active` - Currently executing nodes
- `waiting` - Paused on a DELAY node, will resume at `wakeUpAt` timestamp
- `completed` - Journey reached terminal node
- `failed` - Execution error or manual cancellation

### Design Choices

1. **Persistent State**: All runs are persisted to MongoDB, allowing recovery after server restarts
2. **In-Memory Timers**: DELAY nodes use `setTimeout` for immediate response, backed by database state
3. **Automatic Recovery**: On startup, the executor reschedules all overdue waiting runs
4. **Execution Logs**: Every node execution appends to the run's `executionLog` array for auditability
5. **Inline Patient Creation**: The trigger endpoint accepts either `patientId` or inline `patient` object for flexibility

### Assumptions

- All side effects (messages, notifications) are stubbed with console logs
- DELAY timers are in-memory only; server restarts will cause slight delays in resume times
- Conditional operators support: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Journey nodes must form a valid DAG (no cycle detection implemented)
- Patient context fields are top-level properties (e.g., `age`, `language`, `condition`)

### Limitations

1. **No Cycle Detection**: Journeys with circular references will cause infinite loops
2. **Single-Server**: Timer-based delays don't scale across multiple server instances
3. **Limited Operators**: Conditional logic is restricted to simple field comparisons
4. **No Complex Expressions**: Cannot evaluate compound conditions (AND/OR)
5. **No Versioning**: Journey updates don't version-control existing runs
6. **No Retry Logic**: Failed runs do not automatically retry
7. **No Real Integrations**: MESSAGE and DELAY actions are logged only, not integrated with external systems

### Error Handling

All errors follow a consistent format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "additional context"
  }
}
```

HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict (invalid state transition)
- `500` - Internal Server Error

### Logging

Console logs use prefixes for easy filtering:
- `[ENGINE]` - Journey execution engine
- `[EXECUTOR]` - Journey executor (timers, recovery)
- `[API]` - API request handling
- `[DB]` - Database operations
- `[ACTION]` - Node execution (MESSAGE, DELAY, CONDITIONAL)
- `[ERROR]` - Error conditions

## Tech Stack

- **Runtime**: Node.js with TypeScript (strict mode)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Testing**: Jest + ts-jest + Supertest
- **Validation**: Custom middleware with Mongoose schema validation

## Project Structure

```
Journey/
├── src/
│   ├── models/              # Data models
│   ├── routes/              # API routes
│   ├── controllers/         # Request handlers
│   ├── services/            # Business logic
│   ├── middleware/          # Express middleware
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilities (DB connection)
│   ├── config.ts            # Configuration
│   └── index.ts             # Application entry point
├── tests/
│   └── api/                 # Integration tests
├── dist/                    # Compiled JavaScript (generated)
├── coverage/                # Test coverage reports (generated)
├── .env                     # Environment variables (create from .env.example)
├── .env.example             # Example environment configuration
├── tsconfig.json            # TypeScript configuration
├── jest.config.js           # Jest configuration
└── package.json             # Dependencies and scripts
```

## Contributing

When adding new features:
1. Add types to `src/types/`
2. Update models if schema changes are needed
3. Add controller logic
4. Wire routes in `src/routes/`
5. Write tests in `src/tests/api/`
6. Update this README

## License

Private project - not licensed for public use.
