import mongoose, { Schema, Document, Model } from 'mongoose';
import { NodeSchema } from './Node';

export interface JourneyDoc extends Document {
  id: string;
  name: string;
  start_node_id: string;
  nodes: any[]; // embedded nodes
}

const JourneySchema = new Schema<JourneyDoc>({
  name: { type: String, required: true },
  start_node_id: { type: String, required: true },
  nodes: { type: [NodeSchema] as any, required: true, default: [] },
}, { timestamps: true, toJSON: { virtuals: true, versionKey: false, transform: (_: any, ret: any) => {
  ret.id = (ret._id as any).toString();
  delete ret._id;
  return ret;
}}});

// Validation of node references and start node
JourneySchema.pre('validate', function (next) {
  const doc = this as any as JourneyDoc & { nodes: any[] };
  if (!doc.nodes || doc.nodes.length === 0) {
    return next(new Error('Journey must have at least one node'));
  }
  const ids = new Set<string>(doc.nodes.map((n: any) => n.id));
  if (!ids.has(doc.start_node_id)) {
    return next(new Error('start_node_id must reference an existing node'));
  }
  for (const n of doc.nodes) {
    if (n.type === 'MESSAGE' || n.type === 'DELAY') {
      if (n.next_node_id != null && !ids.has(n.next_node_id)) {
        return next(new Error(`Node ${n.id} references missing next_node_id ${n.next_node_id}`));
      }
    } else if (n.type === 'CONDITIONAL') {
      if (n.on_true_next_node_id != null && !ids.has(n.on_true_next_node_id)) {
        return next(new Error(`Node ${n.id} references missing on_true_next_node_id ${n.on_true_next_node_id}`));
      }
      if (n.on_false_next_node_id != null && !ids.has(n.on_false_next_node_id)) {
        return next(new Error(`Node ${n.id} references missing on_false_next_node_id ${n.on_false_next_node_id}`));
      }
    }
  }
  next();
});

export const Journey: Model<JourneyDoc> = mongoose.models.Journey || mongoose.model<JourneyDoc>('Journey', JourneySchema);
