import { executeJourney } from '../../services/journeyEngine';
import { Journey, PatientContext, ActionNode, DelayNode, ConditionalNode } from '../../types';

jest.useFakeTimers();

jest.mock('../../services/messageService', () => ({
  sendMessage: jest.fn(),
}));

const { sendMessage } = jest.requireMock('../../services/messageService');

function makeJourney(nodes: (ActionNode | DelayNode | ConditionalNode)[], startId: string): Journey {
  return { id: 'j1', name: 'Test', start_node_id: startId, nodes };
}

describe('journeyEngine.executeJourney', () => {
  const patient: PatientContext = { id: 'p1', age: 55, language: 'en', condition: 'hip_replacement' };

  beforeEach(() => {
    (sendMessage as jest.Mock).mockClear();
  });

  test('executes linear journeys (MESSAGE -> MESSAGE)', () => {
    const nodes: ActionNode[] = [
      { id: 'n1', type: 'MESSAGE', message: 'Hello', next_node_id: 'n2' },
      { id: 'n2', type: 'MESSAGE', message: 'World', next_node_id: null },
    ];
    const journey = makeJourney(nodes, 'n1');
    executeJourney(journey, patient, {});
    expect(sendMessage).toHaveBeenNthCalledWith(1, 'p1', 'Hello');
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'p1', 'World');
  });

  test('handles DELAY via advancing timers', () => {
    const nodes: (ActionNode | DelayNode)[] = [
      { id: 'n1', type: 'MESSAGE', message: 'Before', next_node_id: 'd1' },
      { id: 'd1', type: 'DELAY', duration_seconds: 2, next_node_id: 'n2' },
      { id: 'n2', type: 'MESSAGE', message: 'After', next_node_id: null },
    ];
    const journey = makeJourney(nodes, 'n1');
    executeJourney(journey, patient, { scheduler: setTimeout });
    expect(sendMessage).toHaveBeenCalledWith('p1', 'Before');
    expect(sendMessage).not.toHaveBeenCalledWith('p1', 'After');
    jest.advanceTimersByTime(2000);
    expect(sendMessage).toHaveBeenCalledWith('p1', 'After');
  });

  test('handles CONDITIONAL branching', () => {
    const nodes: (ActionNode | ConditionalNode)[] = [
      { id: 'n1', type: 'MESSAGE', message: 'Start', next_node_id: 'c1' },
      {
        id: 'c1',
        type: 'CONDITIONAL',
        condition: { field: 'age', operator: '>', value: 50 },
        on_true_next_node_id: 't',
        on_false_next_node_id: 'f',
      },
      { id: 't', type: 'MESSAGE', message: 'True path', next_node_id: null },
      { id: 'f', type: 'MESSAGE', message: 'False path', next_node_id: null },
    ];
    const journey = makeJourney(nodes, 'n1');
    executeJourney(journey, patient, {});
    expect(sendMessage).toHaveBeenCalledWith('p1', 'Start');
    expect(sendMessage).toHaveBeenCalledWith('p1', 'True path');
    expect(sendMessage).not.toHaveBeenCalledWith('p1', 'False path');
  });

  test('errors on missing node references', () => {
    const nodes: ActionNode[] = [
      { id: 'n1', type: 'MESSAGE', message: 'Hello', next_node_id: 'missing' },
    ];
    const journey = makeJourney(nodes, 'n1');
    expect(() => executeJourney(journey, patient, {})).toThrow('Node n1 references missing next_node_id missing');
  });
});
