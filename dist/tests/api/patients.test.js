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
// In-memory mock for Patient model
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
describe('Patients API', () => {
    const app = (0, index_1.default)();
    const validPatient = { id: 'p1', age: 45, language: 'en', condition: 'knee_replacement' };
    test('POST /api/patients - validation errors', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).post('/api/patients').send({ age: 'x', language: 'en', condition: 'knee_replacement' });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'BAD_REQUEST' });
    }));
    test('POST /api/patients - create patient (valid)', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).post('/api/patients').send(validPatient);
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ id: 'p1', age: 45 });
    }));
    test('GET /api/patients - list', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/api/patients');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
    }));
    test('GET /api/patients/:id - get by id', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/api/patients/p1');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: 'p1' });
    }));
    test('PUT /api/patients/:id - update', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).put('/api/patients/p1').send(Object.assign(Object.assign({}, validPatient), { age: 46 }));
        expect(res.status).toBe(200);
        expect(res.body.age).toBe(46);
    }));
    test('DELETE /api/patients/:id - delete', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).delete('/api/patients/p1');
        expect(res.status).toBe(204);
    }));
    test('GET /api/patients/:id - 404 after delete', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app).get('/api/patients/p1');
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    }));
});
