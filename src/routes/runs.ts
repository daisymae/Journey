import { Router } from 'express';
import { cancelRun, getRun, listPatientRuns, resumeRun, startJourneyRun } from '../controllers/runController';

const router = Router();

// Start a run for a journey
router.post('/journeys/:journeyId/start', startJourneyRun);

// Run lifecycle
router.post('/runs/:runId/resume', resumeRun);
router.get('/runs/:runId', getRun);
router.get('/patients/:patientId/runs', listPatientRuns);
router.delete('/runs/:runId', cancelRun);

export default router;
