// ============================================================
// routes/requests.js — Blood Request Management + Email Alerts
// ============================================================
import express from 'express';
import db from '../config/db.js';
import { validateParamId, sanitizeBody } from '../middleware/security.js';
import { validateBloodRequest } from '../middleware/validators.js';
import { sendRequestNotification } from '../utils/mailer.js';

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
        res.status(500).send('Server error');
    }
});

// POST /requests/add — raise a new blood request (validated)
router.post('/add', sanitizeBody, validateBloodRequest, async (req, res) => {
    if (req.validationError) {
        return res.redirect('/requests?error=' + encodeURIComponent(req.validationError));
    }

    const { hospital_id, blood_group_id, units_required, urgency, required_by_date, purpose } = req.body;

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

        // Send email notification
        try {
            const [[hospital]] = await db.query('SELECT name, email FROM hospital WHERE hospital_id = ?', [hospital_id]);
            const [[bg]] = await db.query('SELECT group_name FROM blood_group WHERE blood_group_id = ?', [blood_group_id]);
            if (hospital?.email) {
                sendRequestNotification(hospital.email, hospital.name, {
                    action: 'created', bloodGroup: bg?.group_name, units: units_required, urgency, purpose
                });
            }
        } catch (emailErr) { console.error('Email notification error:', emailErr.message); }

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

        // Send fulfillment email
        try {
            const [[reqData]] = await db.query(`
                SELECT br.*, h.name AS hospital_name, h.email AS hospital_email, bg.group_name
                FROM blood_request br JOIN hospital h ON br.hospital_id = h.hospital_id
                JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
                WHERE br.request_id = ?`, [request_id]);
            if (reqData?.hospital_email) {
                sendRequestNotification(reqData.hospital_email, reqData.hospital_name, {
                    action: 'fulfilled', bloodGroup: reqData.group_name, units: units_provided
                });
            }
        } catch (emailErr) { console.error('Email error:', emailErr.message); }

        res.redirect('/requests?success=Request+approved+and+inventory+deducted+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/requests?error=' + encodeURIComponent('Failed to process request. Please check inventory levels.'));
    }
});

// POST /requests/reject/:id — reject a request (validated)
router.post('/reject/:id', validateParamId(), async (req, res) => {
    try {
        // Send rejection email
        try {
            const [[reqData]] = await db.query(`
                SELECT br.*, h.name AS hospital_name, h.email AS hospital_email, bg.group_name
                FROM blood_request br JOIN hospital h ON br.hospital_id = h.hospital_id
                JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
                WHERE br.request_id = ?`, [req.params.id]);
            if (reqData?.hospital_email) {
                sendRequestNotification(reqData.hospital_email, reqData.hospital_name, {
                    action: 'rejected', bloodGroup: reqData.group_name, units: reqData.units_required
                });
            }
        } catch (emailErr) { console.error('Email error:', emailErr.message); }

        await db.query("UPDATE blood_request SET status = 'Rejected' WHERE request_id = ?", [req.params.id]);
        res.redirect('/requests?success=Request+rejected');
    } catch (err) {
        console.error(err);
        res.redirect('/requests?error=' + encodeURIComponent('Failed to reject request.'));
    }
});

export default router;
