// ============================================================
// routes/auth.js — Full Auth (Login + Signup + OTP + Forgot Password)
// Industry-grade with account lockout, OTP verification, RBAC
// ============================================================
import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { generateOTP, verifyOTP, getOTPTimeRemaining } from '../utils/otp.js';
import { loginLimiter, signupLimiter, otpLimiter } from '../middleware/security.js';
import {
    validateLogin, validateSignup, validateOTP,
    validateForgotPassword, validateResetPassword,
    validateDonorSignup, validateHospitalSignup, validateNGOSignup
} from '../middleware/validators.js';

const router = express.Router();
const SALT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

// ── GET /login ───────────────────────────────────────────────
router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect(_portalFor(req.session.role));
    res.render('auth/login', { title: 'Login', error: null, success: null, layout: false });
});

// ── POST /login — Step 1: Validate credentials, send OTP ────
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
    if (req.validationError) {
        return res.render('auth/login', { title: 'Login', error: req.validationError, success: null, layout: false });
    }

    const { username, password } = req.body;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM system_user WHERE username = ?',
            [username]
        );
        if (!rows.length) {
            return res.render('auth/login', { title: 'Login', error: 'Invalid username or password.', success: null, layout: false });
        }

        const user = rows[0];

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const minsLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return res.render('auth/login', {
                title: 'Login',
                error: `Account locked due to too many failed attempts. Try again in ${minsLeft} minute(s).`,
                success: null, layout: false
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.render('auth/login', { title: 'Login', error: 'Account has been deactivated. Contact admin.', success: null, layout: false });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            // Increment failed count
            const newCount = (user.failed_login_count || 0) + 1;
            const lockUntil = newCount >= MAX_FAILED_LOGINS
                ? new Date(Date.now() + LOCKOUT_MINUTES * 60000)
                : null;

            await pool.query(
                'UPDATE system_user SET failed_login_count = ?, locked_until = ? WHERE user_id = ?',
                [newCount, lockUntil, user.user_id]
            );

            const remaining = MAX_FAILED_LOGINS - newCount;
            const msg = remaining > 0
                ? `Invalid password. ${remaining} attempt(s) remaining before lockout.`
                : `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts.`;

            return res.render('auth/login', { title: 'Login', error: msg, success: null, layout: false });
        }

        // Credentials valid — send OTP
        const otpKey = `login:${user.user_id}`;
        try {
            generateOTP(otpKey);
        } catch (e) {
            return res.render('auth/login', { title: 'Login', error: e.message, success: null, layout: false });
        }

        // Store pending login in session
        req.session.pendingLogin = {
            userId: user.user_id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            email: user.email
        };

        res.render('auth/verify-otp', {
            title: 'Verify OTP',
            purpose: 'login',
            email: user.email || user.username,
            error: null,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.render('auth/login', { title: 'Login', error: 'Server error. Please try again.', success: null, layout: false });
    }
});

// ── POST /verify-login-otp — Step 2: Verify OTP, create session
router.post('/verify-login-otp', otpLimiter, validateOTP, async (req, res) => {
    const pending = req.session.pendingLogin;
    if (!pending) return res.redirect('/login');

    if (req.validationError) {
        const otpKey = `login:${pending.userId}`;
        return res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'login',
            email: pending.email || pending.username,
            error: req.validationError,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    }

    const otpKey = `login:${pending.userId}`;
    const result = verifyOTP(otpKey, req.body.otp);

    if (!result.valid) {
        return res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'login',
            email: pending.email || pending.username,
            error: result.error,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    }

    // OTP valid — create session
    req.session.userId = pending.userId;
    req.session.username = pending.username;
    req.session.fullName = pending.fullName;
    req.session.role = pending.role;
    delete req.session.pendingLogin;

    if (pending.role === 'Super Admin' || pending.role === 'Staff') {
        req.session.adminId = pending.userId;
    }

    // Reset failed login count
    await pool.query(
        'UPDATE system_user SET failed_login_count = 0, locked_until = NULL, last_login = NOW() WHERE user_id = ?',
        [pending.userId]
    );

    res.redirect(_portalFor(pending.role));
});

// ── GET /signup ──────────────────────────────────────────────
router.get('/signup', (req, res) => {
    if (req.session.userId) return res.redirect(_portalFor(req.session.role));
    res.render('auth/signup', {
        title: 'Sign Up', error: null, formData: {}, layout: false
    });
});

// ── POST /signup — Step 1: Validate + send OTP ───────────────
router.post('/signup', signupLimiter, validateSignup, async (req, res) => {
    if (req.validationError) {
        return res.render('auth/signup', {
            title: 'Sign Up', error: req.validationError, formData: req.body, layout: false
        });
    }

    const { username, email, password, role, full_name, phone } = req.body;

    try {
        // Check if username or email already exists
        const [existing] = await pool.query(
            'SELECT user_id FROM system_user WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length) {
            return res.render('auth/signup', {
                title: 'Sign Up', error: 'Username or email already registered.', formData: req.body, layout: false
            });
        }

        // Store signup data in session & send OTP
        const otpKey = `signup:${email}`;
        try {
            generateOTP(otpKey);
        } catch (e) {
            return res.render('auth/signup', {
                title: 'Sign Up', error: e.message, formData: req.body, layout: false
            });
        }

        req.session.pendingSignup = { ...req.body };

        res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'signup',
            email,
            error: null,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.render('auth/signup', {
            title: 'Sign Up', error: 'Server error. Please try again.', formData: req.body, layout: false
        });
    }
});

// ── POST /verify-signup-otp — Step 2: Create account ─────────
router.post('/verify-signup-otp', otpLimiter, validateOTP, async (req, res) => {
    const pending = req.session.pendingSignup;
    if (!pending) return res.redirect('/signup');

    if (req.validationError) {
        const otpKey = `signup:${pending.email}`;
        return res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'signup',
            email: pending.email,
            error: req.validationError,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    }

    const otpKey = `signup:${pending.email}`;
    const result = verifyOTP(otpKey, req.body.otp);

    if (!result.valid) {
        return res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'signup',
            email: pending.email,
            error: result.error,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    }

    // OTP valid — create the user account
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const hash = await bcrypt.hash(pending.password, SALT_ROUNDS);
        const [userResult] = await conn.query(
            `INSERT INTO system_user (username, password_hash, full_name, role, email, phone)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [pending.username, hash, pending.full_name, pending.role, pending.email, pending.phone]
        );
        const userId = userResult.insertId;

        // Create role-specific record
        if (pending.role === 'Donor') {
            await conn.query(
                `INSERT INTO donor (user_id, first_name, last_name, date_of_birth, gender, phone, email, address, blood_group_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, pending.first_name, pending.last_name, pending.date_of_birth,
                 pending.gender, pending.phone, pending.email, pending.address || null,
                 pending.blood_group_id]
            );
        } else if (pending.role === 'Hospital') {
            await conn.query(
                `INSERT INTO hospital (user_id, name, city, phone, email, contact_person, address)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, pending.hospital_name, pending.city, pending.phone,
                 pending.email, pending.full_name, pending.address || null]
            );
        } else if (pending.role === 'NGO') {
            await conn.query(
                `INSERT INTO ngo (user_id, name, registration_number, focus_area, phone, email, contact_person, city, address)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, pending.ngo_name, pending.registration_number, pending.focus_area,
                 pending.phone, pending.email, pending.full_name, pending.city || null, pending.address || null]
            );
        }

        await conn.commit();
        delete req.session.pendingSignup;

        res.render('auth/login', {
            title: 'Login',
            error: null,
            success: 'Account created successfully! Please log in.',
            layout: false
        });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.render('auth/signup', {
            title: 'Sign Up',
            error: 'Failed to create account: ' + (err.code === 'ER_DUP_ENTRY' ? 'Username, email, or phone already exists.' : 'Server error.'),
            formData: pending,
            layout: false
        });
    } finally {
        conn.release();
    }
});

// ── GET /forgot-password ─────────────────────────────────────
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', { title: 'Forgot Password', error: null, success: null, layout: false });
});

// ── POST /forgot-password — Send OTP to email ────────────────
router.post('/forgot-password', otpLimiter, validateForgotPassword, async (req, res) => {
    if (req.validationError) {
        return res.render('auth/forgot-password', {
            title: 'Forgot Password', error: req.validationError, success: null, layout: false
        });
    }

    const { email } = req.body;
    try {
        const [rows] = await pool.query('SELECT user_id, email, full_name FROM system_user WHERE email = ?', [email]);

        // Always show success (don't reveal if email exists)
        if (!rows.length) {
            return res.render('auth/forgot-password', {
                title: 'Forgot Password', error: null,
                success: 'If that email is registered, an OTP has been sent. Check the console.',
                layout: false
            });
        }

        const user = rows[0];
        const otpKey = `reset:${user.email}`;
        generateOTP(otpKey);

        req.session.pendingReset = { userId: user.user_id, email: user.email };

        res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'reset',
            email: user.email,
            error: null,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.render('auth/forgot-password', {
            title: 'Forgot Password', error: 'Server error.', success: null, layout: false
        });
    }
});

// ── POST /verify-reset-otp ───────────────────────────────────
router.post('/verify-reset-otp', otpLimiter, validateOTP, async (req, res) => {
    const pending = req.session.pendingReset;
    if (!pending) return res.redirect('/forgot-password');

    if (req.validationError) {
        const otpKey = `reset:${pending.email}`;
        return res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'reset',
            email: pending.email,
            error: req.validationError,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    }

    const otpKey = `reset:${pending.email}`;
    const result = verifyOTP(otpKey, req.body.otp);

    if (!result.valid) {
        return res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose: 'reset',
            email: pending.email,
            error: result.error,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    }

    // OTP valid — show reset password form
    req.session.resetVerified = true;
    res.render('auth/reset-password', {
        title: 'Reset Password', error: null, layout: false
    });
});

// ── POST /reset-password ─────────────────────────────────────
router.post('/reset-password', validateResetPassword, async (req, res) => {
    if (!req.session.pendingReset || !req.session.resetVerified) {
        return res.redirect('/forgot-password');
    }

    if (req.validationError) {
        return res.render('auth/reset-password', {
            title: 'Reset Password', error: req.validationError, layout: false
        });
    }

    try {
        const hash = await bcrypt.hash(req.body.new_password, SALT_ROUNDS);
        await pool.query(
            'UPDATE system_user SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE user_id = ?',
            [hash, req.session.pendingReset.userId]
        );

        delete req.session.pendingReset;
        delete req.session.resetVerified;

        res.render('auth/login', {
            title: 'Login', error: null,
            success: 'Password reset successfully! Please log in with your new password.',
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.render('auth/reset-password', {
            title: 'Reset Password', error: 'Failed to reset password. Please try again.', layout: false
        });
    }
});

// ── POST /resend-otp — Works for any purpose ─────────────────
router.post('/resend-otp', otpLimiter, (req, res) => {
    const { purpose } = req.body;
    let otpKey, email;

    if (purpose === 'login' && req.session.pendingLogin) {
        otpKey = `login:${req.session.pendingLogin.userId}`;
        email = req.session.pendingLogin.email || req.session.pendingLogin.username;
    } else if (purpose === 'signup' && req.session.pendingSignup) {
        otpKey = `signup:${req.session.pendingSignup.email}`;
        email = req.session.pendingSignup.email;
    } else if (purpose === 'reset' && req.session.pendingReset) {
        otpKey = `reset:${req.session.pendingReset.email}`;
        email = req.session.pendingReset.email;
    } else {
        return res.redirect('/login');
    }

    try {
        generateOTP(otpKey);
        res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose, email,
            error: null,
            timeRemaining: getOTPTimeRemaining(otpKey),
            layout: false
        });
    } catch (e) {
        res.render('auth/verify-otp', {
            title: 'Verify OTP', purpose, email,
            error: e.message,
            timeRemaining: 0,
            layout: false
        });
    }
});

// ── GET /logout ──────────────────────────────────────────────
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// ── Helper — portal redirect per role ────────────────────────
function _portalFor(role) {
    switch (role) {
        case 'Hospital': return '/hospital-portal';
        case 'Donor':    return '/donor-portal';
        case 'NGO':      return '/ngo-portal';
        default:         return '/dashboard';
    }
}

export default router;
