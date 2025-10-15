import { ActionNode, ConditionalNode, DelayNode, JourneyNode, Operator, PatientContext } from '../types';
import { sendMessage } from './messageService';

export type ScheduleFn = (cb: () => void, delayMs: number) => any;

export function evaluateCondition(
  condition: { field: string; operator: string; value: unknown },
  patient: PatientContext
): boolean {
  const { field, operator, value } = condition;

  // Resolve field path: support 'patient.age' or 'age'
  const key = field.startsWith('patient.') ? field.slice('patient.'.length) : field;
  const patientValue: any = (patient as any)[key];

  const warnMissing = () => {
    console.warn(`[CONDITIONAL] Missing patient field "${field}" for patient ${patient.id}`);
  };

  const validOps: Operator[] = ['=', '!=', '>', '<', '>=', '<='];
  if (!validOps.includes(operator as Operator)) {
    throw new Error(`Unsupported operator: ${operator}`);
  }

  if (patientValue === undefined) {
    warnMissing();
    switch (operator) {
      case '=':
        return (value as any) === undefined;
      case '!=':
        return (value as any) !== undefined;
      default:
        return false;
    }
  }

  switch (operator as Operator) {
    case '=':
      return patientValue === value;
    case '!=':
      return patientValue !== value;
    case '>':
      return Number(patientValue) > Number(value);
    case '<':
      return Number(patientValue) < Number(value);
    case '>=':
      return Number(patientValue) >= Number(value);
    case '<=':
      return Number(patientValue) <= Number(value);
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

export function processMessage(node: ActionNode, ctx: PatientContext): { nextNodeId: string | null } {
  sendMessage(ctx.id, node.message);
  return { nextNodeId: node.next_node_id };
}

export function processDelay(
  node: DelayNode,
  ctx: PatientContext,
  scheduler: ScheduleFn,
  scheduleNext: (nextId: string | null) => void
): void {
  const delayMs = Math.max(0, (node.duration_seconds || 0) * 1000);
  console.log(`[DELAY] Waiting ${node.duration_seconds}s before next node ${node.next_node_id ?? 'END'} (patient ${ctx.id})`);
  scheduler(() => scheduleNext(node.next_node_id), delayMs);
}

export function processConditional(node: ConditionalNode, ctx: PatientContext): { nextNodeId: string | null; result: boolean } {
  const result = evaluateCondition(node.condition, ctx);
  const nextNodeId = result ? node.on_true_next_node_id : node.on_false_next_node_id;
  console.log(
    `[CONDITIONAL] Evaluated ${node.condition.field} ${node.condition.operator} ${JSON.stringify(node.condition.value)} => ${result} (patient ${ctx.id})`
  );
  return { nextNodeId, result };
}

export function processNode(
  node: JourneyNode,
  ctx: PatientContext,
  scheduler: ScheduleFn,
  scheduleNext: (nextId: string | null) => void
): void {
  switch (node.type) {
    case 'MESSAGE': {
      const { nextNodeId } = processMessage(node, ctx);
      scheduleNext(nextNodeId);
      return;
    }
    case 'DELAY': {
      processDelay(node, ctx, scheduler, scheduleNext);
      return;
    }
    case 'CONDITIONAL': {
      const { nextNodeId } = processConditional(node, ctx);
      scheduleNext(nextNodeId);
      return;
    }
    default:
      // Exhaustive check
      const neverNode: never = node as never;
      throw new Error(`Unsupported node type: ${(neverNode as any).type}`);
  }
}
