// ============================================================
// routes/camps.js — Donation Camps & NGO Management
// ============================================================
import express from 'express';
import db from '../config/db.js';
import { requireRole, validateParamId, sanitizeBody } from '../middleware/security.js';
import { validateCamp } from '../middleware/validators.js';

const router = express.Router();

// GET /camps — list upcoming + past camps
router.get('/', async (req, res) => {
    try {
        const [upcoming] = await db.query(`
            SELECT dc.*, 
                   COALESCE(n.name, h.name, 'Self-organized') AS organizer_display_name,
                   COALESCE(n.name, '') AS ngo_name
            FROM donation_camp dc
            LEFT JOIN ngo n ON dc.ngo_id = n.ngo_id
            LEFT JOIN hospital h ON dc.hospital_id = h.hospital_id
            WHERE dc.status IN ('Upcoming', 'Ongoing')
            ORDER BY dc.camp_date ASC
        `);

        const [past] = await db.query(`
            SELECT dc.*, 
                   COALESCE(n.name, h.name, 'Self-organized') AS organizer_display_name
            FROM donation_camp dc
            LEFT JOIN ngo n ON dc.ngo_id = n.ngo_id
            LEFT JOIN hospital h ON dc.hospital_id = h.hospital_id
            WHERE dc.status IN ('Completed', 'Cancelled')
            ORDER BY dc.camp_date DESC
            LIMIT 20
        `);

        const [ngos] = await db.query('SELECT ngo_id, name FROM ngo WHERE is_verified = TRUE ORDER BY name');
        const [hospitals] = await db.query('SELECT hospital_id, name FROM hospital ORDER BY name');

        res.render('camps/index', {
            title: 'Donation Camps',
            upcoming, past, ngos, hospitals,
            error: null, success: req.query.success || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

// POST /camps/add — create a new camp
router.post('/add', sanitizeBody, validateCamp, async (req, res) => {
    if (req.validationError) {
        return res.redirect('/camps?error=' + encodeURIComponent(req.validationError));
    }

    const { name, organizer_type, organizer_name, location, city, camp_date,
            start_time, end_time, expected_donors, contact_person, contact_phone, description,
            ngo_id, hospital_id } = req.body;
    try {
        await db.query(`
            INSERT INTO donation_camp 
            (name, organizer_type, ngo_id, hospital_id, location, city, camp_date, start_time, end_time,
             expected_donors, contact_person, contact_phone, description, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, organizer_type, ngo_id || null, hospital_id || null, location, city || null,
            camp_date, start_time || null, end_time || null, expected_donors || 0,
            contact_person || null, contact_phone || null, description || null, req.session.userId]);

        res.redirect('/camps?success=Donation+camp+created+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/camps?error=' + encodeURIComponent('Failed to create camp.'));
    }
});

// POST /camps/update-status/:id — update camp status (validated)
router.post('/update-status/:id', validateParamId(), sanitizeBody, async (req, res) => {
    const { status, actual_donors, units_collected } = req.body;

    // Whitelist status values
    const validStatuses = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
        return res.redirect('/camps?error=' + encodeURIComponent('Invalid camp status.'));
    }
    if (actual_donors && (isNaN(actual_donors) || parseInt(actual_donors) < 0)) {
        return res.redirect('/camps?error=' + encodeURIComponent('Invalid donor count.'));
    }
    if (units_collected && (isNaN(units_collected) || parseFloat(units_collected) < 0)) {
        return res.redirect('/camps?error=' + encodeURIComponent('Invalid units value.'));
    }

    try {
        await db.query(
            'UPDATE donation_camp SET status = ?, actual_donors = ?, units_collected = ? WHERE camp_id = ?',
            [status, parseInt(actual_donors) || 0, parseFloat(units_collected) || 0, req.params.id]
        );
        res.redirect('/camps?success=Camp+status+updated');
    } catch (err) {
        console.error(err);
        res.redirect('/camps');
    }
});

export default router;
