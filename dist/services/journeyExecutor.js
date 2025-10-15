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
exports.journeyExecutor = void 0;
const uuid_1 = require("uuid");
const Journey_1 = require("../models/Journey");
const Patient_1 = require("../models/Patient");
const JourneyRun_1 = require("../models/JourneyRun");
const nodeProcessor_1 = require("./nodeProcessor");
const messageService_1 = require("./messageService");
function nowISO() { return new Date().toISOString(); }
function buildNodeMap(journey) {
    const map = {};
    for (const node of journey.nodes)
        map[node.id] = node;
    return map;
}
function validateJourney(journey, map) {
    if (!journey.nodes || journey.nodes.length === 0)
        throw new Error('Journey must have at least one node');
    if (!map[journey.start_node_id])
        throw new Error('start_node_id must reference an existing node');
    const ids = new Set(Object.keys(map));
    for (const n of journey.nodes) {
        if (n.type === 'MESSAGE' || n.type === 'DELAY') {
            const next = n.next_node_id;
            if (next != null && !ids.has(next))
                throw new Error(`Node ${n.id} references missing next_node_id ${next}`);
        }
        else if (n.type === 'CONDITIONAL') {
            const t = n.on_true_next_node_id;
            const f = n.on_false_next_node_id;
            if (t != null && !ids.has(t))
                throw new Error(`Node ${n.id} references missing on_true_next_node_id ${t}`);
            if (f != null && !ids.has(f))
                throw new Error(`Node ${n.id} references missing on_false_next_node_id ${f}`);
        }
    }
}
class JourneyExecutor {
    constructor() {
        this.timers = new Map();
    }
    // Timer helpers
    setTimer(runId, ms) {
        this.clearTimer(runId);
        const t = setTimeout(() => {
            this.timers.delete(runId);
            this.resumeJourney(runId).catch((err) => {
                console.error(`[RUN:${runId}] Error resuming journey`, err);
            });
        }, ms);
        this.timers.set(runId, t);
    }
    clearTimer(runId) {
        const t = this.timers.get(runId);
        if (t) {
            clearTimeout(t);
            this.timers.delete(runId);
        }
    }
    stopAllTimers() {
        for (const [runId, t] of this.timers.entries()) {
            clearTimeout(t);
            this.timers.delete(runId);
        }
    }
    // Persistence helpers
    appendLog(runId, entry) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = entry.timestamp || nowISO();
            yield JourneyRun_1.JourneyRun.updateOne({ runId }, { $push: { executionLog: Object.assign(Object.assign({}, entry), { timestamp }) } }).exec();
        });
    }
    setStatus(runId_1, status_1) {
        return __awaiter(this, arguments, void 0, function* (runId, status, patch = {}) {
            var _a, _b, _c;
            const update = { status };
            if ('currentNodeId' in patch)
                update.currentNodeId = (_a = patch.currentNodeId) !== null && _a !== void 0 ? _a : null;
            if ('wakeUpAt' in patch)
                update.wakeUpAt = (_b = patch.wakeUpAt) !== null && _b !== void 0 ? _b : null;
            if ('completedAt' in patch)
                update.completedAt = (_c = patch.completedAt) !== null && _c !== void 0 ? _c : null;
            if ('errorMessage' in patch)
                update.errorMessage = patch.errorMessage;
            yield JourneyRun_1.JourneyRun.updateOne({ runId }, { $set: update }).exec();
        });
    }
    loadContext(journeyId, patientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const journeyDoc = yield Journey_1.Journey.findById(journeyId);
            if (!journeyDoc)
                throw new Error('Journey not found');
            const journey = journeyDoc.toJSON();
            const map = buildNodeMap(journey);
            validateJourney(journey, map);
            const patientDoc = yield Patient_1.Patient.findById(patientId);
            if (!patientDoc)
                throw new Error('Patient not found');
            const patient = { id: patientDoc.id, age: patientDoc.age, language: patientDoc.language, condition: patientDoc.condition };
            return { journey, map, patient };
        });
    }
    process(runId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const run = yield JourneyRun_1.JourneyRun.findOne({ runId }).lean();
            if (!run)
                throw new Error('Run not found');
            const { journey, map, patient } = yield this.loadContext(run.journeyId, run.patientId);
            let currentNodeId = run.currentNodeId;
            try {
                yield this.setStatus(runId, 'active', { wakeUpAt: null });
                while (currentNodeId != null) {
                    const node = map[currentNodeId];
                    if (!node) {
                        const msg = `Node not found: ${currentNodeId}`;
                        console.error(`[RUN:${runId}] ${msg}`);
                        yield this.appendLog(runId, { nodeId: currentNodeId, nodeType: 'MESSAGE', action: 'ERROR', details: msg });
                        yield this.setStatus(runId, 'failed', { completedAt: new Date() });
                        return;
                    }
                    console.log(`[RUN:${runId}] Processing node ${node.id} (${node.type}) for patient ${patient.id}`);
                    switch (node.type) {
                        case 'MESSAGE': {
                            (0, messageService_1.sendMessage)(patient.id, node.message);
                            yield this.appendLog(runId, { nodeId: node.id, nodeType: 'MESSAGE', action: `Sent message: ${node.message}` });
                            currentNodeId = node.next_node_id;
                            yield this.setStatus(runId, 'active', { currentNodeId });
                            break;
                        }
                        case 'DELAY': {
                            const delayMs = Math.max(0, (node.duration_seconds || 0) * 1000);
                            const wake = new Date(Date.now() + delayMs);
                            yield this.appendLog(runId, { nodeId: node.id, nodeType: 'DELAY', action: `Delay ${node.duration_seconds}s`, details: { next: node.next_node_id } });
                            yield this.setStatus(runId, 'waiting', { currentNodeId: node.next_node_id, wakeUpAt: wake });
                            console.log(`[RUN:${runId}][DELAY] Waiting ${node.duration_seconds}s before next node ${(_a = node.next_node_id) !== null && _a !== void 0 ? _a : 'END'}`);
                            this.setTimer(runId, delayMs);
                            return; // pause processing until resume
                        }
                        case 'CONDITIONAL': {
                            const result = (0, nodeProcessor_1.evaluateCondition)(node.condition, patient);
                            yield this.appendLog(runId, { nodeId: node.id, nodeType: 'CONDITIONAL', action: `Evaluated ${node.condition.field} ${node.condition.operator} ${JSON.stringify(node.condition.value)} => ${result}`, details: { result } });
                            currentNodeId = result ? node.on_true_next_node_id : node.on_false_next_node_id;
                            yield this.setStatus(runId, 'active', { currentNodeId });
                            break;
                        }
                        default: {
                            const neverNode = node;
                            throw new Error(`Unsupported node type: ${neverNode.type}`);
                        }
                    }
                }
                // Completed
                yield this.appendLog(runId, { nodeId: 'END', nodeType: 'MESSAGE', action: 'Journey completed' });
                yield this.setStatus(runId, 'completed', { completedAt: new Date(), currentNodeId: null });
                this.clearTimer(runId);
                console.log(`[RUN:${runId}] Journey completed.`);
            }
            catch (err) {
                console.error(`[RUN:${runId}] Failed with error:`, err);
                yield this.appendLog(runId, { nodeId: currentNodeId || 'UNKNOWN', nodeType: 'MESSAGE', action: 'ERROR', details: (err === null || err === void 0 ? void 0 : err.message) || String(err) });
                yield this.setStatus(runId, 'failed', { errorMessage: err === null || err === void 0 ? void 0 : err.message, completedAt: new Date() });
                this.clearTimer(runId);
            }
        });
    }
    startJourney(journeyId, patientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const runId = (0, uuid_1.v4)();
            const startedAt = new Date();
            // Validate journey and patient exist first
            const journeyDoc = yield Journey_1.Journey.findById(journeyId);
            if (!journeyDoc)
                throw Object.assign(new Error('Journey not found'), { status: 404 });
            const patientDoc = yield Patient_1.Patient.findById(patientId);
            if (!patientDoc)
                throw Object.assign(new Error('Patient not found'), { status: 404 });
            const journey = journeyDoc.toJSON();
            const map = buildNodeMap(journey);
            validateJourney(journey, map);
            const run = yield JourneyRun_1.JourneyRun.create({
                runId,
                journeyId,
                patientId,
                currentNodeId: journey.start_node_id,
                status: 'active',
                wakeUpAt: null,
                startedAt,
                completedAt: null,
                executionLog: [],
            });
            // Fire and forget processing
            this.process(runId).catch((err) => {
                console.error(`[RUN:${runId}] Error during start`, err);
            });
            return run.toJSON();
        });
    }
    resumeJourney(runId) {
        return __awaiter(this, void 0, void 0, function* () {
            const run = yield JourneyRun_1.JourneyRun.findOne({ runId });
            if (!run)
                throw Object.assign(new Error('Run not found'), { status: 404 });
            if (run.status !== 'waiting')
                throw Object.assign(new Error('Run is not waiting'), { status: 409 });
            yield this.setStatus(runId, 'active', { wakeUpAt: null });
            yield this.process(runId);
        });
    }
    getRunStatus(runId) {
        return __awaiter(this, void 0, void 0, function* () {
            const run = yield JourneyRun_1.JourneyRun.findOne({ runId });
            if (!run)
                throw Object.assign(new Error('Run not found'), { status: 404 });
            return run.toJSON();
        });
    }
    getPatientRuns(patientId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { patientId };
            if (status)
                query.status = status;
            const runs = yield JourneyRun_1.JourneyRun.find(query).sort({ startedAt: -1 });
            return runs.map(r => r.toJSON());
        });
    }
    cancelRun(runId) {
        return __awaiter(this, void 0, void 0, function* () {
            const run = yield JourneyRun_1.JourneyRun.findOne({ runId });
            if (!run)
                throw Object.assign(new Error('Run not found'), { status: 404 });
            this.clearTimer(runId);
            yield this.appendLog(runId, { nodeId: run.currentNodeId || 'UNKNOWN', nodeType: 'MESSAGE', action: 'Cancelled by user' });
            yield this.setStatus(runId, 'failed', { errorMessage: 'Cancelled by user', completedAt: new Date() });
        });
    }
    recoverDueRuns() {
        return __awaiter(this, void 0, void 0, function* () {
            const due = yield JourneyRun_1.JourneyRun.find({ status: 'waiting', wakeUpAt: { $lte: new Date() } });
            for (const run of due) {
                const delayMs = 0; // overdue, resume immediately
                console.log(`[RUN:${run.runId}] Recovering overdue waiting run`);
                this.clearTimer(run.runId);
                this.setTimer(run.runId, delayMs);
            }
        });
    }
}
exports.journeyExecutor = new JourneyExecutor();
