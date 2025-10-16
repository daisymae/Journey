"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const runController_1 = require("../controllers/runController");
const router = (0, express_1.Router)();
// Run lifecycle - all under /journeys/runs
router.post('/runs/:runId/resume', runController_1.resumeRun);
router.get('/runs/:runId', runController_1.getRun);
router.delete('/runs/:runId', runController_1.cancelRun);
exports.default = router;
