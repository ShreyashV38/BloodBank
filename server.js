import 'dotenv/config';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Security Middleware ──────────────────────────────────────
import { helmetMiddleware, generalLimiter, sanitizeBody, requireRole } from './middleware/security.js';

// ── Route Imports ────────────────────────────────────────────
import donorsRouter from './routes/donors.js';
import inventoryRouter from './routes/inventory.js';
import hospitalsRouter from './routes/hospitals.js';
import donationsRouter from './routes/donations.js';
import requestsRouter from './routes/requests.js';
import reportsRouter from './routes/reports.js';
import authRouter from './routes/auth.js';
import hospitalPortalRouter from './routes/hospital-portal.js';
import donorPortalRouter from './routes/donor-portal.js';
import ngoPortalRouter from './routes/ngo-portal.js';
import campsRouter from './routes/camps.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

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

// ── Rate Limiter (general) ───────────────────────────────────
app.use(generalLimiter);

// ── Input Sanitization ───────────────────────────────────────
app.use(sanitizeBody);

// ── Session (hardened) ───────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || 'bloodbank_goa_secret_CHANGE_ME',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000,   // 8 hours
        httpOnly: true,                 // Prevent XSS access to cookie
        sameSite: 'lax',                // CSRF protection
        secure: process.env.NODE_ENV === 'production'  // HTTPS only in production
    },
    name: 'bbsid'  // Custom session cookie name (hides framework)
}));

// ── Auth Guard ───────────────────────────────────────────────
const PUBLIC_PATHS = ['/login', '/logout', '/signup', '/forgot-password',
    '/verify-login-otp', '/verify-signup-otp', '/verify-reset-otp',
    '/reset-password', '/resend-otp'];

app.use((req, res, next) => {
    if (PUBLIC_PATHS.includes(req.path)) return next();
    // Static files
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

    // Hospital users can ONLY access their portal
    if (role === 'Hospital' && !reqPath.startsWith('/hospital-portal') && reqPath !== '/logout') {
        return res.redirect('/hospital-portal');
    }
    // Donor users can ONLY access their portal
    if (role === 'Donor' && !reqPath.startsWith('/donor-portal') && reqPath !== '/logout') {
        return res.redirect('/donor-portal');
    }
    // NGO users can ONLY access their portal and camps
    if (role === 'NGO' && !reqPath.startsWith('/ngo-portal') && reqPath !== '/logout') {
        return res.redirect('/ngo-portal');
    }

    next();
});

// ── Routes ───────────────────────────────────────────────────
app.use('/', authRouter);
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
        const db = (await import('./config/db.js')).default;
        const [bloodStock] = await db.query('SELECT * FROM vw_blood_stock');
        const [[donorCount]] = await db.query('SELECT COUNT(*) as total FROM donor');
        const [[pendingCount]] = await db.query("SELECT COUNT(*) as total FROM blood_request WHERE status='Pending'");
        const [[hospCount]] = await db.query('SELECT COUNT(*) as total FROM hospital');
        res.render('dashboard', {
            title: 'Dashboard',
            bloodStock,
            totalDonors: donorCount.total,
            pendingRequests: pendingCount.total,
            totalHospitals: hospCount.total,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/', (req, res) => res.redirect('/dashboard'));

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('auth/login', {
        title: '404',
        error: 'Page not found. Please log in.',
        success: null,
        layout: false
    });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('Something went wrong. Please try again.');
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('🩸 ═══════════════════════════════════════════');
    console.log(`🩸  Goa Blood Bank System v3.0`);
    console.log(`🩸  Running at http://localhost:${PORT}`);
    console.log('🩸  Security: Helmet ✓ | Rate Limit ✓ | Sanitize ✓');
    console.log('🩸 ═══════════════════════════════════════════');
    console.log('');
});
