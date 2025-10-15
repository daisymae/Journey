import { Journey, JourneyNode, PatientContext } from '../types';
import { processNode, ScheduleFn } from './nodeProcessor';

export interface ExecuteOptions {
  scheduler?: ScheduleFn; // default to global setTimeout
}

function buildNodeMap(journey: Journey): Record<string, JourneyNode> {
  const map: Record<string, JourneyNode> = {};
  for (const node of journey.nodes) {
    map[node.id] = node;
  }
  return map;
}

function validateJourney(journey: Journey, map: Record<string, JourneyNode>): void {
  if (!journey.nodes || journey.nodes.length === 0) {
    throw new Error('Journey must have at least one node');
  }
  if (!map[journey.start_node_id]) {
    throw new Error('start_node_id must reference an existing node');
  }
  const ids = new Set(Object.keys(map));
  for (const n of journey.nodes) {
    if (n.type === 'MESSAGE' || n.type === 'DELAY') {
      const next = n.next_node_id;
      if (next != null && !ids.has(next)) {
        throw new Error(`Node ${n.id} references missing next_node_id ${next}`);
      }
    } else if (n.type === 'CONDITIONAL') {
      const t = n.on_true_next_node_id;
      const f = n.on_false_next_node_id;
      if (t != null && !ids.has(t)) throw new Error(`Node ${n.id} references missing on_true_next_node_id ${t}`);
      if (f != null && !ids.has(f)) throw new Error(`Node ${n.id} references missing on_false_next_node_id ${f}`);
    }
  }
}

export function executeJourney(journey: Journey, patient: PatientContext, options?: ExecuteOptions): void {
  const scheduler: ScheduleFn = options?.scheduler || ((cb, ms) => setTimeout(cb, ms));
  const map = buildNodeMap(journey);
  validateJourney(journey, map);

  console.log(`[ENGINE] Starting journey ${journey.id} for patient ${patient.id} at node ${journey.start_node_id}`);

  const run = (nodeId: string | null): void => {
    if (nodeId == null) {
      console.log(`[ENGINE] Journey ${journey.id} completed for patient ${patient.id}`);
      return;
    }
    const node = map[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    console.log(`[ENGINE] Processing node ${node.id} (${node.type}) for patient ${patient.id}`);
    processNode(node, patient, scheduler, (next) => {
      run(next);
    });
  };

  run(journey.start_node_id);
}
