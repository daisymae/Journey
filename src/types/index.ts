// Shared TypeScript interfaces for the Journey domain

export interface ActionNode {
  id: string;
  type: 'MESSAGE';
  message: string;
  next_node_id: string | null;
}

export interface DelayNode {
  id: string;
  type: 'DELAY';
  duration_seconds: number;
  next_node_id: string | null;
}

export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=';

export interface ConditionalNode {
  id: string;
  type: 'CONDITIONAL';
  condition: {
    field: string;
    operator: Operator | string; // allow string at compile-time, validate at runtime
    value: unknown;
  };
  on_true_next_node_id: string | null;
  on_false_next_node_id: string | null;
}

export type JourneyNode = ActionNode | DelayNode | ConditionalNode;

export interface Journey {
  id: string;
  name: string;
  start_node_id: string;
  nodes: JourneyNode[];
}

export interface PatientContext {
  id: string;
  age: number;
  language: 'en' | 'es';
  condition: 'hip_replacement' | 'knee_replacement';
}

// Helper types
export type NodeById = Record<string, JourneyNode>;

export interface ExecutionLogEntry {
  timestamp: string; // ISO 8601
  nodeId: string;
  nodeType: 'MESSAGE' | 'DELAY' | 'CONDITIONAL';
  action: string;
  details?: unknown;
}

export interface JourneyRun {
  runId: string;
  journeyId: string;
  patientId: string;
  currentNodeId: string | null;
  status: 'active' | 'waiting' | 'completed' | 'failed';
  wakeUpAt: string | null; // ISO 8601
  startedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601
  executionLog: ExecutionLogEntry[];
  errorMessage?: string;
}
