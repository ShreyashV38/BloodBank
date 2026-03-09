// ============================================================
// routes/donors.js — Donor management (Person 1 owns this)
// Stub provided so server.js can mount the route cleanly
// ============================================================
import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// GET /donors
router.get('/', async (req, res) => {
    try {
        const [donors] = await db.query(`
            SELECT d.*, bg.group_name
            FROM donor d
            JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id
            ORDER BY d.created_at DESC
        `);
        res.render('donors/index', { title: 'Donors', donors });
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
        res.status(500).send('Server error: ' + err.message);
    }
});

// POST /donors/add
router.post('/add', async (req, res) => {
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
        res.render('donors/add', { title: 'Add Donor', bloodGroups, error: err.message });
    }
});

export default router;
