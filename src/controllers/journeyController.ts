import { Request, Response, NextFunction } from 'express';
import { Journey } from '../models/Journey';
import { Patient } from '../models/Patient';
import { executeJourney } from '../services/journeyEngine';
import { PatientContext } from '../types';

export async function createJourney(req: Request, res: Response, next: NextFunction) {
  try {
    const journey = await Journey.create(req.body);
    console.log('[API] Created journey', journey.id);
    res.status(201).json(journey.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function getJourneys(_req: Request, res: Response, next: NextFunction) {
  try {
    const journeys = await Journey.find();
    res.json(journeys.map(j => j.toJSON()));
  } catch (err) {
    next(err);
  }
}

export async function getJourney(req: Request, res: Response, next: NextFunction) {
  try {
    const journey = await Journey.findById(req.params.id);
    if (!journey) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });
    res.json(journey.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function updateJourney(req: Request, res: Response, next: NextFunction) {
  try {
    const journey = await Journey.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!journey) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });
    res.json(journey.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function deleteJourney(req: Request, res: Response, next: NextFunction) {
  try {
    const journey = await Journey.findByIdAndDelete(req.params.id);
    if (!journey) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function startJourney(req: Request, res: Response, next: NextFunction) {
  try {
    const journey = await Journey.findById(req.params.id);
    if (!journey) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Journey' } });

    let patientCtx: PatientContext | null = null;
    const { patientId, patient } = req.body || {};

    if (patient) {
      patientCtx = patient as PatientContext;
    } else if (patientId) {
      const p = await Patient.findById(patientId);
      if (!p) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
      patientCtx = { id: p.id, age: p.age, language: p.language as any, condition: p.condition as any };
    } else {
      return res.status(400).json({ error: 'Bad Request', code: 'MISSING_PATIENT', details: { message: 'Provide patientId or patient context' } });
    }

    executeJourney(journey.toJSON(), patientCtx);
    res.status(202).json({ status: 'started' });
  } catch (err) {
    next(err);
  }
}
