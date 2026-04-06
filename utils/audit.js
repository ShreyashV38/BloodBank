// ============================================================
// utils/audit.js — Audit Logging Helper
// Records user actions to audit_log table
// ============================================================
import pool from '../config/db.js';

/**
 * Log an action to the audit_log table
 * @param {number|null} userId    — acting user ID (null for system)
 * @param {string}      action    — action name (e.g. 'LOGIN_SUCCESS')
 * @param {string|null} entityType — entity type (e.g. 'system_user', 'blood_request')
 * @param {number|null} entityId   — entity ID
 * @param {string|null} details    — extra details
 * @param {string|null} ipAddress  — client IP
 */
export async function logAction(userId, action, entityType = null, entityId = null, details = null, ipAddress = null) {
    try {
        await pool.query(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, action, entityType, entityId, details, ipAddress]
        );
    } catch (err) {
        // Don't let audit failures break the application
        console.error('Audit log error:', err.message);
    }
}

/**
 * Get client IP from request
 */
export function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

export default { logAction, getClientIP };
