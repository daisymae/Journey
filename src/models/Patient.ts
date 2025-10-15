import mongoose, { Schema, Document, Model } from 'mongoose';

export interface PatientAttrs {
  id?: string;
  age: number;
  language: 'en' | 'es';
  condition: 'hip_replacement' | 'knee_replacement';
}

export interface PatientDoc extends Document {
  age: number;
  language: 'en' | 'es';
  condition: 'hip_replacement' | 'knee_replacement';
}

const PatientSchema = new Schema<PatientDoc>({
  age: { type: Number, required: true, min: 0 },
  language: { type: String, required: true, enum: ['en', 'es'] },
  condition: { type: String, required: true, enum: ['hip_replacement', 'knee_replacement'] },
}, { timestamps: true, toJSON: { virtuals: true, versionKey: false, transform: (_: any, ret: any) => {
  ret.id = (ret._id as any).toString();
  delete ret._id;
  return ret;
}}});

export const Patient: Model<PatientDoc> = mongoose.models.Patient || mongoose.model<PatientDoc>('Patient', PatientSchema);
