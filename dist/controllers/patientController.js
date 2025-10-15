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
exports.createPatient = createPatient;
exports.getPatients = getPatients;
exports.getPatient = getPatient;
exports.updatePatient = updatePatient;
exports.deletePatient = deletePatient;
const Patient_1 = require("../models/Patient");
function createPatient(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const patient = yield Patient_1.Patient.create(req.body);
            console.log('[API] Created patient', patient.id);
            res.status(201).json(patient.toJSON());
        }
        catch (err) {
            next(err);
        }
    });
}
function getPatients(_req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const patients = yield Patient_1.Patient.find();
            res.json(patients.map(p => p.toJSON()));
        }
        catch (err) {
            next(err);
        }
    });
}
function getPatient(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const patient = yield Patient_1.Patient.findById(req.params.id);
            if (!patient)
                return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
            res.json(patient.toJSON());
        }
        catch (err) {
            next(err);
        }
    });
}
function updatePatient(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const patient = yield Patient_1.Patient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
            if (!patient)
                return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
            res.json(patient.toJSON());
        }
        catch (err) {
            next(err);
        }
    });
}
function deletePatient(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const patient = yield Patient_1.Patient.findByIdAndDelete(req.params.id);
            if (!patient)
                return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    });
}
