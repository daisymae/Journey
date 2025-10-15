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
// In-memory mock for Journey model
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
            findByIdAndUpdate: (id, body, opts) => __awaiter(void 0, void 0, void 0, function* () {
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
// Mock Patient model for start endpoint when patientId is used (we will pass patient context directly in tests)
jest.mock('../../models/Patient', () => ({
    Patient: {},
}));
describe('Journeys API', () => {
    const app = (0, index_1.default)();
    const validJourney = {
        id: 'j1',
        name: 'Test Journey',
        start_node_id: 'n1',
        nodes: [
            { id: 'n1', type: 'MESSAGE', message: 'Hello', next_node_id: null },
        ],
    };
    test('POST /api/journeys - create journey (valid)', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).post('/api/journeys').send(validJourney);
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ id: 'j1', name: 'Test Journey' });
    }));
    test('GET /api/journeys - list journeys', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/api/journeys');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    }));
    test('GET /api/journeys/:id - get journey by id', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/api/journeys/j1');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: 'j1' });
    }));
    test('PUT /api/journeys/:id - update journey', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).put('/api/journeys/j1').send(Object.assign(Object.assign({}, validJourney), { name: 'Updated' }));
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated');
    }));
    test('POST /api/journeys - validation error (missing nodes)', () => __awaiter(void 0, void 0, void 0, function* () {
        const bad = { id: 'bad', name: 'Bad', start_node_id: 'x', nodes: [] };
        const res = yield (0, supertest_1.default)(app).post('/api/journeys').send(bad);
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'BAD_REQUEST' });
    }));
    test('POST /api/journeys/:id/start - starts journey for patient context', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app)
            .post('/api/journeys/j1/start')
            .send({ patient: { id: 'p1', age: 50, language: 'en', condition: 'hip_replacement' } });
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ status: 'started' });
    }));
    test('DELETE /api/journeys/:id - delete journey', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).delete('/api/journeys/j1');
        expect(res.status).toBe(204);
    }));
    test('GET /api/journeys/:id - 404 after delete', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/api/journeys/j1');
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    }));
});
