import { Router } from 'express';
import { createJourney, deleteJourney, getJourney, getJourneys, startJourney, updateJourney } from '../controllers/journeyController';
import { validateJourney } from '../middleware/validation';

const router = Router();

router.get('/', getJourneys);
router.post('/', validateJourney, createJourney);
router.get('/:id', getJourney);
router.put('/:id', validateJourney, updateJourney);
router.delete('/:id', deleteJourney);
router.post('/:journeyId/trigger', startJourney);

export default router;
