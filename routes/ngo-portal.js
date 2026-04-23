// ============================================================
// routes/ngo-portal.js — NGO self-service portal
// Security hardened: validation, sanitization, param checks
// ============================================================
import express from 'express';
import pool from '../config/db.js';
import { sanitizeBody, validateParamId } from '../middleware/security.js';

const router = express.Router();

function requireNGO(req, res, next) {
    if (!req.session.userId || req.session.role !== 'NGO') {
        return res.redirect('/login');
    }
    next();
}

// GET /ngo-portal — NGO dashboard with their camps
router.get('/', requireNGO, async (req, res) => {
    try {
        const [ngos] = await pool.query('SELECT * FROM ngo WHERE user_id = ?', [req.session.userId]);
        if (!ngos.length) {
            return res.render('ngo-portal/index', {
                title: 'NGO Portal', ngo: null, camps: [], blood_groups: [],
                admin: { fullName: req.session.fullName, role: req.session.role },
                success: null, error: 'No NGO linked to this account.',
                layout: false
            });
        }
        const ngo = ngos[0];

        const [camps] = await pool.query(`
            SELECT dc.*, COALESCE(h.name, '') AS hospital_partner
            FROM donation_camp dc
            LEFT JOIN hospital h ON dc.hospital_id = h.hospital_id
            WHERE dc.ngo_id = ?
            ORDER BY dc.camp_date DESC
        `, [ngo.ngo_id]);

        const [hospitals] = await pool.query('SELECT hospital_id, name FROM hospital ORDER BY name');

        res.render('ngo-portal/index', {
            title: 'NGO Portal', ngo, camps, hospitals,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null, error: req.query.error || null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST /ngo-portal/camp — create a new camp (validated)
router.post('/camp', requireNGO, sanitizeBody, async (req, res) => {
    const { name, location, city, camp_date, start_time, end_time, expected_donors,
            contact_person, contact_phone, description, hospital_id } = req.body;

    // ── Validation ───────────────────────────────────────────
    if (!name || name.trim().length < 3) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Camp name must be at least 3 characters.'));
    }
    if (!location || location.trim().length < 5) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Location must be at least 5 characters.'));
    }
    if (!camp_date || isNaN(Date.parse(camp_date))) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Valid camp date is required.'));
    }
    if (new Date(camp_date) < new Date(new Date().toDateString())) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Camp date cannot be in the past.'));
    }
    if (expected_donors && (isNaN(expected_donors) || parseInt(expected_donors) < 0 || parseInt(expected_donors) > 10000)) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Expected donors must be 0-10000.'));
    }
    if (contact_phone && !/^[6-9]\d{9}$/.test(contact_phone)) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Invalid contact phone number.'));
    }
    if (name.length > 150 || location.length > 200 || (description && description.length > 500)) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Input too long.'));
    }

    try {
        const [ngos] = await pool.query('SELECT ngo_id FROM ngo WHERE user_id = ?', [req.session.userId]);
        if (!ngos.length) return res.redirect('/ngo-portal');

        await pool.query(`
            INSERT INTO donation_camp 
            (name, organizer_type, ngo_id, hospital_id, location, city, camp_date, start_time, end_time,
             expected_donors, contact_person, contact_phone, description, created_by)
            VALUES (?, 'NGO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name.trim(), ngos[0].ngo_id, hospital_id || null, location.trim(), city || null,
            camp_date, start_time || null, end_time || null, parseInt(expected_donors) || 0,
            contact_person || null, contact_phone || null, description || null, req.session.userId]);

        res.redirect('/ngo-portal?success=Camp+created+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/ngo-portal?error=' + encodeURIComponent('Failed to create camp.'));
    }
});

// POST /ngo-portal/camp/update/:id — update camp results (validated)
router.post('/camp/update/:id', requireNGO, validateParamId(), sanitizeBody, async (req, res) => {
    const { status, actual_donors, units_collected } = req.body;

    // Whitelist status values
    const validStatuses = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Invalid camp status.'));
    }
    if (actual_donors && (isNaN(actual_donors) || parseInt(actual_donors) < 0)) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Invalid donor count.'));
    }
    if (units_collected && (isNaN(units_collected) || parseFloat(units_collected) < 0)) {
        return res.redirect('/ngo-portal?error=' + encodeURIComponent('Invalid units collected.'));
    }

    try {
        const [ngos] = await pool.query('SELECT ngo_id FROM ngo WHERE user_id = ?', [req.session.userId]);
        if (!ngos.length) return res.redirect('/ngo-portal');

        // Only allow updating own camps (ownership check in WHERE)
        const [result] = await pool.query(
            'UPDATE donation_camp SET status = ?, actual_donors = ?, units_collected = ? WHERE camp_id = ? AND ngo_id = ?',
            [status, parseInt(actual_donors) || 0, parseFloat(units_collected) || 0, req.params.id, ngos[0].ngo_id]
        );

        if (result.affectedRows === 0) {
            return res.redirect('/ngo-portal?error=' + encodeURIComponent('Camp not found or not authorized.'));
        }

        res.redirect('/ngo-portal?success=Camp+updated');
    } catch (err) {
        console.error(err);
        res.redirect('/ngo-portal');
    }
});

// =====================================================================
// FEATURE 4: NGO Camp Management Dashboard
// =====================================================================
router.get('/camps', requireNGO, async (req, res) => {
    try {
        const [ngos] = await pool.query('SELECT ngo_id, name FROM ngo WHERE user_id = ?', [req.session.userId]);
        if (!ngos.length) return res.redirect('/login');

        const [camps] = await pool.query(`
            SELECT * FROM donation_camp WHERE ngo_id = ? ORDER BY camp_date DESC
        `, [ngos[0].ngo_id]);

        res.render('ngo-portal/camps', {
            title: 'Camp Management', ngo: ngos[0], camps,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null, error: req.query.error || null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/camps/propose', requireNGO, sanitizeBody, async (req, res) => {
    const { name, location, city, camp_date, start_time, end_time, expected_donors } = req.body;
    try {
        const [ngos] = await pool.query('SELECT ngo_id FROM ngo WHERE user_id = ?', [req.session.userId]);
        if (!ngos.length) return res.redirect('/login');

        await pool.query(`
            INSERT INTO donation_camp (organizer_type, ngo_id, name, location, city, camp_date, start_time, end_time, expected_donors, status, created_by)
            VALUES ('NGO', ?, ?, ?, ?, ?, ?, ?, ?, 'Upcoming', ?)
        `, [ngos[0].ngo_id, name, location, city, camp_date, start_time || null, end_time || null, parseInt(expected_donors) || 0, req.session.userId]);

        res.redirect('/ngo-portal/camps?success=Camp+proposed+successfully.');
    } catch (err) {
        console.error(err);
        res.redirect('/ngo-portal/camps?error=' + encodeURIComponent('Failed to propose camp.'));
    }
});

export default router;
