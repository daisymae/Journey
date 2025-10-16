import { Router } from 'express';
import { createPatient, deletePatient, getPatient, getPatients, updatePatient } from '../controllers/patientController';
import { validatePatient } from '../middleware/validation';
import { listPatientRuns } from '../controllers/runController';

const router = Router();

router.get('/', getPatients);
router.post('/', validatePatient, createPatient);
router.get('/:patientId/runs', listPatientRuns);
router.get('/:id', getPatient);
router.put('/:id', validatePatient, updatePatient);
router.delete('/:id', deletePatient);

export default router;
