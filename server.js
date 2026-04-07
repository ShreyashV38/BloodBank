import 'dotenv/config';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Database ─────────────────────────────────────────────────
import db from './config/db.js';

// ── Security Middleware ──────────────────────────────────────
import {
    helmetMiddleware, generalLimiter, sanitizeBody, requireRole,
    doubleCsrfProtection, generateToken
} from './middleware/security.js';

// ── Route Imports ────────────────────────────────────────────
import donorsRouter from './routes/donors.js';
import inventoryRouter from './routes/inventory.js';
import hospitalsRouter from './routes/hospitals.js';
import donationsRouter from './routes/donations.js';
import requestsRouter from './routes/requests.js';
import reportsRouter from './routes/reports.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import hospitalPortalRouter from './routes/hospital-portal.js';
import donorPortalRouter from './routes/donor-portal.js';
import ngoPortalRouter from './routes/ngo-portal.js';
import campsRouter from './routes/camps.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── Trust Proxy (for production behind reverse proxy) ────────
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// ── Environment Integrity Check ──────────────────────────────
if (process.env.NODE_ENV === 'production') {
    const requiredEnv = ['SESSION_SECRET', 'DB_PASSWORD'];
    for (const envVar of requiredEnv) {
        if (!process.env[envVar]) {
            console.error(`🚨 FATAL ERROR: Missing ${envVar} in production environment.`);
            process.exit(1);
        }
    }
}

// ── Security Headers ─────────────────────────────────────────
app.use(helmetMiddleware);

// ── View Engine ──────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// ── Middleware ───────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// ── Prevent Browser Caching for Sensitive Routes ─────────────
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '-1');
    next();
});

// ── Rate Limiter (general) ───────────────────────────────────
app.use(generalLimiter);

// ── Input Sanitization ───────────────────────────────────────
app.use(sanitizeBody);

// ── Session (hardened) ───────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
    console.error('FATAL ERROR: SESSION_SECRET environment variable is missing.');
    process.exit(1);
}

app.use(session({
    secret: sessionSecret || 'bloodbank_goa_secret_CHANGE_ME_DEV_ONLY',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000,   // 8 hours
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    },
    name: 'bbsid'
}));

// ── CSRF Protection (after cookie-parser + session) ──────────
app.use(doubleCsrfProtection);

// Expose CSRF token to all EJS views
app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req, res);
    next();
});

// ── Auth Guard ───────────────────────────────────────────────
const PUBLIC_PATHS = ['/login', '/logout', '/signup', '/forgot-password',
    '/verify-login-otp', '/verify-signup-otp', '/verify-reset-otp',
    '/reset-password', '/resend-otp'];

app.use((req, res, next) => {
    if (PUBLIC_PATHS.includes(req.path)) return next();
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/images/')) return next();

    if (!req.session.userId) return res.redirect('/login');

    // Expose user info to all views
    res.locals.admin = {
        fullName: req.session.fullName,
        role: req.session.role,
        userId: req.session.userId
    };

    // Role-based route protection
    const role = req.session.role;
    const reqPath = req.path;

    if (role === 'Super Admin' || role === 'Staff') {
        if (reqPath.startsWith('/hospital-portal') || reqPath.startsWith('/donor-portal') || reqPath.startsWith('/ngo-portal')) {
            return res.redirect('/dashboard');
        }
        return next();
    }

    // Allow authenticated users to change their password or edit their profile
    if (reqPath === '/change-password' || reqPath.startsWith('/profile')) return next();

    if (role === 'Hospital' && (reqPath.startsWith('/hospital-portal') || reqPath === '/logout')) return next();
    if (role === 'Donor' && (reqPath.startsWith('/donor-portal') || reqPath === '/logout')) return next();
    if (role === 'NGO' && (reqPath.startsWith('/ngo-portal') || reqPath === '/logout')) return next();

    res.status(403).render('auth/login', {
        title: 'Access Denied',
        error: 'You do not have permission to access this page.',
        success: null, layout: false
    });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/', authRouter);
app.use('/profile', profileRouter);
app.use('/donors', donorsRouter);
app.use('/inventory', inventoryRouter);
app.use('/hospitals', hospitalsRouter);
app.use('/donations', donationsRouter);
app.use('/requests', requestsRouter);
app.use('/reports', reportsRouter);
app.use('/camps', campsRouter);
app.use('/hospital-portal', hospitalPortalRouter);
app.use('/donor-portal', donorPortalRouter);
app.use('/ngo-portal', ngoPortalRouter);
app.use('/admin', adminRouter);

// ── Dashboard (admin/staff) ─────────────────────────────────
app.get('/dashboard', async (req, res) => {
    try {
        const [bloodStock] = await db.query('SELECT * FROM vw_blood_stock');
        const [[donorCount]] = await db.query('SELECT COUNT(*) as total FROM donor');
        const [[pendingCount]] = await db.query("SELECT COUNT(*) as total FROM blood_request WHERE status='Pending'");
        const [[hospCount]] = await db.query('SELECT COUNT(*) as total FROM hospital');
        const [[campCount]] = await db.query("SELECT COUNT(*) as total FROM donation_camp WHERE status IN ('Upcoming','Ongoing')");

        // Recent activity for feed
        const [recentActivity] = await db.query(`
            (SELECT 'donation' AS type, CONCAT(d.first_name, ' ', d.last_name) AS actor,
                    CONCAT(don.units_donated, ' units of ', bg.group_name) AS detail,
                    don.donation_date AS date
             FROM donation don
             JOIN donor d ON don.donor_id = d.donor_id
             JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
             ORDER BY don.donation_date DESC LIMIT 3)
            UNION ALL
            (SELECT 'request' AS type, h.name AS actor,
                    CONCAT(br.units_required, ' units ', bg.group_name, ' — ', br.status) AS detail,
                    br.request_date AS date
             FROM blood_request br
             JOIN hospital h ON br.hospital_id = h.hospital_id
             JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
             ORDER BY br.request_date DESC LIMIT 3)
            ORDER BY date DESC LIMIT 5
        `);

        res.render('dashboard', {
            title: 'Dashboard',
            bloodStock,
            totalDonors: donorCount.total,
            pendingRequests: pendingCount.total,
            totalHospitals: hospCount.total,
            activeCamps: campCount.total,
            recentActivity
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { title: 'Error', code: 500, message: 'Dashboard failed to load.' });
    }
});

app.get('/', (req, res) => res.redirect('/dashboard'));

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 — Page Not Found',
        code: 404,
        message: 'The page you are looking for does not exist.',
        layout: req.session?.userId ? 'layout' : false
    });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    // CSRF token errors
    if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf')) {
        return res.status(403).render('error', {
            title: 'Session Expired',
            code: 403,
            message: 'Your session has expired or the form token is invalid. Please go back and try again.',
            layout: req.session?.userId ? 'layout' : false
        });
    }

    console.error('Unhandled error:', err);
    res.status(500).render('error', {
        title: 'Server Error',
        code: 500,
        message: 'Something went wrong. Please try again.',
        layout: req.session?.userId ? 'layout' : false
    });
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('🩸 ═══════════════════════════════════════════');
    console.log(`🩸  Goa Blood Bank System v3.0`);
    console.log(`🩸  Running at http://localhost:${PORT}`);
    console.log('🩸  Security: Helmet ✓ | Rate Limit ✓ | CSRF ✓ | Sanitize ✓');
    console.log('🩸 ═══════════════════════════════════════════');
    console.log('');
});
