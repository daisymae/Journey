import { evaluateCondition, processMessage, processDelay, processConditional, processNode } from '../../services/nodeProcessor';
import { PatientContext, ActionNode, DelayNode, ConditionalNode } from '../../types';

jest.useFakeTimers();

jest.mock('../../services/messageService', () => ({
  sendMessage: jest.fn(),
}));

const { sendMessage } = jest.requireMock('../../services/messageService');

describe('nodeProcessor', () => {
  const patient: PatientContext = { id: 'p1', age: 60, language: 'en', condition: 'hip_replacement' };

  describe('evaluateCondition', () => {
    test('supports = and != operators', () => {
      expect(evaluateCondition({ field: 'age', operator: '=', value: 60 }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'age', operator: '!=', value: 30 }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'language', operator: '=', value: 'en' }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'condition', operator: '!=', value: 'knee_replacement' }, patient)).toBe(true);
    });

    test('supports >, <, >=, <= operators', () => {
      expect(evaluateCondition({ field: 'age', operator: '>', value: 50 }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'age', operator: '>=', value: 60 }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'age', operator: '<', value: 70 }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'age', operator: '<=', value: 60 }, patient)).toBe(true);
    });

    test('resolves patient.* or direct field names', () => {
      expect(evaluateCondition({ field: 'patient.age', operator: '>', value: 50 }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'age', operator: '>', value: 50 }, patient)).toBe(true);
    });

    test('missing patient fields: = false (unless undefined), != true (unless undefined), others false', () => {
      expect(evaluateCondition({ field: 'missing', operator: '=', value: 'anything' }, patient)).toBe(false);
      expect(evaluateCondition({ field: 'missing', operator: '!=', value: 'anything' }, patient)).toBe(true);
      expect(evaluateCondition({ field: 'missing', operator: '>', value: 1 }, patient)).toBe(false);
    });

    test('unsupported operator throws descriptive error', () => {
      expect(() => evaluateCondition({ field: 'age', operator: '??', value: 1 } as any, patient)).toThrow('Unsupported operator: ??');
    });
  });

  describe('processMessage', () => {
    test('logs action and returns next immediately', () => {
      const node: ActionNode = { id: 'n1', type: 'MESSAGE', message: 'Hello', next_node_id: 'n2' };
      (sendMessage as jest.Mock).mockClear();
      const { nextNodeId } = processMessage(node, patient);
      expect(sendMessage).toHaveBeenCalledWith('p1', 'Hello');
      expect(nextNodeId).toBe('n2');
    });
  });

  describe('processDelay', () => {
    test('schedules next with setTimeout (verified with fake timers)', () => {
      const node: DelayNode = { id: 'd1', type: 'DELAY', duration_seconds: 2, next_node_id: 'n2' };
      const scheduleNext = jest.fn();
      processDelay(node, patient, setTimeout, scheduleNext);
      expect(scheduleNext).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(scheduleNext).toHaveBeenCalledWith('n2');
    });

    test('passes correct delay to scheduler', () => {
      const node: DelayNode = { id: 'd1', type: 'DELAY', duration_seconds: 3, next_node_id: 'n2' };
      const scheduler = jest.fn();
      const scheduleNext = jest.fn();
      processDelay(node, patient, scheduler as any, scheduleNext);
      expect(scheduler).toHaveBeenCalledTimes(1);
      const [, delayMs] = (scheduler as jest.Mock).mock.calls[0];
      expect(delayMs).toBe(3000);
    });
  });

  describe('processConditional', () => {
    test('evaluates condition and returns correct next node id', () => {
      const node: ConditionalNode = {
        id: 'c1',
        type: 'CONDITIONAL',
        condition: { field: 'age', operator: '>', value: 50 },
        on_true_next_node_id: 't',
        on_false_next_node_id: 'f',
      };
      const { nextNodeId, result } = processConditional(node, patient);
      expect(result).toBe(true);
      expect(nextNodeId).toBe('t');
    });
  });

  describe('processNode integration', () => {
    test('MESSAGE processes immediately; DELAY waits', () => {
      const calls: string[] = [];
      const messageNode: ActionNode = { id: 'm1', type: 'MESSAGE', message: 'Hi', next_node_id: 'd1' };
      const delayNode: DelayNode = { id: 'd1', type: 'DELAY', duration_seconds: 1, next_node_id: null };

      const scheduleNext = (next: string | null) => calls.push(`next:${next}`);

      processNode(messageNode, patient, setTimeout, scheduleNext);
      expect(calls).toEqual(['next:d1']);

      processNode(delayNode, patient, setTimeout, scheduleNext);
      expect(calls).toEqual(['next:d1']);
      jest.advanceTimersByTime(1000);
      expect(calls).toEqual(['next:d1', 'next:null']);
    });
  });
});
