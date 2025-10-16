"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
// Mock journeyExecutor with in-memory runs store
jest.mock('../../services/journeyExecutor', () => {
    const runs = {};
    let seq = 1;
    const now = () => new Date().toISOString();
    return {
        journeyExecutor: {
            startJourney: jest.fn((journeyId, patientId) => __awaiter(void 0, void 0, void 0, function* () {
                const runId = `r${seq++}`;
                const run = {
                    runId,
                    journeyId,
                    patientId,
                    currentNodeId: 'n2',
                    status: 'active',
                    wakeUpAt: null,
                    startedAt: now(),
                    completedAt: null,
                    executionLog: [],
                };
                runs[runId] = run;
                return run;
            })),
            resumeJourney: jest.fn((runId) => __awaiter(void 0, void 0, void 0, function* () {
                const run = runs[runId];
                if (!run) {
                    const err = new Error('Run not found');
                    err.status = 404;
                    throw err;
                }
                if (run.status !== 'waiting') {
                    const err = new Error('Run not waiting');
                    err.status = 409;
                    throw err;
                }
                run.status = 'active';
            })),
            getRunStatus: jest.fn((runId) => __awaiter(void 0, void 0, void 0, function* () {
                const run = runs[runId];
                if (!run) {
                    const err = new Error('Run not found');
                    err.status = 404;
                    throw err;
                }
                return run;
            })),
            getPatientRuns: jest.fn((patientId, status) => __awaiter(void 0, void 0, void 0, function* () {
                const arr = Object.values(runs).filter((r) => r.patientId === patientId);
                const filtered = status ? arr.filter((r) => r.status === status) : arr;
                return filtered.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
            })),
            cancelRun: jest.fn((runId) => __awaiter(void 0, void 0, void 0, function* () {
                const run = runs[runId];
                if (!run) {
                    const err = new Error('Run not found');
                    err.status = 404;
                    throw err;
                }
                run.status = 'failed';
                run.errorMessage = 'Cancelled by user';
            })),
            recoverDueRuns: jest.fn(() => __awaiter(void 0, void 0, void 0, function* () { })),
            stopAllTimers: jest.fn(() => { }),
        },
    };
});
// Mock Journey model for creating the journey to start
jest.mock('../../models/Journey', () => {
    const store = [];
    let seq = 1;
    const wrap = (obj) => (Object.assign(Object.assign({}, obj), { toJSON: () => obj, id: obj.id }));
    return {
        Journey: {
            create: (body) => __awaiter(void 0, void 0, void 0, function* () {
                const id = body.id || String(seq++);
                const doc = Object.assign(Object.assign({}, body), { id });
                store.push(doc);
                return wrap(doc);
            }),
            find: () => __awaiter(void 0, void 0, void 0, function* () { return store.map(wrap); }),
            findById: (id) => __awaiter(void 0, void 0, void 0, function* () {
                const doc = store.find((j) => j.id === id);
                return doc ? wrap(doc) : null;
            }),
            findByIdAndUpdate: (id, body) => __awaiter(void 0, void 0, void 0, function* () {
                const idx = store.findIndex((j) => j.id === id);
                if (idx === -1)
                    return null;
                const updated = Object.assign(Object.assign({}, store[idx]), body);
                store[idx] = updated;
                return wrap(updated);
            }),
            findByIdAndDelete: (id) => __awaiter(void 0, void 0, void 0, function* () {
                const idx = store.findIndex((j) => j.id === id);
                if (idx === -1)
                    return null;
                const [removed] = store.splice(idx, 1);
                return wrap(removed);
            }),
        },
    };
});
// Mock Patient model to allow patient creation and lookup
jest.mock('../../models/Patient', () => {
    const store = [];
    let seq = 1;
    const wrap = (obj) => (Object.assign(Object.assign({}, obj), { toJSON: () => obj, id: obj.id }));
    return {
        Patient: {
            create: (body) => __awaiter(void 0, void 0, void 0, function* () {
                const id = body.id || String(seq++);
                const doc = Object.assign(Object.assign({}, body), { id });
                store.push(doc);
                return wrap(doc);
            }),
            find: () => __awaiter(void 0, void 0, void 0, function* () { return store.map(wrap); }),
            findById: (id) => __awaiter(void 0, void 0, void 0, function* () {
                const doc = store.find((p) => p.id === id);
                return doc ? wrap(doc) : null;
            }),
            findByIdAndUpdate: (id, body) => __awaiter(void 0, void 0, void 0, function* () {
                const idx = store.findIndex((p) => p.id === id);
                if (idx === -1)
                    return null;
                const updated = Object.assign(Object.assign({}, store[idx]), body);
                store[idx] = updated;
                return wrap(updated);
            }),
            findByIdAndDelete: (id) => __awaiter(void 0, void 0, void 0, function* () {
                const idx = store.findIndex((p) => p.id === id);
                if (idx === -1)
                    return null;
                const [removed] = store.splice(idx, 1);
                return wrap(removed);
            }),
        },
    };
});
describe('Runs API', () => {
    const app = (0, index_1.default)();
    test('Start run returns JourneyRun and persists initial state (mocked)', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create a journey and patient
        yield (0, supertest_1.default)(app).post('/journeys').send({ id: 'j-start', name: 'J', start_node_id: 'n1', nodes: [{ id: 'n1', type: 'MESSAGE', message: 'Hi', next_node_id: null }] });
        yield (0, supertest_1.default)(app).post('/patients').send({ id: 'p-start', age: 40, language: 'en', condition: 'hip_replacement' });
        const res = yield (0, supertest_1.default)(app).post('/journeys/j-start/trigger').send({ patientId: 'p-start' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('runId');
        expect(res.body).toMatchObject({ journeyId: 'j-start', patientId: 'p-start', status: 'active' });
    }));
    test('Get run status reflects data from executor (mocked)', () => __awaiter(void 0, void 0, void 0, function* () {
        const start = yield (0, supertest_1.default)(app).post('/journeys/j-start/trigger').send({ patientId: 'p-start' });
        const runId = start.body.runId;
        const res = yield (0, supertest_1.default)(app).get(`/journeys/runs/${runId}`);
        expect(res.status).toBe(200);
        expect(res.body.runId).toBe(runId);
    }));
    test('List patient runs', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/patients/p-start/runs');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    }));
    test('Resume run returns 409 when not waiting (mocked)', () => __awaiter(void 0, void 0, void 0, function* () {
        const start = yield (0, supertest_1.default)(app).post('/journeys/j-start/trigger').send({ patientId: 'p-start' });
        const runId = start.body.runId;
        const res = yield (0, supertest_1.default)(app).post(`/journeys/runs/${runId}/resume`).send();
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'CONFLICT' });
    }));
    test('Cancel run', () => __awaiter(void 0, void 0, void 0, function* () {
        const start = yield (0, supertest_1.default)(app).post('/journeys/j-start/trigger').send({ patientId: 'p-start' });
        const runId = start.body.runId;
        const res = yield (0, supertest_1.default)(app).delete(`/journeys/runs/${runId}`);
        expect(res.status).toBe(202);
        // Optionally get status after cancel
        const get = yield (0, supertest_1.default)(app).get(`/journeys/runs/${runId}`);
        expect(get.body.status).toBe('failed');
    }));
});
