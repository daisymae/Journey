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
exports.createJourney = createJourney;
exports.getJourneys = getJourneys;
exports.getJourney = getJourney;
exports.updateJourney = updateJourney;
exports.deleteJourney = deleteJourney;
exports.startJourney = startJourney;
const Journey_1 = require("../models/Journey");
const Patient_1 = require("../models/Patient");
const journeyExecutor_1 = require("../services/journeyExecutor");
function createJourney(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const journey = yield Journey_1.Journey.create(req.body);
            console.log('[API] Created journey', journey.id);
            res.status(201).json(journey.toJSON());
        }
        catch (err) {
            next(err);
        }
    });
}
function getJourneys(_req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const journeys = yield Journey_1.Journey.find();
            res.json(journeys.map(j => j.toJSON()));
        }
        catch (err) {
            next(err);
        }
    });
}
function getJourney(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const journey = yield Journey_1.Journey.findById(req.params.id);
            if (!journey)
                return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });
            res.json(journey.toJSON());
        }
        catch (err) {
            next(err);
        }
    });
}
function updateJourney(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const journey = yield Journey_1.Journey.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
            if (!journey)
                return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });
            res.json(journey.toJSON());
        }
        catch (err) {
            next(err);
        }
    });
}
function deleteJourney(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const journey = yield Journey_1.Journey.findByIdAndDelete(req.params.id);
            if (!journey)
                return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    });
}
function startJourney(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const journey = yield Journey_1.Journey.findById(req.params.id);
            if (!journey)
                return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });
            const { patientId, patient } = req.body || {};
            let pid;
            if (patientId) {
                const p = yield Patient_1.Patient.findById(patientId);
                if (!p)
                    return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
                pid = p.id;
            }
            else if (patient) {
                // Create a transient patient record to back this run
                const created = yield Patient_1.Patient.create(patient);
                pid = created.id;
            }
            else {
                return res.status(400).json({ error: 'Bad Request', code: 'MISSING_PATIENT', details: { message: 'Provide patientId or patient context' } });
            }
            const run = yield journeyExecutor_1.journeyExecutor.startJourney(journey.id, pid);
            res.status(201).json(run);
        }
        catch (err) {
            next(err);
        }
    });
}
