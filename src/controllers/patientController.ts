import { Request, Response, NextFunction } from 'express';
import { Patient } from '../models/Patient';

export async function createPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await Patient.create(req.body);
    console.log('[API] Created patient', patient.id);
    res.status(201).json(patient.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function getPatients(_req: Request, res: Response, next: NextFunction) {
  try {
    const patients = await Patient.find();
    res.json(patients.map(p => p.toJSON()));
  } catch (err) {
    next(err);
  }
}

export async function getPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
    res.json(patient.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function updatePatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!patient) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
    res.json(patient.toJSON());
  } catch (err) {
    next(err);
  }
}

export async function deletePatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', details: { resource: 'Patient' } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
