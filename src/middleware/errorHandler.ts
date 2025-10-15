import { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Default
  let status = 500;
  let code = 'INTERNAL_ERROR';
  const details: Record<string, unknown> = {};

  // Mongoose validation errors
  if (err && err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    details.errors = (err as any).errors;
  }
  // Mongoose cast errors / not found like
  if (err && err.name === 'CastError') {
    status = 400;
    code = 'BAD_REQUEST';
    details.message = (err as any).message;
  }

  // Unsupported operator etc.
  if (err instanceof Error && code === 'INTERNAL_ERROR') {
    details.message = err.message;
  }

  console.error('[ERROR]', err);
  res.status(status).json({ error: 'Error', code, details });
};
