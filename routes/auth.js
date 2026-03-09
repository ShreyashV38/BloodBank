import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';

const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect(_portalFor(req.session.role));
    res.render('auth/login', { title: 'Login', error: null, layout: false });
});

// POST /login — role-based redirect
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM system_user WHERE username = ? AND is_active = TRUE',
            [username]
        );
        if (!rows.length) {
            return res.render('auth/login', { title: 'Login', error: 'Invalid username or password.', layout: false });
        }
        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.render('auth/login', { title: 'Login', error: 'Invalid username or password.', layout: false });
        }

        // Save session
        req.session.userId = user.user_id;
        req.session.username = user.username;
        req.session.fullName = user.full_name;
        req.session.role = user.role;

        // Also keep legacy adminId for existing admin routes
        if (user.role === 'Super Admin' || user.role === 'Staff') {
            req.session.adminId = user.user_id;
        }

        // Update last_login
        await pool.query('UPDATE system_user SET last_login = NOW() WHERE user_id = ?', [user.user_id]);

        res.redirect(_portalFor(user.role));
    } catch (err) {
        console.error(err);
        res.render('auth/login', { title: 'Login', error: 'Server error. Please try again.', layout: false });
    }
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Helper — where to send each role after login
function _portalFor(role) {
    switch (role) {
        case 'Hospital': return '/hospital-portal';
        case 'Donor': return '/donor-portal';    // Person 1 will build this
        default: return '/dashboard';        // Super Admin, Staff
    }
}

export default router;
