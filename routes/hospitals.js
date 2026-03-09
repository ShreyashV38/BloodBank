// ============================================================
// routes/hospitals.js — Hospital Management  [PERSON 2]
// ============================================================
import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// GET /hospitals — list all + add form inline
router.get('/', async (req, res) => {
    try {
        const [hospitals] = await db.query('SELECT * FROM hospital ORDER BY registered_at DESC');
        res.render('hospitals/index', { title: 'Hospitals', hospitals, error: null, success: req.query.success || null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

// POST /hospitals/add — register a new hospital
router.post('/add', async (req, res) => {
    const { name, address, city, contact_person, phone, email } = req.body;
    try {
        await db.query(
            `INSERT INTO hospital (name, address, city, contact_person, phone, email)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, address || null, city || null, contact_person || null, phone, email || null]
        );
        res.redirect('/hospitals?success=Hospital+registered+successfully');
    } catch (err) {
        console.error(err);
        const [hospitals] = await db.query('SELECT * FROM hospital ORDER BY registered_at DESC');
        res.render('hospitals/index', { title: 'Hospitals', hospitals, error: err.message, success: null });
    }
});

// POST /hospitals/delete/:id — remove hospital
router.post('/delete/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM hospital WHERE hospital_id = ?', [req.params.id]);
        res.redirect('/hospitals?success=Hospital+removed');
    } catch (err) {
        console.error(err);
        res.redirect('/hospitals');
    }
});

export default router;
