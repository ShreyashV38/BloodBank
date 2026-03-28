// ============================================================
// routes/requests.js — Blood Request Management
// Security hardened: validation, param checks, sanitization
// ============================================================
import express from 'express';
import db from '../config/db.js';
import { validateParamId, sanitizeBody } from '../middleware/security.js';
import { validateBloodRequest } from '../middleware/validators.js';

const router = express.Router();

// GET /requests — pending requests via view, plus form to add new
router.get('/', async (req, res) => {
    try {
        const [pending] = await db.query('SELECT * FROM vw_pending_requests');
        const [hospitals] = await db.query('SELECT hospital_id, name, city FROM hospital ORDER BY name');
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');
        const [history] = await db.query(
            `SELECT br.*, h.name AS hospital_name, bg.group_name
             FROM blood_request br
             JOIN hospital    h  ON br.hospital_id    = h.hospital_id
             JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
             WHERE br.status != 'Pending'
             ORDER BY br.request_date DESC LIMIT 15`
        );
        res.render('requests/index', {
            title: 'Blood Requests', pending, hospitals, bloodGroups, history,
            error: req.query.error || null, success: req.query.success || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

// POST /requests/add — raise a new blood request (validated)
router.post('/add', sanitizeBody, validateBloodRequest, async (req, res) => {
    if (req.validationError) {
        return res.redirect('/requests?error=' + encodeURIComponent(req.validationError));
    }

    const { hospital_id, blood_group_id, units_required, urgency, required_by_date, purpose } = req.body;

    // Whitelist urgency values
    const validUrgencies = ['Normal', 'Urgent', 'Critical'];
    if (!validUrgencies.includes(urgency)) {
        return res.redirect('/requests?error=' + encodeURIComponent('Invalid urgency level.'));
    }

    try {
        await db.query(
            `INSERT INTO blood_request (hospital_id, blood_group_id, units_required, urgency, required_by_date, purpose)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [hospital_id, blood_group_id, units_required, urgency, required_by_date || null, purpose || null]
        );
        res.redirect('/requests?success=Blood+request+submitted+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/requests?error=' + encodeURIComponent('Failed to submit request.'));
    }
});

// POST /requests/approve/:id — calls sp_fulfill_request
router.post('/approve/:id', validateParamId(), sanitizeBody, async (req, res) => {
    const { inventory_id, units_provided, dispatch_temperature, transport_mode } = req.body;
    const request_id = req.params.id;
    const admin_id = req.session.adminId;

    // Validate all required fields
    if (!inventory_id || !/^\d+$/.test(inventory_id)) {
        return res.redirect('/requests?error=' + encodeURIComponent('Invalid inventory ID.'));
    }
    if (!units_provided || isNaN(units_provided) || parseFloat(units_provided) <= 0) {
        return res.redirect('/requests?error=' + encodeURIComponent('Invalid units provided.'));
    }
    if (!admin_id) {
        return res.redirect('/requests?error=' + encodeURIComponent('Admin session required.'));
    }

    try {
        await db.query(
            'CALL sp_fulfill_request(?, ?, ?, ?, ?, ?)',
            [request_id, parseInt(inventory_id), parseFloat(units_provided), admin_id,
             dispatch_temperature || null, transport_mode || null]
        );
        res.redirect('/requests?success=Request+approved+and+inventory+deducted+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/requests?error=' + encodeURIComponent(err.message));
    }
});

// POST /requests/reject/:id — reject a request (validated)
router.post('/reject/:id', validateParamId(), async (req, res) => {
    try {
        await db.query(
            "UPDATE blood_request SET status = 'Rejected' WHERE request_id = ?",
            [req.params.id]
        );
        res.redirect('/requests?success=Request+rejected');
    } catch (err) {
        console.error(err);
        res.redirect('/requests');
    }
});

export default router;
