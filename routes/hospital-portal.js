// ============================================================
// routes/hospital-portal.js — Hospital Portal
// Security hardened: validation, sanitization, whitelist
// ============================================================
import express from 'express';
import pool from '../config/db.js';
import { sanitizeBody, validateParamId } from '../middleware/security.js';

const router = express.Router();

// Middleware — only Hospital role can access
function requireHospital(req, res, next) {
    if (!req.session.userId || req.session.role !== 'Hospital') {
        return res.redirect('/login');
    }
    next();
}

// GET /hospital-portal — hospital sees its own requests + raise new request form
router.get('/', requireHospital, async (req, res) => {
    try {
        const [hospitals] = await pool.query(
            'SELECT * FROM hospital WHERE user_id = ?',
            [req.session.userId]
        );
        if (!hospitals.length) {
            return res.render('hospital-portal/index', {
                title: 'Hospital Portal', hospital: null,
                requests: [], blood_groups: [],
                admin: { fullName: req.session.fullName, role: req.session.role },
                success: null, error: 'No hospital linked to this account.'
            });
        }
        const hospital = hospitals[0];

        const [requests] = await pool.query(`
            SELECT br.*, bg.group_name,
                   DATEDIFF(br.required_by_date, CURDATE()) AS days_left
            FROM blood_request br
            JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
            WHERE br.hospital_id = ?
            ORDER BY FIELD(br.status,'Pending','Approved','Fulfilled','Rejected'),
                     FIELD(br.urgency,'Critical','Urgent','Normal')
        `, [hospital.hospital_id]);

        const [blood_groups] = await pool.query('SELECT * FROM blood_group');

        res.render('hospital-portal/index', {
            title: 'Hospital Portal',
            hospital, requests, blood_groups,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST /hospital-portal/request — raise a new blood request (validated)
router.post('/request', requireHospital, sanitizeBody, async (req, res) => {
    const { blood_group_id, units_required, urgency, required_by_date, purpose } = req.body;

    // ── Input Validation ─────────────────────────────────────
    if (!blood_group_id || isNaN(blood_group_id) || blood_group_id < 1 || blood_group_id > 8) {
        return res.redirect('/hospital-portal?error=' + encodeURIComponent('Invalid blood group.'));
    }
    if (!units_required || isNaN(units_required) || parseFloat(units_required) < 0.5) {
        return res.redirect('/hospital-portal?error=' + encodeURIComponent('Units must be at least 0.5.'));
    }
    const validUrgencies = ['Normal', 'Urgent', 'Critical'];
    if (!urgency || !validUrgencies.includes(urgency)) {
        return res.redirect('/hospital-portal?error=' + encodeURIComponent('Invalid urgency level.'));
    }
    if (required_by_date && new Date(required_by_date) < new Date()) {
        return res.redirect('/hospital-portal?error=' + encodeURIComponent('Required-by date must be in the future.'));
    }

    try {
        const [hospitals] = await pool.query(
            'SELECT hospital_id FROM hospital WHERE user_id = ?',
            [req.session.userId]
        );
        if (!hospitals.length) return res.redirect('/hospital-portal');

        await pool.query(`
            INSERT INTO blood_request
              (hospital_id, blood_group_id, units_required, urgency, request_date, required_by_date, purpose)
            VALUES (?, ?, ?, ?, CURDATE(), ?, ?)
        `, [hospitals[0].hospital_id, parseInt(blood_group_id), parseFloat(units_required),
            urgency, required_by_date || null, purpose || null]);

        res.redirect('/hospital-portal?success=Request+submitted+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/hospital-portal?error=' + encodeURIComponent('Failed to submit request.'));
    }
});

export default router;
