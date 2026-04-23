// ============================================================
// middleware/security.js — Security middleware bundle
// Helmet, Rate Limiting, CSRF, Input Sanitization
// ============================================================
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import sanitizeHtml from 'sanitize-html';
import { doubleCsrf } from 'csrf-csrf';

if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
    console.error('FATAL ERROR: CSRF_SECRET environment variable is missing.');
    process.exit(1);
}

const csrfSecret = process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'csrf_fallback_secret_change_in_development';

// ── Helmet — Security Headers ────────────────────────────────
export const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://checkout.razorpay.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
            frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"]
        }
    },
    crossOriginEmbedderPolicy: false
});

// ── CSRF Protection (Double-Submit Cookie) ───────────────────
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => csrfSecret,
    getSessionIdentifier: (req) => req.sessionID || 'no-session',
    cookieName: '__csrf_token',
    cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => req.body?._csrf || req.headers['x-csrf-token']
});

export { doubleCsrfProtection, generateCsrfToken };

// ── Rate Limiters ────────────────────────────────────────────
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                    // 10 attempts per window
    message: 'Too many login attempts. Please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).render('auth/login', {
            title: 'Login',
            error: 'Too many login attempts. Please try again after 15 minutes.',
            success: null,
            layout: false
        });
    }
});

export const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5,                     // 5 signup attempts per hour
    message: 'Too many signup attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

export const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many OTP requests. Please wait before retrying.',
    standardHeaders: true,
    legacyHeaders: false
});

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
});

// ── Input Sanitizer — strip dangerous HTML securely ──────────
export function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        // Skip CSRF tokens and password fields (passwords can contain <, >, & etc.)
        const skipFields = ['_csrf', 'password', 'confirm_password', 'current_password', 'new_password'];
        for (const key of Object.keys(req.body)) {
            if (skipFields.includes(key)) continue;
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeHtml(req.body[key], {
                    allowedTags: [],
                    allowedAttributes: {}
                }).trim();
            }
        }
    }
    next();
}

// ── Role Guard Factory ───────────────────────────────────────
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.userId) return res.redirect('/login');
        if (!roles.includes(req.session.role)) {
            return res.status(403).render('auth/login', {
                title: 'Access Denied',
                error: 'You do not have permission to access this resource.',
                success: null,
                layout: false
            });
        }
        next();
    };
}

// ── Param Validator — ensures route :id is a positive integer ─
export function validateParamId(paramName = 'id') {
    return (req, res, next) => {
        const val = req.params[paramName];
        if (!val || !/^\d+$/.test(val) || parseInt(val) < 1) {
            return res.status(400).send('Invalid parameter: ' + paramName);
        }
        req.params[paramName] = parseInt(val);
        next();
    };
}
