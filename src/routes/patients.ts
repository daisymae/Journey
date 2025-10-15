import { Router } from 'express';
import { createPatient, deletePatient, getPatient, getPatients, updatePatient } from '../controllers/patientController';
import { validatePatient } from '../middleware/validation';

const router = Router();

router.get('/', getPatients);
router.post('/', validatePatient, createPatient);
router.get('/:id', getPatient);
router.put('/:id', validatePatient, updatePatient);
router.delete('/:id', deletePatient);

export default router;
