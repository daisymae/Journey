import { Schema } from 'mongoose';

// This schema is designed primarily for embedding within Journey.nodes
// Not exported as a standalone model to keep nodes embedded in journeys.

export const ConditionSchema = new Schema({
  field: { type: String, required: true },
  operator: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
}, { _id: false });

export const NodeSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true, enum: ['MESSAGE', 'DELAY', 'CONDITIONAL'] },
  // MESSAGE
  message: { type: String },
  next_node_id: { type: String, default: null },
  // DELAY
  duration_seconds: { type: Number },
  // CONDITIONAL
  condition: { type: ConditionSchema },
  on_true_next_node_id: { type: String, default: null },
  on_false_next_node_id: { type: String, default: null },
}, { _id: false });

// Conditional required fields per node type
NodeSchema.pre('validate', function (next) {
  const doc: any = this as any;
  if (doc.type === 'MESSAGE') {
    if (typeof doc.message !== 'string') return next(new Error('MESSAGE node requires message'));
  }
  if (doc.type === 'DELAY') {
    if (typeof doc.duration_seconds !== 'number') return next(new Error('DELAY node requires duration_seconds'));
  }
  if (doc.type === 'CONDITIONAL') {
    if (!doc.condition || typeof doc.condition.field !== 'string' || typeof doc.condition.operator !== 'string') {
      return next(new Error('CONDITIONAL node requires condition { field, operator, value }'));
    }
  }
  next();
});
