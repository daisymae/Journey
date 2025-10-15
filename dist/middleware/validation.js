"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePatient = validatePatient;
exports.validateJourney = validateJourney;
function badRequest(res, message, details = {}) {
    return res.status(400).json({ error: 'Bad Request', code: 'BAD_REQUEST', details: Object.assign({ message }, details) });
}
function validatePatient(req, res, next) {
    const { age, language, condition } = req.body || {};
    if (typeof age !== 'number')
        return badRequest(res, 'Patient.age must be a number');
    if (!['en', 'es'].includes(language))
        return badRequest(res, "Patient.language must be 'en' or 'es'");
    if (!['hip_replacement', 'knee_replacement'].includes(condition))
        return badRequest(res, "Patient.condition invalid");
    next();
}
function validateJourney(req, res, next) {
    const journey = req.body || {};
    if (!Array.isArray(journey.nodes) || journey.nodes.length === 0) {
        return badRequest(res, 'Journey must have at least one node');
    }
    if (typeof journey.start_node_id !== 'string') {
        return badRequest(res, 'Journey.start_node_id must be provided');
    }
    const ids = new Set(journey.nodes.map((n) => n.id));
    if (!ids.has(journey.start_node_id)) {
        return badRequest(res, 'start_node_id must reference an existing node');
    }
    for (const n of journey.nodes) {
        if (!n || typeof n.id !== 'string' || typeof n.type !== 'string') {
            return badRequest(res, 'Each node must have id and type');
        }
        if (n.type === 'MESSAGE' || n.type === 'DELAY') {
            if (n.next_node_id != null && !ids.has(n.next_node_id)) {
                return badRequest(res, `Node ${n.id} references missing next_node_id ${n.next_node_id}`);
            }
        }
        else if (n.type === 'CONDITIONAL') {
            if (!n.condition || typeof n.condition.field !== 'string' || typeof n.condition.operator !== 'string') {
                return badRequest(res, `Node ${n.id} requires condition { field, operator, value }`);
            }
            if (n.on_true_next_node_id != null && !ids.has(n.on_true_next_node_id)) {
                return badRequest(res, `Node ${n.id} references missing on_true_next_node_id ${n.on_true_next_node_id}`);
            }
            if (n.on_false_next_node_id != null && !ids.has(n.on_false_next_node_id)) {
                return badRequest(res, `Node ${n.id} references missing on_false_next_node_id ${n.on_false_next_node_id}`);
            }
        }
        else {
            return badRequest(res, `Unsupported node type: ${n.type}`);
        }
    }
    next();
}
