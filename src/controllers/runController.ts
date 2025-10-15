import { Request, Response, NextFunction } from 'express';
import { journeyExecutor } from '../services/journeyExecutor';

function toHttpError(err: any) {
  const status = err?.status || 500;
  const message = err?.message || 'Internal Server Error';
  return { status, body: { error: message, code: status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR', details: {} } };
}

export async function startJourneyRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientId } = req.body || {};
    if (!patientId) return res.status(400).json({ error: 'Bad Request', code: 'MISSING_PATIENT', details: { message: 'Provide patientId' } });
    const run = await journeyExecutor.startJourney(req.params.journeyId || req.params.id, String(patientId));
    res.status(201).json(run);
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json(http.body);
  }
}

export async function resumeRun(req: Request, res: Response) {
  try {
    await journeyExecutor.resumeJourney(req.params.runId);
    res.status(202).json({ status: 'resuming' });
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json(http.body);
  }
}

export async function getRun(req: Request, res: Response) {
  try {
    const run = await journeyExecutor.getRunStatus(req.params.runId);
    res.json(run);
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json(http.body);
  }
}

export async function listPatientRuns(req: Request, res: Response) {
  try {
    const { status } = req.query || {};
    const runs = await journeyExecutor.getPatientRuns(req.params.patientId, status as any);
    res.json(runs);
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json(http.body);
  }
}

export async function cancelRun(req: Request, res: Response) {
  try {
    await journeyExecutor.cancelRun(req.params.runId);
    res.status(202).json({ status: 'cancelled' });
  } catch (err) {
    const http = toHttpError(err);
    res.status(http.status).json(http.body);
  }
}
