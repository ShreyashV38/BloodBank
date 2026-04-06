import express from 'express';
import db from '../config/db.js';
import { sanitizeBody } from '../middleware/security.js';
import { logAction, getClientIP } from '../utils/audit.js';
import bcrypt from 'bcrypt';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const userId = req.session.userId;
        const role = req.session.role;

        // Fetch core user details
        const [[user]] = await db.query(
            'SELECT username, full_name, email, role, created_at FROM system_user WHERE user_id = ?',
            [userId]
        );

        let entity = null;
        
        switch (role) {
            case 'Donor':
                const [[donor]] = await db.query('SELECT * FROM donor WHERE user_id = ?', [userId]);
                entity = donor;
                break;
            case 'Hospital':
                const [[hospital]] = await db.query('SELECT * FROM hospital WHERE user_id = ?', [userId]);
                entity = hospital;
                break;
            case 'NGO':
                const [[ngo]] = await db.query('SELECT * FROM ngo WHERE user_id = ?', [userId]);
                entity = ngo;
                break;
        }

        res.render('profile', {
            title: 'My Profile',
            layout: (role === 'Super Admin' || role === 'Staff') ? 'layout' : false,
            user,
            entity,
            role,
            success: req.query.success === 'true',
            error: req.query.error
        });
    } catch (err) {
        console.error('Profile load error:', err);
        res.status(500).render('error', {
            errorTitle: '500 Server Error',
            errorMsg: 'Could not load your profile.'
        });
    }
});

router.post('/update', sanitizeBody, async (req, res) => {
    let conn;
    try {
        const userId = req.session.userId;
        const role = req.session.role;
        
        const { full_name, email, phone, address, city, contact_person, username, gender, license_number, registration_id } = req.body;

        conn = await db.getConnection();
        await conn.beginTransaction();
        
        // Update core user
        await conn.query(
            'UPDATE system_user SET full_name = ?, email = ?, username = ? WHERE user_id = ?',
            [full_name, email, username, userId]
        );

        // Update entity details
        if (role === 'Donor') {
            await conn.query(
                'UPDATE donor SET phone = ?, address = ?, gender = ? WHERE user_id = ?',
                [phone, address, gender, userId]
            );
        } else if (role === 'Hospital') {
            await conn.query(
                'UPDATE hospital SET phone = ?, address = ?, city = ?, contact_person = ?, license_number = ? WHERE user_id = ?',
                [phone, address, city, contact_person, license_number, userId]
            );
        } else if (role === 'NGO') {
            await conn.query(
                'UPDATE ngo SET phone = ?, address = ?, city = ?, contact_person = ?, registration_id = ? WHERE user_id = ?',
                [phone, address, city, contact_person, registration_id, userId]
            );
        }

        await conn.commit();
        conn.release();

        // Update session username if they changed it
        req.session.username = username;

        // Log action
        await logAction(userId, 'PROFILE_UPDATE', 'USER', userId, 'User updated their profile details', getClientIP(req));

        res.redirect('/profile?success=true');
    } catch (err) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('Profile update error:', err);
        res.redirect('/profile?error=' + encodeURIComponent('Failed to update profile. Please ensure data is unique if adding new contact info.'));
    }
});

export default router;
