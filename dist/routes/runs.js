"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const runController_1 = require("../controllers/runController");
const router = (0, express_1.Router)();
// Start a run for a journey
router.post('/journeys/:journeyId/start', runController_1.startJourneyRun);
// Run lifecycle
router.post('/runs/:runId/resume', runController_1.resumeRun);
router.get('/runs/:runId', runController_1.getRun);
router.get('/patients/:patientId/runs', runController_1.listPatientRuns);
router.delete('/runs/:runId', runController_1.cancelRun);
exports.default = router;
