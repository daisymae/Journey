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
Object.defineProperty(exports, "__esModule", { value: true });
const journeyExecutor_1 = require("../../services/journeyExecutor");
jest.useFakeTimers();
// Mock Journey model (in-memory)
jest.mock('../../models/Journey', () => {
    const store = {};
    const wrap = (obj) => (Object.assign(Object.assign({}, obj), { toJSON: () => obj, id: obj.id }));
    return {
        Journey: {
            findById: (id) => __awaiter(void 0, void 0, void 0, function* () { return (store[id] ? wrap(store[id]) : null); }),
            __set: (id, doc) => { store[id] = doc; },
        },
    };
});
// Mock Patient model (in-memory)
jest.mock('../../models/Patient', () => {
    const store = {};
    const wrap = (obj) => (Object.assign(Object.assign({}, obj), { toJSON: () => obj, id: obj.id }));
    return {
        Patient: {
            findById: (id) => __awaiter(void 0, void 0, void 0, function* () { return (store[id] ? wrap(store[id]) : null); }),
            __set: (id, doc) => { store[id] = doc; },
        },
    };
});
// Mock JourneyRun model with minimal Mongo-like interface
jest.mock('../../models/JourneyRun', () => {
    const store = {};
    const wrap = (obj) => (Object.assign(Object.assign({}, obj), { toJSON: () => obj }));
    return {
        JourneyRun: {
            create: (body) => __awaiter(void 0, void 0, void 0, function* () {
                store[body.runId] = Object.assign({}, body);
                return wrap(store[body.runId]);
            }),
            findOne: (filter) => {
                const key = filter.runId;
                const doc = store[key];
                return doc
                    ? Object.assign(Object.assign({}, wrap(doc)), { lean: () => __awaiter(void 0, void 0, void 0, function* () { return (Object.assign({}, doc)); }) }) : { lean: () => __awaiter(void 0, void 0, void 0, function* () { return null; }) };
            },
            updateOne: (filter, update) => {
                const key = filter.runId;
                const doc = store[key];
                if (!doc)
                    return { exec: () => __awaiter(void 0, void 0, void 0, function* () { }) };
                if (update.$set) {
                    Object.assign(doc, update.$set);
                }
                if (update.$push && update.$push.executionLog) {
                    doc.executionLog = doc.executionLog || [];
                    doc.executionLog.push(update.$push.executionLog);
                }
                return { exec: () => __awaiter(void 0, void 0, void 0, function* () { }) };
            },
            find: (query) => __awaiter(void 0, void 0, void 0, function* () {
                const arr = Object.values(store).filter((r) => {
                    if (query.patientId && r.patientId !== query.patientId)
                        return false;
                    if (query.status && r.status !== query.status)
                        return false;
                    if (query.wakeUpAt && query.wakeUpAt.$lte) {
                        return r.wakeUpAt && new Date(r.wakeUpAt) <= query.wakeUpAt.$lte;
                    }
                    return true;
                });
                return arr.map(wrap);
            }),
            __getStore: () => store,
        },
    };
});
const { Journey } = jest.requireMock('../../models/Journey');
const { Patient } = jest.requireMock('../../models/Patient');
const { JourneyRun } = jest.requireMock('../../models/JourneyRun');
function seedJourney(j) { Journey.__set(j.id, j); }
function seedPatient(p) { Patient.__set(p.id, p); }
function waitForStatus(runId, expected) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { JourneyRun } = jest.requireMock('../../models/JourneyRun');
        const store = JourneyRun.__getStore();
        for (let i = 0; i < 200; i++) {
            if (((_a = store[runId]) === null || _a === void 0 ? void 0 : _a.status) === expected)
                return;
            // Flush any pending timers and microtasks to allow async progress
            try {
                jest.runOnlyPendingTimers();
            }
            catch (_b) { }
            yield Promise.resolve();
        }
        throw new Error(`Timed out waiting for status ${expected}`);
    });
}
describe('JourneyExecutor (unit, mocked persistence)', () => {
    beforeEach(() => {
        // Clear any timers between tests
        jest.clearAllTimers();
    });
    test('active → waiting → active → completed flow with DELAY', () => __awaiter(void 0, void 0, void 0, function* () {
        seedJourney({
            id: 'j-delay',
            name: 'Delay Journey',
            start_node_id: 'm1',
            nodes: [
                { id: 'm1', type: 'MESSAGE', message: 'Hi', next_node_id: 'd1' },
                { id: 'd1', type: 'DELAY', duration_seconds: 1, next_node_id: 'm2' },
                { id: 'm2', type: 'MESSAGE', message: 'Done', next_node_id: null },
            ],
        });
        seedPatient({ id: 'p1', age: 30, language: 'en', condition: 'hip_replacement' });
        const run = yield journeyExecutor_1.journeyExecutor.startJourney('j-delay', 'p1');
        yield waitForStatus(run.runId, 'waiting');
        const store = JourneyRun.__getStore();
        expect(store[run.runId].status).toBe('waiting');
        // Advance delay
        jest.advanceTimersByTime(1000);
        yield waitForStatus(run.runId, 'completed');
        expect(store[run.runId].status).toBe('completed');
        expect(store[run.runId].completedAt).toBeTruthy();
    }));
    test('Error handling: invalid operator should fail run', () => __awaiter(void 0, void 0, void 0, function* () {
        seedJourney({
            id: 'j-bad',
            name: 'Bad Journey',
            start_node_id: 'c1',
            nodes: [
                { id: 'c1', type: 'CONDITIONAL', condition: { field: 'age', operator: '??', value: 10 }, on_true_next_node_id: null, on_false_next_node_id: null },
            ],
        });
        seedPatient({ id: 'p1', age: 30, language: 'en', condition: 'hip_replacement' });
        const run = yield journeyExecutor_1.journeyExecutor.startJourney('j-bad', 'p1');
        yield waitForStatus(run.runId, 'failed');
        const store = JourneyRun.__getStore();
        expect(store[run.runId].status).toBe('failed');
        expect(store[run.runId].errorMessage || '').toBeDefined();
    }));
    test('Cancel behavior: sets status failed', () => __awaiter(void 0, void 0, void 0, function* () {
        seedJourney({
            id: 'j-cancel',
            name: 'Cancel Journey',
            start_node_id: 'm1',
            nodes: [
                { id: 'm1', type: 'MESSAGE', message: 'Hi', next_node_id: null },
            ],
        });
        seedPatient({ id: 'p1', age: 30, language: 'en', condition: 'hip_replacement' });
        const run = yield journeyExecutor_1.journeyExecutor.startJourney('j-cancel', 'p1');
        yield journeyExecutor_1.journeyExecutor.cancelRun(run.runId);
        const store = JourneyRun.__getStore();
        expect(store[run.runId].status).toBe('failed');
        expect(store[run.runId].errorMessage).toBe('Cancelled by user');
    }));
});
