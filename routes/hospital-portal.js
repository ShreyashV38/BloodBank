// ============================================================
// routes/hospital-portal.js — Hospital Portal + Email Alerts
// ============================================================
import express from 'express';
import pool from '../config/db.js';
import { sanitizeBody, validateParamId } from '../middleware/security.js';
import { sendRequestNotification } from '../utils/mailer.js';

const router = express.Router();

function requireHospital(req, res, next) {
    if (!req.session.userId || req.session.role !== 'Hospital') {
        return res.redirect('/login');
    }
    next();
}

// GET /hospital-portal — hospital sees its own requests + raise new request form
router.get('/', requireHospital, async (req, res) => {
    try {
        const [hospitals] = await pool.query('SELECT * FROM hospital WHERE user_id = ?', [req.session.userId]);
        if (!hospitals.length) {
            return res.render('hospital-portal/index', {
                title: 'Hospital Portal', hospital: null,
                requests: [], blood_groups: [],
                admin: { fullName: req.session.fullName, role: req.session.role },
                success: null, error: 'No hospital linked to this account.',
                layout: false
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
            error: req.query.error || null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST /hospital-portal/request — raise a new blood request
router.post('/request', requireHospital, sanitizeBody, async (req, res) => {
    const { blood_group_id, units_required, urgency, required_by_date, purpose } = req.body;

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
        const [hospitals] = await pool.query('SELECT hospital_id, name, email FROM hospital WHERE user_id = ?', [req.session.userId]);
        if (!hospitals.length) return res.redirect('/hospital-portal');

        const hospital = hospitals[0];
        const [[bg]] = await pool.query('SELECT group_name FROM blood_group WHERE blood_group_id = ?', [parseInt(blood_group_id)]);

        await pool.query(`
            INSERT INTO blood_request
              (hospital_id, blood_group_id, units_required, urgency, request_date, required_by_date, purpose)
            VALUES (?, ?, ?, ?, CURDATE(), ?, ?)
        `, [hospital.hospital_id, parseInt(blood_group_id), parseFloat(units_required),
            urgency, required_by_date || null, purpose || null]);

        // Send confirmation email
        if (hospital.email) {
            sendRequestNotification(hospital.email, hospital.name, {
                action: 'created', bloodGroup: bg?.group_name, units: units_required, urgency, purpose
            }).catch(err => console.error('Email error:', err.message));
        }

        res.redirect('/hospital-portal?success=Request+submitted+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/hospital-portal?error=' + encodeURIComponent('Failed to submit request.'));
    }
});

// GET /hospital-portal/invoices — billing & invoices page
router.get('/invoices', requireHospital, async (req, res) => {
    try {
        const [hospitals] = await pool.query('SELECT * FROM hospital WHERE user_id = ?', [req.session.userId]);
        if (!hospitals.length) {
            return res.render('hospital-portal/invoices', {
                title: 'Billing & Invoices', hospital: null,
                invoices: [], summary: { total: 0, pending: 0, paid: 0 },
                admin: { fullName: req.session.fullName, role: req.session.role },
                success: null, error: 'No hospital linked to this account.',

                layout: false
            });
        }
        const hospital = hospitals[0];

        const [invoices] = await pool.query(`
            SELECT i.*, rf.units_provided, rf.fulfilled_at, rf.transport_mode,
                   br.request_id, bg.group_name
            FROM invoice i
            JOIN request_fulfillment rf ON i.fulfillment_id = rf.fulfillment_id
            JOIN blood_request br ON rf.request_id = br.request_id
            JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
            WHERE i.hospital_id = ?
            ORDER BY i.issued_date DESC
        `, [hospital.hospital_id]);

        const summary = {
            total: invoices.length,
            pending: invoices.filter(inv => inv.status === 'Pending').reduce((s, inv) => s + parseFloat(inv.amount), 0),
            paid: invoices.filter(inv => inv.status === 'Paid').reduce((s, inv) => s + parseFloat(inv.amount), 0)
        };

        res.render('hospital-portal/invoices', {
            title: 'Billing & Invoices',
            hospital, invoices, summary,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null,
            error: req.query.error || null,

            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// =====================================================================
// FEATURE 2: Hospital "Fulfill Appointment" UI
// =====================================================================
router.get('/appointments', requireHospital, async (req, res) => {
    try {
        const [hospitals] = await pool.query('SELECT hospital_id, name FROM hospital WHERE user_id = ?', [req.session.userId]);
        if (!hospitals.length) return res.redirect('/hospital-portal');
        const hospital = hospitals[0];

        const [appointments] = await pool.query(`
            SELECT a.*, d.first_name, d.last_name, d.phone, bg.group_name,
                   CASE WHEN a.scheduled_date < CURDATE() THEN 'overdue'
                        WHEN a.scheduled_date = CURDATE() THEN 'today'
                        ELSE 'upcoming' END AS timing
            FROM appointment a
            JOIN donor d ON a.donor_id = d.donor_id
            JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id
            WHERE a.location = ? AND a.status = 'Scheduled'
            ORDER BY a.scheduled_date ASC, a.time_slot ASC
        `, [hospital.name]);

        res.render('hospital-portal/appointments', {
            title: 'Scheduled Appointments',
            hospital, appointments,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null, error: req.query.error || null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/appointments/fulfill/:id', requireHospital, validateParamId(), sanitizeBody, async (req, res) => {
    const { units_donated, weight, blood_pressure, hemoglobin_level } = req.body;
    try {
        const [hospitals] = await pool.query('SELECT name FROM hospital WHERE user_id = ?', [req.session.userId]);
        if (!hospitals.length) return res.redirect('/hospital-portal');
        const hospitalName = hospitals[0].name;

        const [appts] = await pool.query('SELECT donor_id, location, status FROM appointment WHERE appointment_id = ?', [req.params.id]);
        if (!appts.length || appts[0].location !== hospitalName || appts[0].status !== 'Scheduled') {
            return res.redirect('/hospital-portal/appointments?error=' + encodeURIComponent('Invalid appointment or unauthorized.'));
        }

        const donorId = appts[0].donor_id;
        const [donors] = await pool.query('SELECT blood_group_id FROM donor WHERE donor_id = ?', [donorId]);

        await pool.query('UPDATE appointment SET status = ? WHERE appointment_id = ?', ['Completed', req.params.id]);

        await pool.query(`
            INSERT INTO donation (donor_id, blood_group_id, donation_date, units_donated, weight, blood_pressure, hemoglobin_level, donated_at_location, phlebotomist_id)
            VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?)
        `, [donorId, donors[0].blood_group_id, parseFloat(units_donated), parseFloat(weight), blood_pressure, parseFloat(hemoglobin_level), hospitalName, req.session.userId]);

        res.redirect('/hospital-portal/appointments?success=Donation+recorded+and+appointment+fulfilled.');
    } catch (err) {
        console.error(err);
        res.redirect('/hospital-portal/appointments?error=' + encodeURIComponent('Failed to fulfill appointment.'));
    }
});

// =====================================================================
// FEATURE 3: Hospital "Walk-in Donation" UI
// =====================================================================
router.get('/walk-in', requireHospital, async (req, res) => {
    try {
        const [hospitals] = await pool.query('SELECT hospital_id, name FROM hospital WHERE user_id = ?', [req.session.userId]);
        if (!hospitals.length) return res.redirect('/hospital-portal');

        let donor = null;
        let bloodGroup = null;
        if (req.query.phone) {
            const [donors] = await pool.query(`
                SELECT d.*, bg.group_name 
                FROM donor d 
                JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id 
                WHERE d.phone = ?
            `, [req.query.phone]);
            if (donors.length) {
                donor = donors[0];
                bloodGroup = donor.group_name;
            }
        }

        res.render('hospital-portal/walk-in', {
            title: 'Walk-in Donation',
            hospital: hospitals[0],
            donor, bloodGroup, searchedPhone: req.query.phone,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null, error: req.query.error || null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/walk-in', requireHospital, sanitizeBody, async (req, res) => {
    const { donor_id, units_donated, weight, blood_pressure, hemoglobin_level } = req.body;
    try {
        const [hospitals] = await pool.query('SELECT name FROM hospital WHERE user_id = ?', [req.session.userId]);
        if (!hospitals.length) return res.redirect('/hospital-portal');
        
        const [donors] = await pool.query('SELECT blood_group_id, is_eligible FROM donor WHERE donor_id = ?', [donor_id]);
        if (!donors.length || !donors[0].is_eligible) {
            return res.redirect('/hospital-portal/walk-in?error=' + encodeURIComponent('Donor is not eligible.'));
        }

        await pool.query(`
            INSERT INTO donation (donor_id, blood_group_id, donation_date, units_donated, weight, blood_pressure, hemoglobin_level, donated_at_location, phlebotomist_id)
            VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?)
        `, [donor_id, donors[0].blood_group_id, parseFloat(units_donated), parseFloat(weight), blood_pressure, parseFloat(hemoglobin_level), hospitals[0].name, req.session.userId]);

        res.redirect('/hospital-portal/walk-in?success=Walk-in+donation+recorded+successfully.');
    } catch (err) {
        console.error(err);
        res.redirect('/hospital-portal/walk-in?error=' + encodeURIComponent('Failed to record donation.'));
    }
});

export default router;
