import { Router } from 'express';
import { cancelRun, getRun, listPatientRuns, resumeRun, startJourneyRun } from '../controllers/runController';

const router = Router();

// Run lifecycle - all under /journeys/runs
router.post('/runs/:runId/resume', resumeRun);
router.get('/runs/:runId', getRun);
router.delete('/runs/:runId', cancelRun);

export default router;
