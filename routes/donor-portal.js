// ============================================================
// routes/donor-portal.js — Full Donor Portal Implementation
// Security hardened: sanitization, param validation
// ============================================================
import express from 'express';
import pool from '../config/db.js';
import { sanitizeBody, validateParamId } from '../middleware/security.js';

const router = express.Router();

function requireDonor(req, res, next) {
    if (!req.session.userId || req.session.role !== 'Donor') {
        return res.redirect('/login');
    }
    next();
}

// GET /donor-portal — donor dashboard
router.get('/', requireDonor, async (req, res) => {
    try {
        const [donors] = await pool.query(
            `SELECT d.*, bg.group_name FROM donor d 
             JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id 
             WHERE d.user_id = ?`,
            [req.session.userId]
        );

        if (!donors.length) {
            return res.render('donor-portal/index', {
                title: 'Donor Portal', donor: null, donations: [], appointments: [],
                admin: { fullName: req.session.fullName, role: req.session.role },
                success: null, error: 'No donor profile linked to your account.',
                layout: false
            });
        }
        const donor = donors[0];

        // Donation history
        const [donations] = await pool.query(`
            SELECT don.*, bg.group_name 
            FROM donation don 
            JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
            WHERE don.donor_id = ?
            ORDER BY don.donation_date DESC
        `, [donor.donor_id]);

        // Appointments
        const [appointments] = await pool.query(`
            SELECT * FROM appointment WHERE donor_id = ? ORDER BY scheduled_date DESC
        `, [donor.donor_id]);

        // Calculate eligibility countdown
        let daysUntilEligible = 0;
        if (donor.last_donation_date) {
            const daysSince = Math.floor((Date.now() - new Date(donor.last_donation_date).getTime()) / (24 * 60 * 60 * 1000));
            daysUntilEligible = Math.max(0, 58 - daysSince);
        }

        res.render('donor-portal/index', {
            title: 'Donor Portal', donor, donations, appointments,
            daysUntilEligible,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null, error: req.query.error || null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST /donor-portal/book-appointment — schedule a donation (validated)
router.post('/book-appointment', requireDonor, sanitizeBody, async (req, res) => {
    const { scheduled_date, time_slot, location, notes } = req.body;

    // ── Validation ───────────────────────────────────────────
    if (!scheduled_date || isNaN(Date.parse(scheduled_date))) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Invalid date.'));
    }
    if (new Date(scheduled_date) <= new Date()) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Appointment date must be in the future.'));
    }
    // Validate time slot if provided
    const validSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', ''];
    if (time_slot && !validSlots.includes(time_slot)) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Invalid time slot.'));
    }
    // Limit location/notes length
    if (location && location.length > 200) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Location too long (max 200 chars).'));
    }
    if (notes && notes.length > 500) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Notes too long (max 500 chars).'));
    }

    try {
        const [donors] = await pool.query('SELECT donor_id FROM donor WHERE user_id = ?', [req.session.userId]);
        if (!donors.length) return res.redirect('/donor-portal');

        await pool.query(`
            INSERT INTO appointment (donor_id, scheduled_date, time_slot, location, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [donors[0].donor_id, scheduled_date, time_slot || null,
            location || 'GMC Blood Bank, Bambolim, Goa', notes || null]);

        res.redirect('/donor-portal?success=Appointment+booked+successfully');
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.redirect('/donor-portal?error=' + encodeURIComponent('You already have a scheduled appointment on this date.'));
        }
        res.redirect('/donor-portal?error=' + encodeURIComponent('Failed to book appointment.'));
    }
});

// POST /donor-portal/cancel-appointment/:id — cancel appointment (validated)
router.post('/cancel-appointment/:id', requireDonor, validateParamId(), async (req, res) => {
    try {
        const [donors] = await pool.query('SELECT donor_id FROM donor WHERE user_id = ?', [req.session.userId]);
        if (!donors.length) return res.redirect('/donor-portal');

        // Only cancel own appointments (donor ownership check built into WHERE)
        const [result] = await pool.query(
            "UPDATE appointment SET status = 'Cancelled' WHERE appointment_id = ? AND donor_id = ? AND status = 'Scheduled'",
            [req.params.id, donors[0].donor_id]
        );
        if (result.affectedRows === 0) {
            return res.redirect('/donor-portal?error=' + encodeURIComponent('Appointment not found or already processed.'));
        }
        res.redirect('/donor-portal?success=Appointment+cancelled');
    } catch (err) {
        console.error(err);
        res.redirect('/donor-portal');
    }
});

export default router;
