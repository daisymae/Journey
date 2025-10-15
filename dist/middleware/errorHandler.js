"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, _req, res, _next) => {
    // Default
    let status = 500;
    let code = 'INTERNAL_ERROR';
    const details = {};
    // Mongoose validation errors
    if (err && err.name === 'ValidationError') {
        status = 400;
        code = 'VALIDATION_ERROR';
        details.errors = err.errors;
    }
    // Mongoose cast errors / not found like
    if (err && err.name === 'CastError') {
        status = 400;
        code = 'BAD_REQUEST';
        details.message = err.message;
    }
    // Unsupported operator etc.
    if (err instanceof Error && code === 'INTERNAL_ERROR') {
        details.message = err.message;
    }
    console.error('[ERROR]', err);
    res.status(status).json({ error: 'Error', code, details });
};
exports.errorHandler = errorHandler;
