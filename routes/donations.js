// ============================================================
// routes/donations.js — Record Donations
// Security hardened: validation, sanitization
// ============================================================
import express from 'express';
import db from '../config/db.js';
import { sanitizeBody } from '../middleware/security.js';
import { validateDonation } from '../middleware/validators.js';

const router = express.Router();

// GET /donations — show form + recent donations
router.get('/', async (req, res) => {
    try {
        const [donors] = await db.query(
            'SELECT donor_id, first_name, last_name, blood_group_id, is_eligible FROM donor ORDER BY first_name'
        );
        const [recent] = await db.query(
            `SELECT don.*, CONCAT(d.first_name,' ',d.last_name) AS donor_name, bg.group_name
             FROM donation don
             JOIN donor d       ON don.donor_id       = d.donor_id
             JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
             ORDER BY don.donation_date DESC LIMIT 20`
        );
        res.render('donations/index', {
            title: 'Record Donation', donors, recent,
            error: null, success: req.query.success || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

// POST /donations/record — insert a donation (validated)
router.post('/record', sanitizeBody, validateDonation, async (req, res) => {
    if (req.validationError) {
        const [donors] = await db.query('SELECT donor_id, first_name, last_name, is_eligible FROM donor ORDER BY first_name');
        const [recent] = await db.query(
            `SELECT don.*, CONCAT(d.first_name,' ',d.last_name) AS donor_name, bg.group_name
             FROM donation don JOIN donor d ON don.donor_id = d.donor_id
             JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
             ORDER BY don.donation_date DESC LIMIT 20`
        );
        return res.render('donations/index', {
            title: 'Record Donation', donors, recent,
            error: req.validationError, success: null
        });
    }
    const { donor_id, units_donated, donated_at_location } = req.body;
    let donors = [], recent = [];
    try {
        // Check eligibility first
        const [[elig]] = await db.query(
            'CALL sp_check_eligibility(?, @out); SELECT @out AS eligible;',
            [donor_id]
        ).catch(() => [[{ eligible: null }]]);

        // Use direct INSERT — before_donation_insert trigger will block if ineligible
        await db.query(
            `INSERT INTO donation (donor_id, blood_group_id, donation_date, units_donated, donated_at_location)
             SELECT ?, blood_group_id, CURDATE(), ?, ? FROM donor WHERE donor_id = ?`,
            [donor_id, units_donated, donated_at_location || null, donor_id]
        );
        res.redirect('/donations?success=Donation+recorded+successfully!+Inventory+updated.');
    } catch (err) {
        console.error(err);
        [donors] = await db.query('SELECT donor_id, first_name, last_name, is_eligible FROM donor ORDER BY first_name');
        [recent] = await db.query(
            `SELECT don.*, CONCAT(d.first_name,' ',d.last_name) AS donor_name, bg.group_name
             FROM donation don
             JOIN donor d ON don.donor_id = d.donor_id
             JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
             ORDER BY don.donation_date DESC LIMIT 20`
        );
        res.render('donations/index', {
            title: 'Record Donation', donors, recent,
            error: err.message, success: null
        });
    }
});

export default router;
