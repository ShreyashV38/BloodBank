// ============================================================
// routes/hospitals.js — Hospital Management (Admin)
// Full CRUD with Super Admin restrictions on delete
// ============================================================
import express from 'express';
import db from '../config/db.js';
import { validateParamId, sanitizeBody, requireRole } from '../middleware/security.js';

const router = express.Router();

// GET /hospitals — list all + add form
router.get('/', async (req, res) => {
    try {
        const [hospitals] = await db.query(`
            SELECT h.*, 
                   (SELECT COUNT(*) FROM blood_request br WHERE br.hospital_id = h.hospital_id) AS total_requests,
                   (SELECT COUNT(*) FROM blood_request br WHERE br.hospital_id = h.hospital_id AND br.status='Fulfilled') AS fulfilled_requests
            FROM hospital h ORDER BY h.registered_at DESC`);
        res.render('hospitals/index', {
            title: 'Hospitals', hospitals,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

// POST /hospitals/add — register a new hospital
router.post('/add', sanitizeBody, async (req, res) => {
    const { name, address, city, contact_person, phone, email } = req.body;

    // Server-side validation
    if (!name || !phone) {
        return res.redirect('/hospitals?error=' + encodeURIComponent('Hospital name and phone are required.'));
    }

    try {
        await db.query(
            `INSERT INTO hospital (name, address, city, contact_person, phone, email)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, address || null, city || null, contact_person || null, phone, email || null]
        );
        res.redirect('/hospitals?success=Hospital+registered+successfully');
    } catch (err) {
        console.error(err);
        const msg = err.code === 'ER_DUP_ENTRY' ? 'A hospital with these details already exists.' : err.message;
        res.redirect('/hospitals?error=' + encodeURIComponent(msg));
    }
});

// GET /hospitals/edit/:id
router.get('/edit/:id', validateParamId(), async (req, res) => {
    try {
        const [hospitals] = await db.query('SELECT * FROM hospital WHERE hospital_id = ?', [req.params.id]);
        if (!hospitals.length) return res.redirect('/hospitals');
        res.render('hospitals/edit', { title: 'Edit Hospital', hospital: hospitals[0], error: null });
    } catch (err) {
        console.error(err);
        res.redirect('/hospitals');
    }
});

// POST /hospitals/edit/:id
router.post('/edit/:id', validateParamId(), sanitizeBody, async (req, res) => {
    const { name, address, city, contact_person, phone, email } = req.body;
    try {
        await db.query(
            `UPDATE hospital SET name=?, address=?, city=?, contact_person=?, phone=?, email=?
             WHERE hospital_id=?`,
            [name, address || null, city || null, contact_person || null, phone, email || null, req.params.id]
        );
        res.redirect('/hospitals?success=Hospital+updated+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/hospitals?error=' + encodeURIComponent(err.message));
    }
});

// POST /hospitals/delete/:id — Super Admin only
router.post('/delete/:id', requireRole('Super Admin'), validateParamId(), async (req, res) => {
    try {
        // Check for existing blood requests first
        const [[{ cnt }]] = await db.query(
            'SELECT COUNT(*) AS cnt FROM blood_request WHERE hospital_id = ? AND status = "Pending"', [req.params.id]);
        if (cnt > 0) {
            return res.redirect('/hospitals?error=' + encodeURIComponent('Cannot delete hospital with pending blood requests.'));
        }
        await db.query('DELETE FROM hospital WHERE hospital_id = ?', [req.params.id]);
        res.redirect('/hospitals?success=Hospital+removed');
    } catch (err) {
        console.error(err);
        res.redirect('/hospitals?error=' + encodeURIComponent('Cannot delete: ' + err.message));
    }
});

export default router;
