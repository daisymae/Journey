import request from 'supertest';
import createApp from '../../index';

// Mock journeyExecutor to avoid DB interactions
jest.mock('../../services/journeyExecutor', () => {
  const fakeRun = {
    runId: 'r1',
    journeyId: 'j1',
    patientId: 'p1',
    currentNodeId: null,
    status: 'completed',
    wakeUpAt: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    executionLog: [],
  };
  return {
    journeyExecutor: {
      startJourney: jest.fn().mockResolvedValue(fakeRun),
    },
  };
});

// In-memory mock for Journey model
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
      findByIdAndUpdate: async (id: string, body: any, opts: any) => {
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

// Mock Patient model with in-memory store for start endpoint
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

describe('Journeys API', () => {
  const app = createApp();

  const validJourney = {
    id: 'j1',
    name: 'Test Journey',
    start_node_id: 'n1',
    nodes: [
      { id: 'n1', type: 'MESSAGE', message: 'Hello', next_node_id: null },
    ],
  };

  test('POST /api/journeys - create journey (valid)', async () => {
    const res = await request(app).post('/api/journeys').send(validJourney);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'j1', name: 'Test Journey' });
  });

  test('GET /api/journeys - list journeys', async () => {
    const res = await request(app).get('/api/journeys');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/journeys/:id - get journey by id', async () => {
    const res = await request(app).get('/api/journeys/j1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'j1' });
  });

  test('PUT /api/journeys/:id - update journey', async () => {
    const res = await request(app).put('/api/journeys/j1').send({ ...validJourney, name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  test('POST /api/journeys - validation error (missing nodes)', async () => {
    const bad = { id: 'bad', name: 'Bad', start_node_id: 'x', nodes: [] };
    const res = await request(app).post('/api/journeys').send(bad);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('POST /api/journeys/:id/start - starts journey for patient context', async () => {
    const res = await request(app)
      .post('/api/journeys/j1/start')
      .send({ patient: { id: 'p1', age: 50, language: 'en', condition: 'hip_replacement' } });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('runId');
    expect(res.body).toMatchObject({ journeyId: 'j1', patientId: 'p1' });
  });

  test('DELETE /api/journeys/:id - delete journey', async () => {
    const res = await request(app).delete('/api/journeys/j1');
    expect(res.status).toBe(204);
  });

  test('GET /api/journeys/:id - 404 after delete', async () => {
    const res = await request(app).get('/api/journeys/j1');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
