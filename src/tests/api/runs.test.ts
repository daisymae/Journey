import request from 'supertest';
import createApp from '../../index';

// Mock journeyExecutor with in-memory runs store
jest.mock('../../services/journeyExecutor', () => {
  type Run = any;
  const runs: Record<string, Run> = {};
  let seq = 1;
  const now = () => new Date().toISOString();
  return {
    journeyExecutor: {
      startJourney: jest.fn(async (journeyId: string, patientId: string) => {
        const runId = `r${seq++}`;
        const run = {
          runId,
          journeyId,
          patientId,
          currentNodeId: 'n2',
          status: 'active',
          wakeUpAt: null,
          startedAt: now(),
          completedAt: null,
          executionLog: [],
        };
        runs[runId] = run;
        return run;
      }),
      resumeJourney: jest.fn(async (runId: string) => {
        const run = runs[runId];
        if (!run) {
          const err: any = new Error('Run not found');
          err.status = 404;
          throw err;
        }
        if (run.status !== 'waiting') {
          const err: any = new Error('Run not waiting');
          err.status = 409;
          throw err;
        }
        run.status = 'active';
      }),
      getRunStatus: jest.fn(async (runId: string) => {
        const run = runs[runId];
        if (!run) {
          const err: any = new Error('Run not found');
          err.status = 404;
          throw err;
        }
        return run;
      }),
      getPatientRuns: jest.fn(async (patientId: string, status?: string) => {
        const arr = Object.values(runs).filter((r: any) => r.patientId === patientId);
        const filtered = status ? arr.filter((r: any) => r.status === status) : arr;
        return filtered.sort((a: any, b: any) => (a.startedAt < b.startedAt ? 1 : -1));
      }),
      cancelRun: jest.fn(async (runId: string) => {
        const run = runs[runId];
        if (!run) {
          const err: any = new Error('Run not found');
          err.status = 404;
          throw err;
        }
        run.status = 'failed';
        run.errorMessage = 'Cancelled by user';
      }),
      recoverDueRuns: jest.fn(async () => {}),
      stopAllTimers: jest.fn(() => {}),
    },
  };
});

// Mock Journey model for creating the journey to start
jest.mock('../../models/Journey', () => {
  type JourneyDoc = any;
  const store: JourneyDoc[] = [];
  let seq = 1;
  const wrap = (obj: any) => ({
    ...obj,
    toJSON: () => obj,
    id: obj.id,
  });
  return {
    Journey: {
      create: async (body: any) => {
        const id = body.id || String(seq++);
        const doc = { ...body, id };
        store.push(doc);
        return wrap(doc);
      },
      find: async () => store.map(wrap),
      findById: async (id: string) => {
        const doc = store.find((j) => j.id === id);
        return doc ? wrap(doc) : null;
      },
      findByIdAndUpdate: async (id: string, body: any) => {
        const idx = store.findIndex((j) => j.id === id);
        if (idx === -1) return null;
        const updated = { ...store[idx], ...body };
        store[idx] = updated;
        return wrap(updated);
      },
      findByIdAndDelete: async (id: string) => {
        const idx = store.findIndex((j) => j.id === id);
        if (idx === -1) return null;
        const [removed] = store.splice(idx, 1);
        return wrap(removed);
      },
    },
  };
});

// Mock Patient model to allow patient creation and lookup
jest.mock('../../models/Patient', () => {
  type PatientDoc = any;
  const store: PatientDoc[] = [];
  let seq = 1;
  const wrap = (obj: any) => ({
    ...obj,
    toJSON: () => obj,
    id: obj.id,
  });
  return {
    Patient: {
      create: async (body: any) => {
        const id = body.id || String(seq++);
        const doc = { ...body, id };
        store.push(doc);
        return wrap(doc);
      },
      find: async () => store.map(wrap),
      findById: async (id: string) => {
        const doc = store.find((p) => p.id === id);
        return doc ? wrap(doc) : null;
      },
      findByIdAndUpdate: async (id: string, body: any) => {
        const idx = store.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        const updated = { ...store[idx], ...body };
        store[idx] = updated;
        return wrap(updated);
      },
      findByIdAndDelete: async (id: string) => {
        const idx = store.findIndex((p) => p.id === id);
        if (idx === -1) return null;
        const [removed] = store.splice(idx, 1);
        return wrap(removed);
      },
    },
  };
});

describe('Runs API', () => {
  const app = createApp();

  test('Start run returns JourneyRun and persists initial state (mocked)', async () => {
    // Create a journey and patient
    await request(app).post('/api/journeys').send({ id: 'j-start', name: 'J', start_node_id: 'n1', nodes: [{ id: 'n1', type: 'MESSAGE', message: 'Hi', next_node_id: null }] });
    await request(app).post('/api/patients').send({ id: 'p-start', age: 40, language: 'en', condition: 'hip_replacement' });

    const res = await request(app).post('/api/journeys/j-start/start').send({ patientId: 'p-start' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('runId');
    expect(res.body).toMatchObject({ journeyId: 'j-start', patientId: 'p-start', status: 'active' });
  });

  test('Get run status reflects data from executor (mocked)', async () => {
    const start = await request(app).post('/api/journeys/j-start/start').send({ patientId: 'p-start' });
    const runId = start.body.runId;
    const res = await request(app).get(`/api/runs/${runId}`);
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(runId);
  });

  test('List patient runs', async () => {
    const res = await request(app).get('/api/patients/p-start/runs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Resume run returns 409 when not waiting (mocked)', async () => {
    const start = await request(app).post('/api/journeys/j-start/start').send({ patientId: 'p-start' });
    const runId = start.body.runId;
    const res = await request(app).post(`/api/runs/${runId}/resume`).send();
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'CONFLICT' });
  });

  test('Cancel run', async () => {
    const start = await request(app).post('/api/journeys/j-start/start').send({ patientId: 'p-start' });
    const runId = start.body.runId;
    const res = await request(app).delete(`/api/runs/${runId}`);
    expect(res.status).toBe(202);
    // Optionally get status after cancel
    const get = await request(app).get(`/api/runs/${runId}`);
    expect(get.body.status).toBe('failed');
  });
});
