import request from 'supertest';
import createApp from '../../index';

// In-memory mock for Patient model
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

describe('Patients API', () => {
  const app = createApp();

  const validPatient = { id: 'p1', age: 45, language: 'en', condition: 'knee_replacement' };

  test('POST /api/patients - validation errors', async () => {
    const res = await request(app).post('/api/patients').send({ age: 'x', language: 'en', condition: 'knee_replacement' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('POST /api/patients - create patient (valid)', async () => {
    const res = await request(app).post('/api/patients').send(validPatient);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'p1', age: 45 });
  });

  test('GET /api/patients - list', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/patients/:id - get by id', async () => {
    const res = await request(app).get('/api/patients/p1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'p1' });
  });

  test('PUT /api/patients/:id - update', async () => {
    const res = await request(app).put('/api/patients/p1').send({ ...validPatient, age: 46 });
    expect(res.status).toBe(200);
    expect(res.body.age).toBe(46);
  });

  test('DELETE /api/patients/:id - delete', async () => {
    const res = await request(app).delete('/api/patients/p1');
    expect(res.status).toBe(204);
  });

  test('GET /api/patients/:id - 404 after delete', async () => {
    const res = await request(app).get('/api/patients/p1');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
