import { randomUUID } from 'crypto';
import { Journey } from '../models/Journey';
import { Patient } from '../models/Patient';
import { JourneyRun, JourneyRunDoc } from '../models/JourneyRun';
import { Journey as JourneyType, JourneyNode, NodeById, PatientContext } from '../types';
import { evaluateCondition } from './nodeProcessor';
import { sendMessage } from './messageService';

function nowISO(): string { return new Date().toISOString(); }

function buildNodeMap(journey: JourneyType): Record<string, JourneyNode> {
  const map: Record<string, JourneyNode> = {};
  for (const node of journey.nodes) map[node.id] = node;
  return map;
}

function validateJourney(journey: JourneyType, map: Record<string, JourneyNode>): void {
  if (!journey.nodes || journey.nodes.length === 0) throw new Error('Journey must have at least one node');
  if (!map[journey.start_node_id]) throw new Error('start_node_id must reference an existing node');
  const ids = new Set(Object.keys(map));
  for (const n of journey.nodes) {
    if (n.type === 'MESSAGE' || n.type === 'DELAY') {
      const next = n.next_node_id;
      if (next != null && !ids.has(next)) throw new Error(`Node ${n.id} references missing next_node_id ${next}`);
    } else if (n.type === 'CONDITIONAL') {
      const t = n.on_true_next_node_id;
      const f = n.on_false_next_node_id;
      if (t != null && !ids.has(t)) throw new Error(`Node ${n.id} references missing on_true_next_node_id ${t}`);
      if (f != null && !ids.has(f)) throw new Error(`Node ${n.id} references missing on_false_next_node_id ${f}`);
    }
  }
}

class JourneyExecutor {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  // Timer helpers
  private setTimer(runId: string, ms: number): void {
    this.clearTimer(runId);
    const t = setTimeout(() => {
      this.timers.delete(runId);
      this.resumeJourney(runId).catch((err) => {
        console.error(`[RUN:${runId}] Error resuming journey`, err);
      });
    }, ms);
    this.timers.set(runId, t);
  }

  private clearTimer(runId: string): void {
    const t = this.timers.get(runId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(runId);
    }
  }

  stopAllTimers(): void {
    for (const [runId, t] of this.timers.entries()) {
      clearTimeout(t);
      this.timers.delete(runId);
    }
  }

  // Persistence helpers
  private async appendLog(runId: string, entry: { timestamp?: string; nodeId: string; nodeType: 'MESSAGE'|'DELAY'|'CONDITIONAL'; action: string; details?: unknown }): Promise<void> {
    const timestamp = entry.timestamp || nowISO();
    await JourneyRun.updateOne({ runId }, { $push: { executionLog: { ...entry, timestamp } } }).exec();
  }

  private async setStatus(runId: string, status: JourneyRunDoc['status'], patch: Partial<JourneyRunDoc> = {}): Promise<void> {
    const update: any = { status };
    if ('currentNodeId' in patch) update.currentNodeId = (patch as any).currentNodeId ?? null;
    if ('wakeUpAt' in patch) update.wakeUpAt = (patch as any).wakeUpAt ?? null;
    if ('completedAt' in patch) update.completedAt = (patch as any).completedAt ?? null;
    if ('errorMessage' in patch) update.errorMessage = (patch as any).errorMessage;
    await JourneyRun.updateOne({ runId }, { $set: update }).exec();
  }

  private async loadContext(journeyId: string, patientId: string): Promise<{ journey: JourneyType; map: NodeById; patient: PatientContext }>{
    const journeyDoc = await Journey.findById(journeyId);
    if (!journeyDoc) throw new Error('Journey not found');
    const journey = journeyDoc.toJSON() as any as JourneyType;
    const map = buildNodeMap(journey);
    validateJourney(journey, map);

    const patientDoc = await Patient.findById(patientId);
    if (!patientDoc) throw new Error('Patient not found');
    const patient: PatientContext = { id: (patientDoc as any).id, age: patientDoc.age, language: patientDoc.language as any, condition: patientDoc.condition as any };
    return { journey, map, patient };
  }

  private async process(runId: string): Promise<void> {
    const run = await JourneyRun.findOne({ runId }).lean();
    if (!run) throw new Error('Run not found');

    const { journey, map, patient } = await this.loadContext(run.journeyId, run.patientId);

    let currentNodeId: string | null = run.currentNodeId as any;

    try {
      await this.setStatus(runId, 'active', { wakeUpAt: null } as any);
      while (currentNodeId != null) {
        const node = map[currentNodeId];
        if (!node) {
          const msg = `Node not found: ${currentNodeId}`;
          console.error(`[RUN:${runId}] ${msg}`);
          await this.appendLog(runId, { nodeId: currentNodeId, nodeType: 'MESSAGE', action: 'ERROR', details: msg });
          await this.setStatus(runId, 'failed', { completedAt: new Date() } as any);
          return;
        }
        console.log(`[RUN:${runId}] Processing node ${node.id} (${node.type}) for patient ${patient.id}`);

        switch (node.type) {
          case 'MESSAGE': {
            sendMessage(patient.id, node.message);
            await this.appendLog(runId, { nodeId: node.id, nodeType: 'MESSAGE', action: `Sent message: ${node.message}` });
            currentNodeId = node.next_node_id;
            await this.setStatus(runId, 'active', { currentNodeId } as any);
            break;
          }
          case 'DELAY': {
            const delayMs = Math.max(0, (node.duration_seconds || 0) * 1000);
            const wake = new Date(Date.now() + delayMs);
            await this.appendLog(runId, { nodeId: node.id, nodeType: 'DELAY', action: `Delay ${node.duration_seconds}s`, details: { next: node.next_node_id } });
            await this.setStatus(runId, 'waiting', { currentNodeId: node.next_node_id as any, wakeUpAt: wake } as any);
            console.log(`[RUN:${runId}][DELAY] Waiting ${node.duration_seconds}s before next node ${node.next_node_id ?? 'END'}`);
            this.setTimer(runId, delayMs);
            return; // pause processing until resume
          }
          case 'CONDITIONAL': {
            const result = evaluateCondition(node.condition, patient);
            await this.appendLog(runId, { nodeId: node.id, nodeType: 'CONDITIONAL', action: `Evaluated ${node.condition.field} ${node.condition.operator} ${JSON.stringify(node.condition.value)} => ${result}`, details: { result } });
            currentNodeId = result ? node.on_true_next_node_id : node.on_false_next_node_id;
            await this.setStatus(runId, 'active', { currentNodeId } as any);
            break;
          }
          default: {
            const neverNode: never = node as never;
            throw new Error(`Unsupported node type: ${(neverNode as any).type}`);
          }
        }
      }

      // Completed
      await this.appendLog(runId, { nodeId: 'END', nodeType: 'MESSAGE', action: 'Journey completed' });
      await this.setStatus(runId, 'completed', { completedAt: new Date(), currentNodeId: null } as any);
      this.clearTimer(runId);
      console.log(`[RUN:${runId}] Journey completed.`);
    } catch (err: any) {
      console.error(`[RUN:${runId}] Failed with error:`, err);
      await this.appendLog(runId, { nodeId: currentNodeId || 'UNKNOWN', nodeType: 'MESSAGE', action: 'ERROR', details: err?.message || String(err) });
      await this.setStatus(runId, 'failed', { errorMessage: err?.message, completedAt: new Date() } as any);
      this.clearTimer(runId);
    }
  }

  async startJourney(journeyId: string, patientId: string) {
    const runId = (typeof randomUUID === 'function') ? randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const startedAt = new Date();

    // Validate journey and patient exist first
    const journeyDoc = await Journey.findById(journeyId);
    if (!journeyDoc) throw Object.assign(new Error('Journey not found'), { status: 404 });
    const patientDoc = await Patient.findById(patientId);
    if (!patientDoc) throw Object.assign(new Error('Patient not found'), { status: 404 });
    const journey = journeyDoc.toJSON() as any as JourneyType;
    const map = buildNodeMap(journey);
    validateJourney(journey, map);

    const run = await JourneyRun.create({
      runId,
      journeyId,
      patientId,
      currentNodeId: journey.start_node_id,
      status: 'active',
      wakeUpAt: null,
      startedAt,
      completedAt: null,
      executionLog: [],
    });

    // Fire and forget processing
    this.process(runId).catch((err) => {
      console.error(`[RUN:${runId}] Error during start`, err);
    });

    return run.toJSON();
  }

  async resumeJourney(runId: string): Promise<void> {
    const run = await JourneyRun.findOne({ runId });
    if (!run) throw Object.assign(new Error('Run not found'), { status: 404 });
    if (run.status !== 'waiting') throw Object.assign(new Error('Run is not waiting'), { status: 409 });

    await this.setStatus(runId, 'active', { wakeUpAt: null } as any);
    await this.process(runId);
  }

  async getRunStatus(runId: string) {
    const run = await JourneyRun.findOne({ runId });
    if (!run) throw Object.assign(new Error('Run not found'), { status: 404 });
    return run.toJSON();
  }

  async getPatientRuns(patientId: string, status?: JourneyRunDoc['status']) {
    const query: any = { patientId };
    if (status) query.status = status;
    const runs = await JourneyRun.find(query).sort({ startedAt: -1 });
    return runs.map(r => r.toJSON());
  }

  async cancelRun(runId: string): Promise<void> {
    const run = await JourneyRun.findOne({ runId });
    if (!run) throw Object.assign(new Error('Run not found'), { status: 404 });
    this.clearTimer(runId);
    await this.appendLog(runId, { nodeId: run.currentNodeId || 'UNKNOWN', nodeType: 'MESSAGE', action: 'Cancelled by user' });
    await this.setStatus(runId, 'failed', { errorMessage: 'Cancelled by user', completedAt: new Date() } as any);
  }

  async recoverDueRuns(): Promise<void> {
    const due = await JourneyRun.find({ status: 'waiting', wakeUpAt: { $lte: new Date() } });
    for (const run of due) {
      const delayMs = 0; // overdue, resume immediately
      console.log(`[RUN:${run.runId}] Recovering overdue waiting run`);
      this.clearTimer(run.runId);
      this.setTimer(run.runId, delayMs);
    }
  }
}

export const journeyExecutor = new JourneyExecutor();
