// ============================================================
// routes/inventory.js — Blood Inventory (Person 1 owns this)
// Stub provided so server.js can mount the route cleanly
// ============================================================
import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// GET /inventory
router.get('/', async (req, res) => {
    try {
        const [stock] = await db.query('SELECT * FROM vw_blood_stock');
        res.render('inventory/index', { title: 'Blood Inventory', stock });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

export default router;
