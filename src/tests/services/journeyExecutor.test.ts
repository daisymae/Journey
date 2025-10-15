import { journeyExecutor } from '../../services/journeyExecutor';

jest.useFakeTimers();

// Mock Journey model (in-memory)
jest.mock('../../models/Journey', () => {
  type J = any;
  const store: Record<string, J> = {};
  const wrap = (obj: any) => ({ ...obj, toJSON: () => obj, id: obj.id });
  return {
    Journey: {
      findById: async (id: string) => (store[id] ? wrap(store[id]) : null),
      __set: (id: string, doc: any) => { store[id] = doc; },
    },
  };
});

// Mock Patient model (in-memory)
jest.mock('../../models/Patient', () => {
  const store: Record<string, any> = {};
  const wrap = (obj: any) => ({ ...obj, toJSON: () => obj, id: obj.id });
  return {
    Patient: {
      findById: async (id: string) => (store[id] ? wrap(store[id]) : null),
      __set: (id: string, doc: any) => { store[id] = doc; },
    },
  };
});

// Mock JourneyRun model with minimal Mongo-like interface
jest.mock('../../models/JourneyRun', () => {
  type Run = any;
  const store: Record<string, Run> = {};
  const wrap = (obj: any) => ({ ...obj, toJSON: () => obj });
  return {
    JourneyRun: {
      create: async (body: any) => {
        store[body.runId] = { ...body };
        return wrap(store[body.runId]);
      },
      findOne: (filter: any) => {
        const key = filter.runId;
        const doc = store[key];
        return doc
          ? { ...wrap(doc), lean: async () => ({ ...doc }) }
          : { lean: async () => null };
      },
      updateOne: (filter: any, update: any) => {
        const key = filter.runId;
        const doc = store[key];
        if (!doc) return { exec: async () => {} };
        if (update.$set) {
          Object.assign(doc, update.$set);
        }
        if (update.$push && update.$push.executionLog) {
          doc.executionLog = doc.executionLog || [];
          doc.executionLog.push(update.$push.executionLog);
        }
        return { exec: async () => {} };
      },
      find: async (query: any) => {
        const arr = Object.values(store).filter((r) => {
          if (query.patientId && r.patientId !== query.patientId) return false;
          if (query.status && r.status !== query.status) return false;
          if (query.wakeUpAt && query.wakeUpAt.$lte) {
            return r.wakeUpAt && new Date(r.wakeUpAt) <= query.wakeUpAt.$lte;
          }
          return true;
        });
        return arr.map(wrap) as any;
      },
      __getStore: () => store,
    },
  };
});

// Pull helpers to seed mocks
type JourneyType = any;
const { Journey } = jest.requireMock('../../models/Journey');
const { Patient } = jest.requireMock('../../models/Patient');
const { JourneyRun } = jest.requireMock('../../models/JourneyRun');

function seedJourney(j: JourneyType) { Journey.__set(j.id, j); }
function seedPatient(p: any) { Patient.__set(p.id, p); }

async function waitForStatus(runId: string, expected: string) {
  const { JourneyRun } = jest.requireMock('../../models/JourneyRun');
  const store = JourneyRun.__getStore();
  for (let i = 0; i < 200; i++) {
    if (store[runId]?.status === expected) return;
    // Flush any pending timers and microtasks to allow async progress
    try { jest.runOnlyPendingTimers(); } catch {}
    await Promise.resolve();
  }
  throw new Error(`Timed out waiting for status ${expected}`);
}

describe('JourneyExecutor (unit, mocked persistence)', () => {
  beforeEach(() => {
    // Clear any timers between tests
    jest.clearAllTimers();
  });

  test('active → waiting → active → completed flow with DELAY', async () => {
    seedJourney({
      id: 'j-delay',
      name: 'Delay Journey',
      start_node_id: 'm1',
      nodes: [
        { id: 'm1', type: 'MESSAGE', message: 'Hi', next_node_id: 'd1' },
        { id: 'd1', type: 'DELAY', duration_seconds: 1, next_node_id: 'm2' },
        { id: 'm2', type: 'MESSAGE', message: 'Done', next_node_id: null },
      ],
    });
    seedPatient({ id: 'p1', age: 30, language: 'en', condition: 'hip_replacement' });

    const run = await journeyExecutor.startJourney('j-delay', 'p1');
    await waitForStatus(run.runId, 'waiting');
    const store = JourneyRun.__getStore();
    expect(store[run.runId].status).toBe('waiting');

    // Advance delay
    jest.advanceTimersByTime(1000);
    await waitForStatus(run.runId, 'completed');

    expect(store[run.runId].status).toBe('completed');
    expect(store[run.runId].completedAt).toBeTruthy();
  });

  test('Error handling: invalid operator should fail run', async () => {
    seedJourney({
      id: 'j-bad',
      name: 'Bad Journey',
      start_node_id: 'c1',
      nodes: [
        { id: 'c1', type: 'CONDITIONAL', condition: { field: 'age', operator: '??', value: 10 }, on_true_next_node_id: null, on_false_next_node_id: null },
      ],
    });
    seedPatient({ id: 'p1', age: 30, language: 'en', condition: 'hip_replacement' });

    const run = await journeyExecutor.startJourney('j-bad', 'p1');
    await waitForStatus(run.runId, 'failed');
    const store = JourneyRun.__getStore();
    expect(store[run.runId].status).toBe('failed');
    expect(store[run.runId].errorMessage || '').toBeDefined();
  });

  test('Cancel behavior: sets status failed', async () => {
    seedJourney({
      id: 'j-cancel',
      name: 'Cancel Journey',
      start_node_id: 'm1',
      nodes: [
        { id: 'm1', type: 'MESSAGE', message: 'Hi', next_node_id: null },
      ],
    });
    seedPatient({ id: 'p1', age: 30, language: 'en', condition: 'hip_replacement' });

    const run = await journeyExecutor.startJourney('j-cancel', 'p1');
    await journeyExecutor.cancelRun(run.runId);
    const store = JourneyRun.__getStore();
    expect(store[run.runId].status).toBe('failed');
    expect(store[run.runId].errorMessage).toBe('Cancelled by user');
  });
});
