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
exports.startJourneyRun = startJourneyRun;
exports.resumeRun = resumeRun;
exports.getRun = getRun;
exports.listPatientRuns = listPatientRuns;
exports.cancelRun = cancelRun;
const journeyExecutor_1 = require("../services/journeyExecutor");
function toHttpError(err) {
    const status = (err === null || err === void 0 ? void 0 : err.status) || 500;
    const message = (err === null || err === void 0 ? void 0 : err.message) || 'Internal Server Error';
    return { status, body: { error: message, code: status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR', details: {} } };
}
function startJourneyRun(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { patientId } = req.body || {};
            if (!patientId)
                return res.status(400).json({ error: 'Bad Request', code: 'MISSING_PATIENT', details: { message: 'Provide patientId' } });
            const run = yield journeyExecutor_1.journeyExecutor.startJourney(req.params.journeyId || req.params.id, String(patientId));
            res.status(201).json(run);
        }
        catch (err) {
            const http = toHttpError(err);
            res.status(http.status).json(http.body);
        }
    });
}
function resumeRun(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield journeyExecutor_1.journeyExecutor.resumeJourney(req.params.runId);
            res.status(202).json({ status: 'resuming' });
        }
        catch (err) {
            const http = toHttpError(err);
            res.status(http.status).json(http.body);
        }
    });
}
function getRun(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const run = yield journeyExecutor_1.journeyExecutor.getRunStatus(req.params.runId);
            res.json(run);
        }
        catch (err) {
            const http = toHttpError(err);
            res.status(http.status).json(http.body);
        }
    });
}
function listPatientRuns(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { status } = req.query || {};
            const runs = yield journeyExecutor_1.journeyExecutor.getPatientRuns(req.params.patientId, status);
            res.json(runs);
        }
        catch (err) {
            const http = toHttpError(err);
            res.status(http.status).json(http.body);
        }
    });
}
function cancelRun(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield journeyExecutor_1.journeyExecutor.cancelRun(req.params.runId);
            res.status(202).json({ status: 'cancelled' });
        }
        catch (err) {
            const http = toHttpError(err);
            res.status(http.status).json(http.body);
        }
    });
}
