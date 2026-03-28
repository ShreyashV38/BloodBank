// ============================================================
// routes/donors.js — Full Donor Management (Admin)
// Search, filter, add, edit, view, delete + input validation
// ============================================================
import express from 'express';
import db from '../config/db.js';
import { validateParamId, sanitizeBody, requireRole } from '../middleware/security.js';
import { validateAddDonor } from '../middleware/validators.js';

const router = express.Router();

// GET /donors — list with search and filter
router.get('/', async (req, res) => {
    const { search, blood_group, eligibility } = req.query;
    try {
        let sql = `
            SELECT d.*, bg.group_name
            FROM donor d
            JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ` AND (d.first_name LIKE ? OR d.last_name LIKE ? OR d.phone LIKE ? OR d.email LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        if (blood_group) {
            sql += ` AND d.blood_group_id = ?`;
            params.push(blood_group);
        }
        if (eligibility === 'eligible') {
            sql += ` AND d.is_eligible = TRUE`;
        } else if (eligibility === 'ineligible') {
            sql += ` AND d.is_eligible = FALSE`;
        }

        sql += ` ORDER BY d.created_at DESC`;

        const [donors] = await db.query(sql, params);
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');

        res.render('donors/index', {
            title: 'Donors', donors, bloodGroups,
            search: search || '', blood_group: blood_group || '', eligibility: eligibility || ''
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

// GET /donors/add
router.get('/add', async (req, res) => {
    try {
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');
        res.render('donors/add', { title: 'Add Donor', bloodGroups, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST /donors/add
router.post('/add', sanitizeBody, validateAddDonor, async (req, res) => {
    if (req.validationError) {
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');
        return res.render('donors/add', { title: 'Add Donor', bloodGroups, error: req.validationError });
    }
    const { first_name, last_name, date_of_birth, gender, phone, email, address, blood_group_id } = req.body;
    try {
        await db.query(
            `INSERT INTO donor (first_name, last_name, date_of_birth, gender, phone, email, address, blood_group_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [first_name, last_name, date_of_birth, gender, phone, email || null, address || null, blood_group_id]
        );
        res.redirect('/donors');
    } catch (err) {
        console.error(err);
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');
        const msg = err.code === 'ER_DUP_ENTRY' ? 'A donor with this phone or email already exists.' : err.message;
        res.render('donors/add', { title: 'Add Donor', bloodGroups, error: msg });
    }
});

// GET /donors/view/:id — view donor details
router.get('/view/:id', validateParamId(), async (req, res) => {
    try {
        const [donors] = await db.query(`
            SELECT d.*, bg.group_name FROM donor d
            JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id
            WHERE d.donor_id = ?`, [req.params.id]);
        if (!donors.length) return res.redirect('/donors');

        const [donations] = await db.query(`
            SELECT don.*, bg.group_name FROM donation don
            JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
            WHERE don.donor_id = ? ORDER BY don.donation_date DESC`, [req.params.id]);

        const [appointments] = await db.query(`
            SELECT * FROM appointment WHERE donor_id = ? ORDER BY scheduled_date DESC`, [req.params.id]);

        res.render('donors/view', {
            title: 'Donor Details', donor: donors[0], donations, appointments
        });
    } catch (err) {
        console.error(err);
        res.redirect('/donors');
    }
});

// GET /donors/edit/:id
router.get('/edit/:id', validateParamId(), async (req, res) => {
    try {
        const [donors] = await db.query('SELECT * FROM donor WHERE donor_id = ?', [req.params.id]);
        if (!donors.length) return res.redirect('/donors');
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');
        res.render('donors/edit', { title: 'Edit Donor', donor: donors[0], bloodGroups, error: null });
    } catch (err) {
        console.error(err);
        res.redirect('/donors');
    }
});

// POST /donors/edit/:id (validated)
router.post('/edit/:id', validateParamId(), sanitizeBody, validateAddDonor, async (req, res) => {
    if (req.validationError) {
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');
        const donor = { ...req.body, donor_id: req.params.id };
        return res.render('donors/edit', { title: 'Edit Donor', donor, bloodGroups, error: req.validationError });
    }
    const { first_name, last_name, date_of_birth, gender, phone, email, address, blood_group_id } = req.body;
    try {
        await db.query(
            `UPDATE donor SET first_name=?, last_name=?, date_of_birth=?, gender=?, phone=?, email=?, address=?, blood_group_id=?
             WHERE donor_id=?`,
            [first_name, last_name, date_of_birth, gender, phone, email || null, address || null, blood_group_id, req.params.id]
        );
        res.redirect('/donors/view/' + req.params.id);
    } catch (err) {
        console.error(err);
        const [bloodGroups] = await db.query('SELECT * FROM blood_group');
        const donors = [req.body]; donors[0].donor_id = req.params.id;
        res.render('donors/edit', { title: 'Edit Donor', donor: donors[0], bloodGroups, error: err.message });
    }
});

// POST /donors/delete/:id — Super Admin only
router.post('/delete/:id', requireRole('Super Admin'), validateParamId(), async (req, res) => {
    try {
        await db.query('DELETE FROM donor WHERE donor_id = ?', [req.params.id]);
        res.redirect('/donors');
    } catch (err) {
        console.error(err);
        res.redirect('/donors');
    }
});

export default router;
