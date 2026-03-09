// ============================================================
// server.js — Goa Blood Bank System — Main Entry Point  v2.0
// ============================================================
import 'dotenv/config';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Route Imports ─────────────────────────────────────────────
import donorsRouter from './routes/donors.js';
import inventoryRouter from './routes/inventory.js';
import hospitalsRouter from './routes/hospitals.js';
import donationsRouter from './routes/donations.js';
import requestsRouter from './routes/requests.js';
import reportsRouter from './routes/reports.js';
import authRouter from './routes/auth.js';
import hospitalPortalRouter from './routes/hospital-portal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── View Engine ───────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// ── Middleware ────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'bloodbank_goa_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }   // 8 hours
}));

// ── Auth Guard ────────────────────────────────────────────────
// Public paths anyone can visit; everything else requires login.
const PUBLIC_PATHS = ['/login', '/logout'];

app.use((req, res, next) => {
    if (PUBLIC_PATHS.includes(req.path)) return next();
    if (!req.session.userId) return res.redirect('/login');

    // Expose user info to all views
    res.locals.admin = {
        fullName: req.session.fullName,
        role: req.session.role,
        userId: req.session.userId
    };

    // Role-based route protection
    const role = req.session.role;
    const path = req.path;

    // Hospital users can ONLY access their portal
    if (role === 'Hospital' && !path.startsWith('/hospital-portal') && path !== '/logout') {
        return res.redirect('/hospital-portal');
    }
    // Donor users can ONLY access their portal (Person 1 will build this)
    if (role === 'Donor' && !path.startsWith('/donor-portal') && path !== '/logout') {
        return res.redirect('/donor-portal');
    }

    next();
});

// ── Routes ────────────────────────────────────────────────────
app.use('/', authRouter);
app.use('/donors', donorsRouter);
app.use('/inventory', inventoryRouter);
app.use('/hospitals', hospitalsRouter);
app.use('/donations', donationsRouter);
app.use('/requests', requestsRouter);
app.use('/reports', reportsRouter);
app.use('/hospital-portal', hospitalPortalRouter);

// ── Dashboard (admin/staff) ───────────────────────────────────
app.get('/dashboard', async (req, res) => {
    try {
        const db = (await import('./config/db.js')).default;
        const [bloodStock] = await db.query('SELECT * FROM vw_blood_stock');
        const [[donorCount]] = await db.query('SELECT COUNT(*) as total FROM donor');
        const [[pendingCount]] = await db.query("SELECT COUNT(*) as total FROM blood_request WHERE status='Pending'");
        const [[hospCount]] = await db.query('SELECT COUNT(*) as total FROM hospital');
        const [expiring] = await db.query(
            "SELECT bg.group_name, bi.units_available, bi.expiry_date FROM blood_inventory bi JOIN blood_group bg ON bi.blood_group_id=bg.blood_group_id WHERE bi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) ORDER BY bi.expiry_date"
        );
        res.render('dashboard', {
            title: 'Dashboard',
            bloodStock,
            totalDonors: donorCount.total,
            pendingRequests: pendingCount.total,
            totalHospitals: hospCount.total,
            expiringStock: expiring
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

// Donor portal stub — Person 1 will implement this
app.get('/donor-portal', (req, res) => {
    res.render('donor-portal/index', {
        title: 'Donor Portal',
        admin: { fullName: req.session.fullName, role: req.session.role }
    });
});

app.get('/', (req, res) => res.redirect('/dashboard'));

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🩸 Goa Blood Bank running at http://localhost:${PORT}`));
