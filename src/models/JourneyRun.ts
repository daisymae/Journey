import mongoose, { Schema, Document, Model } from 'mongoose';

export type RunStatus = 'active' | 'waiting' | 'completed' | 'failed';

export interface ExecutionLogEntryDoc {
  timestamp: Date;
  nodeId: string;
  nodeType: 'MESSAGE' | 'DELAY' | 'CONDITIONAL';
  action: string;
  details?: unknown;
}

export interface JourneyRunDoc extends Document {
  runId: string;
  journeyId: string;
  patientId: string;
  currentNodeId: string | null;
  status: RunStatus;
  wakeUpAt: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  executionLog: ExecutionLogEntryDoc[];
  errorMessage?: string;
}

const ExecutionLogEntrySchema = new Schema<ExecutionLogEntryDoc>({
  timestamp: { type: Date, required: true },
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true, enum: ['MESSAGE', 'DELAY', 'CONDITIONAL'] },
  action: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
}, { _id: false });

const JourneyRunSchema = new Schema<JourneyRunDoc>({
  runId: { type: String, required: true, index: true, unique: true },
  journeyId: { type: String, required: true },
  patientId: { type: String, required: true, index: true },
  currentNodeId: { type: String, default: null },
  status: { type: String, required: true, enum: ['active', 'waiting', 'completed', 'failed'], index: true },
  wakeUpAt: { type: Date, default: null, index: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  executionLog: { type: [ExecutionLogEntrySchema], required: true, default: [] },
  errorMessage: { type: String },
}, { 
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (_doc, ret: any) => {
      // Remove mongoose internals
      delete ret._id;
      // Convert dates to ISO strings
      if (ret.wakeUpAt) ret.wakeUpAt = new Date(ret.wakeUpAt).toISOString();
      else ret.wakeUpAt = null;
      if (ret.startedAt) ret.startedAt = new Date(ret.startedAt).toISOString();
      if (ret.completedAt) ret.completedAt = new Date(ret.completedAt).toISOString();
      else ret.completedAt = null;
      if (Array.isArray(ret.executionLog)) {
        ret.executionLog = ret.executionLog.map((e: any) => ({
          ...e,
          timestamp: e.timestamp ? new Date(e.timestamp).toISOString() : undefined,
        }));
      }
      return ret;
    }
  }
});

// Indexes
JourneyRunSchema.index({ runId: 1 }, { unique: true });
JourneyRunSchema.index({ patientId: 1, status: 1, wakeUpAt: 1 });
JourneyRunSchema.index({ status: 1, wakeUpAt: 1 });

export const JourneyRun: Model<JourneyRunDoc> = mongoose.models.JourneyRun || mongoose.model<JourneyRunDoc>('JourneyRun', JourneyRunSchema);
