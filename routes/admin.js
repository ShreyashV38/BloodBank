// ============================================================
// routes/admin.js — Super Admin: User Management + Audit Log
// ============================================================
import express from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import db from '../config/db.js';
import { requireRole, sanitizeBody, validateParamId } from '../middleware/security.js';
import { logAction, getClientIP } from '../utils/audit.js';
import { exec } from 'child_process';

// ── Backup Rate Limiter — max 2 per hour ─────────────────────
const backupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2,
    message: 'Too many backup requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const router = express.Router();

// All routes require Super Admin
router.use(requireRole('Super Admin'));

// GET /admin/users — list all system users
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT su.user_id, su.username, su.full_name, su.email, su.phone, su.role,
                   su.is_active, su.created_at, su.failed_login_count, su.locked_until,
                   d.donor_id, h.hospital_id, n.ngo_id
            FROM system_user su
            LEFT JOIN donor d ON su.user_id = d.user_id
            LEFT JOIN hospital h ON su.user_id = h.user_id
            LEFT JOIN ngo n ON su.user_id = n.user_id
            ORDER BY su.created_at DESC
        `);
        res.render('admin/users', {
            title: 'User Management', users,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST /admin/users/toggle/:id — activate/deactivate user
router.post('/users/toggle/:id', validateParamId(), async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.session.userId) {
            return res.redirect('/admin/users?error=' + encodeURIComponent('Cannot deactivate your own account.'));
        }
        const [[user]] = await db.query('SELECT is_active, username FROM system_user WHERE user_id = ?', [req.params.id]);
        if (!user) return res.redirect('/admin/users');

        await db.query('UPDATE system_user SET is_active = ? WHERE user_id = ?', [!user.is_active, req.params.id]);
        await logAction(req.session.userId, user.is_active ? 'USER_DEACTIVATED' : 'USER_ACTIVATED',
            'system_user', req.params.id, `User: ${user.username}`, getClientIP(req));

        res.redirect('/admin/users?success=User+status+updated');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users?error=' + encodeURIComponent('Failed to update user.'));
    }
});

// POST /admin/users/unlock/:id
router.post('/users/unlock/:id', validateParamId(), async (req, res) => {
    try {
        await db.query(
            'UPDATE system_user SET failed_login_count = 0, locked_until = NULL WHERE user_id = ?',
            [req.params.id]
        );
        await logAction(req.session.userId, 'USER_UNLOCKED', 'system_user', req.params.id, null, getClientIP(req));
        res.redirect('/admin/users?success=Account+unlocked');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users');
    }
});

// POST /admin/users/reset-password/:id
router.post('/users/reset-password/:id', validateParamId(), sanitizeBody, async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
        return res.redirect('/admin/users?error=' + encodeURIComponent('Password must be at least 8 characters.'));
    }
    try {
        const hash = await bcrypt.hash(new_password, 12);
        await db.query('UPDATE system_user SET password_hash = ? WHERE user_id = ?', [hash, req.params.id]);
        await logAction(req.session.userId, 'ADMIN_PASSWORD_RESET', 'system_user', req.params.id, null, getClientIP(req));
        res.redirect('/admin/users?success=Password+reset+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users?error=' + encodeURIComponent('Failed to reset password.'));
    }
});

// POST /admin/users/change-role/:id
router.post('/users/change-role/:id', validateParamId(), sanitizeBody, async (req, res) => {
    const { role } = req.body;
    const validRoles = ['Super Admin', 'Staff', 'Donor', 'Hospital', 'NGO'];
    if (!validRoles.includes(role)) {
        return res.redirect('/admin/users?error=' + encodeURIComponent('Invalid role.'));
    }
    if (parseInt(req.params.id) === req.session.userId) {
        return res.redirect('/admin/users?error=' + encodeURIComponent('Cannot change your own role.'));
    }
    try {
        await db.query('UPDATE system_user SET role = ? WHERE user_id = ?', [role, req.params.id]);
        await logAction(req.session.userId, 'ROLE_CHANGE', 'system_user', req.params.id, `New role: ${role}`, getClientIP(req));
        res.redirect('/admin/users?success=Role+updated+to+' + encodeURIComponent(role));
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users?error=' + encodeURIComponent('Failed to change role.'));
    }
});

// GET /admin/audit — system audit log (from audit_log table + fallback)
router.get('/audit', async (req, res) => {
    try {
        // Try audit_log table first
        let auditLogs = [];
        try {
            const [logs] = await db.query(`
                SELECT al.*, su.username, su.full_name
                FROM audit_log al
                LEFT JOIN system_user su ON al.user_id = su.user_id
                ORDER BY al.created_at DESC LIMIT 50
            `);
            auditLogs = logs;
        } catch {
            // Table may not exist yet — fallback to old method
        }

        const [recentDonations] = await db.query(`
            SELECT 'Donation' AS type, don.donation_date AS date,
                   CONCAT(d.first_name, ' ', d.last_name) AS actor, don.status AS detail
            FROM donation don JOIN donor d ON don.donor_id = d.donor_id
            ORDER BY don.donation_date DESC LIMIT 10
        `);
        const [recentRequests] = await db.query(`
            SELECT 'Request' AS type, br.request_date AS date,
                   h.name AS actor, CONCAT(bg.group_name, ' - ', br.status) AS detail
            FROM blood_request br
            JOIN hospital h ON br.hospital_id = h.hospital_id
            JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
            ORDER BY br.request_date DESC LIMIT 10
        `);
        const [recentLogins] = await db.query(`
            SELECT user_id, username, full_name, role, 
                   failed_login_count, locked_until
            FROM system_user WHERE failed_login_count > 0
            ORDER BY failed_login_count DESC
        `);

        res.render('admin/audit', {
            title: 'System Audit',
            auditLogs, recentDonations, recentRequests, recentLogins
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET /admin/backup — DB Backup for Super Admin
router.get('/backup', backupLimiter, async (req, res) => {
    try {
        const filename = `blood_bank_backup_${Date.now()}.sql`;
        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const pass = process.env.DB_PASSWORD || '';
        const dbName = process.env.DB_NAME || 'blood_bank_db';

        const command = `mysqldump -h ${host} -u ${user} ${pass ? `-p${pass}` : ''} ${dbName}`;

        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        const child = exec(command);
        
        child.stdout.pipe(res);
        
        child.stderr.on('data', data => {
            // Log real errors via stdout, ignore mysqldump warnings for using password in CLI
            if (!data.includes('Using a password')) {
                console.error('Backup stderr:', data);
            }
        });

        child.on('close', async (code) => {
            if (code === 0) {
                await logAction(req.session.userId, 'DB_BACKUP_GENERATED', 'SYSTEM', null, 'Super Admin downloaded DB backup', getClientIP(req));
            }
        });

    } catch (err) {
        console.error('Backup error:', err);
        res.status(500).send('Unable to generate database backup');
    }
});

export default router;
