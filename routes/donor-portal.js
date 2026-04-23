// ============================================================
// routes/donor-portal.js — Full Donor Portal Implementation
// Security hardened: sanitization, param validation
// ============================================================
import express from 'express';
import { mdToPdf } from 'md-to-pdf';
import pool from '../config/db.js';
import { sanitizeBody, validateParamId } from '../middleware/security.js';

const router = express.Router();

function requireDonor(req, res, next) {
    if (!req.session.userId || req.session.role !== 'Donor') {
        return res.redirect('/login');
    }
    next();
}

// GET /donor-portal — donor dashboard
router.get('/', requireDonor, async (req, res) => {
    try {
        const [donors] = await pool.query(
            `SELECT d.*, bg.group_name FROM donor d 
             JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id 
             WHERE d.user_id = ?`,
            [req.session.userId]
        );

        if (!donors.length) {
            return res.render('donor-portal/index', {
                title: 'Donor Portal', donor: null, donations: [], appointments: [],
                admin: { fullName: req.session.fullName, role: req.session.role },
                success: null, error: 'No donor profile linked to your account.',
                layout: false
            });
        }
        const donor = donors[0];

        // Donation history
        const [donations] = await pool.query(`
            SELECT don.*, bg.group_name 
            FROM donation don 
            JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
            WHERE don.donor_id = ?
            ORDER BY don.donation_date DESC
        `, [donor.donor_id]);

        // Appointments
        const [appointments] = await pool.query(`
            SELECT * FROM appointment WHERE donor_id = ? ORDER BY scheduled_date DESC
        `, [donor.donor_id]);

        // Calculate eligibility countdown
        let daysUntilEligible = 0;
        if (donor.last_donation_date) {
            const daysSince = Math.floor((Date.now() - new Date(donor.last_donation_date).getTime()) / (24 * 60 * 60 * 1000));
            daysUntilEligible = Math.max(0, 58 - daysSince);
        }

        res.render('donor-portal/index', {
            title: 'Donor Portal', donor, donations, appointments,
            daysUntilEligible,
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: req.query.success || null, error: req.query.error || null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET /donor-portal/book-appointment — booking form
router.get('/book-appointment', requireDonor, async (req, res) => {
    try {
        const [donors] = await pool.query('SELECT donor_id, is_eligible FROM donor WHERE user_id = ?', [req.session.userId]);
        if (!donors.length) return res.redirect('/donor-portal');
        
        // Fetch hospitals
        const [hospitals] = await pool.query('SELECT name FROM hospital ORDER BY name ASC');
        // Fetch upcoming camps
        const [camps] = await pool.query('SELECT name, location, camp_date FROM vw_upcoming_camps ORDER BY camp_date ASC');
        
        const locations = [];
        locations.push('GMC Blood Bank, Bambolim, Goa');
        hospitals.forEach(h => {
            if (!locations.includes(h.name)) locations.push(h.name);
        });
        camps.forEach(c => {
            const dateStr = new Date(c.camp_date).toLocaleDateString('en-GB');
            locations.push(`Camp: ${c.name} (${c.location}) - ${dateStr}`);
        });

        res.render('donor-portal/book-appointment', {
            title: 'Book Appointment',
            locations,
            donor: donors[0],
            admin: { fullName: req.session.fullName, role: req.session.role },
            success: null, error: null,
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.redirect('/donor-portal?error=' + encodeURIComponent('Failed to load booking form'));
    }
});

// POST /donor-portal/book-appointment — schedule a donation (validated)
router.post('/book-appointment', requireDonor, sanitizeBody, async (req, res) => {
    const { scheduled_date, time_slot, location, notes } = req.body;

    // ── Validation ───────────────────────────────────────────
    if (!scheduled_date || isNaN(Date.parse(scheduled_date))) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Invalid date.'));
    }
    if (new Date(scheduled_date) <= new Date()) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Appointment date must be in the future.'));
    }
    // Validate time slot if provided
    const validSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', ''];
    if (time_slot && !validSlots.includes(time_slot)) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Invalid time slot.'));
    }
    // Limit location/notes length
    if (location && location.length > 200) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Location too long (max 200 chars).'));
    }
    if (notes && notes.length > 500) {
        return res.redirect('/donor-portal?error=' + encodeURIComponent('Notes too long (max 500 chars).'));
    }

    try {
        const [donors] = await pool.query('SELECT donor_id, is_eligible FROM donor WHERE user_id = ?', [req.session.userId]);
        if (!donors.length) return res.redirect('/donor-portal');

        // Check if donor is eligible
        if (!donors[0].is_eligible) {
            return res.render('donor-portal/book-appointment', {
                title: 'Book Appointment', locations: [], donor: donors[0],
                admin: { fullName: req.session.fullName, role: req.session.role },
                success: null, error: 'You are currently not eligible to donate. Please wait until your cooldown period ends.',
                layout: false
            });
        }

        await pool.query(`
            INSERT INTO appointment (donor_id, scheduled_date, time_slot, location, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [donors[0].donor_id, scheduled_date, time_slot || null,
            location || 'GMC Blood Bank, Bambolim, Goa', notes || null]);

        res.redirect('/donor-portal?success=Appointment+booked+successfully');
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.redirect('/donor-portal?error=' + encodeURIComponent('You already have a scheduled appointment on this date.'));
        }
        res.redirect('/donor-portal?error=' + encodeURIComponent('Failed to book appointment.'));
    }
});

// POST /donor-portal/cancel-appointment/:id — cancel appointment (validated)
router.post('/cancel-appointment/:id', requireDonor, validateParamId(), async (req, res) => {
    try {
        const [donors] = await pool.query('SELECT donor_id FROM donor WHERE user_id = ?', [req.session.userId]);
        if (!donors.length) return res.redirect('/donor-portal');

        // Only cancel own appointments (donor ownership check built into WHERE)
        const [result] = await pool.query(
            "UPDATE appointment SET status = 'Cancelled' WHERE appointment_id = ? AND donor_id = ? AND status = 'Scheduled'",
            [req.params.id, donors[0].donor_id]
        );
        if (result.affectedRows === 0) {
            return res.redirect('/donor-portal?error=' + encodeURIComponent('Appointment not found or already processed.'));
        }
        res.redirect('/donor-portal?success=Appointment+cancelled');
    } catch (err) {
        console.error(err);
        res.redirect('/donor-portal');
    }
});

// GET /donor-portal/certificate/:id — Download PDF Certificate
router.get('/certificate/:id', requireDonor, validateParamId(), async (req, res) => {
    try {
        const [donors] = await pool.query('SELECT donor_id, first_name, last_name FROM donor WHERE user_id = ?', [req.session.userId]);
        if (!donors.length) return res.redirect('/donor-portal');
        
        const donor = donors[0];

        const [history] = await pool.query(`
            SELECT * FROM vw_donor_history 
            WHERE donor_id = ? AND status = 'Collected' AND donation_date = (
                SELECT donation_date FROM donation WHERE donation_id = ?
            )
        `, [donor.donor_id, req.params.id]);

        // Using direct donation query since vw_donor_history doesn't return donation_id
        const [donation] = await pool.query(`
            SELECT don.*, bg.group_name 
            FROM donation don
            JOIN blood_group bg ON don.blood_group_id = bg.blood_group_id
            WHERE don.donation_id = ? AND don.donor_id = ? AND don.status IN ('Collected', 'Tested', 'Approved')
        `, [req.params.id, donor.donor_id]);

        if (!donation.length) {
            return res.redirect('/donor-portal?error=' + encodeURIComponent('Certificate not found or not yet approved.'));
        }

        const d = donation[0];
        const dateStr = new Date(d.donation_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        const certNo  = `BSYNC-${String(d.donation_id).padStart(5, '0')}-${new Date().getFullYear()}`;

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: Georgia, 'Times New Roman', serif;
    background: #fff;
    width: 297mm;
    height: 210mm;
    overflow: hidden;
  }

  .page {
    width: 297mm;
    height: 210mm;
    position: relative;
    background: #fff;
    display: flex;
    flex-direction: column;
  }

  /* Top red accent band */
  .top-band {
    width: 100%;
    height: 14mm;
    background: linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #e53935 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.9);
    font-family: Arial, sans-serif;
    font-size: 9px;
    font-weight: 600;
  }

  .band-dot { width:5px; height:5px; border-radius:50%; background: rgba(255,255,255,0.6); }

  /* Bottom band */
  .bottom-band {
    width: 100%;
    height: 10mm;
    background: linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #e53935 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20mm;
    margin-top: auto;
  }

  .bottom-band span {
    font-family: Arial, sans-serif;
    font-size: 8px;
    color: rgba(255,255,255,0.75);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  /* Main content area */
  .content {
    flex: 1;
    display: flex;
    position: relative;
    overflow: hidden;
  }

  /* Left red sidebar */
  .sidebar {
    width: 18mm;
    background: linear-gradient(180deg, #c62828, #b71c1c);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10mm 0;
  }

  .sidebar-text {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-family: Arial, sans-serif;
    font-size: 7px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.7);
  }

  .sidebar-line {
    width: 1px;
    height: 30mm;
    background: rgba(255,255,255,0.25);
  }

  /* Watermark */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-40%, -50%) rotate(-20deg);
    font-family: Arial, sans-serif;
    font-size: 90px;
    font-weight: 900;
    color: rgba(198, 40, 40, 0.04);
    letter-spacing: -2px;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
  }

  /* SVG corner ornament */
  .corner {
    position: absolute;
    width: 28mm;
    height: 28mm;
    opacity: 0.12;
  }
  .corner.tl { top: 0; left: 18mm; }
  .corner.tr { top: 0; right: 0; transform: scaleX(-1); }
  .corner.bl { bottom: 10mm; left: 18mm; transform: scaleY(-1); }
  .corner.br { bottom: 10mm; right: 0; transform: scale(-1,-1); }

  /* Main body */
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8mm 16mm 6mm 12mm;
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    font-family: Arial, sans-serif;
    font-size: 8px;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: #c62828;
    font-weight: 600;
    margin-bottom: 5mm;
  }

  /* Decorative line with diamond */
  .deco-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5mm;
    width: 120mm;
  }
  .deco-line hr { flex:1; border:none; border-top: 1.5px solid #c62828; opacity:0.4; }
  .diamond {
    width: 7px; height: 7px;
    background: #c62828;
    transform: rotate(45deg);
  }

  .cert-title {
    font-family: Georgia, serif;
    font-size: 34px;
    font-weight: 700;
    color: #1a1a1a;
    text-align: center;
    line-height: 1.15;
    margin-bottom: 2mm;
  }

  .presented-to {
    font-family: Arial, sans-serif;
    font-size: 8px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 2mm;
  }

  .donor-name {
    font-family: Georgia, serif;
    font-size: 30px;
    font-weight: 700;
    color: #c62828;
    text-align: center;
    margin-bottom: 5mm;
    border-bottom: 1.5px solid rgba(198,40,40,0.2);
    padding-bottom: 3mm;
    width: 140mm;
    text-align: center;
  }

  .body-text {
    font-family: Arial, sans-serif;
    font-size: 10.5px;
    color: #555;
    text-align: center;
    line-height: 1.9;
    max-width: 140mm;
    margin-bottom: 6mm;
  }
  .body-text b { color: #1a1a1a; font-weight: 600; }

  /* Metadata pills */
  .meta-row {
    display: flex;
    gap: 8mm;
    margin-bottom: 6mm;
  }
  .meta-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    background: rgba(198,40,40,0.07);
    border: 1px solid rgba(198,40,40,0.2);
    border-radius: 8px;
    padding: 4px 14px;
  }
  .meta-pill .pill-label {
    font-family: Arial, sans-serif;
    font-size: 7px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #aaa;
  }
  .meta-pill .pill-value {
    font-family: Georgia, serif;
    font-size: 13px;
    font-weight: 700;
    color: #c62828;
  }

  /* Signature row */
  .sig-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    width: 100%;
    padding-top: 4mm;
    border-top: 1px solid #eee;
    margin-top: auto;
  }
  .sig-block { display:flex; flex-direction:column; align-items:center; gap:3px; }
  .sig-line { width:100px; height:1px; background:#555; }
  .sig-label { font-family:Arial,sans-serif; font-size:7px; letter-spacing:2px; text-transform:uppercase; color:#999; }
  .cert-no { font-family:Arial,sans-serif; font-size:7.5px; color:#ccc; letter-spacing:1.5px; text-transform:uppercase; }
</style>
</head>
<body>
<div class="page">

  <!-- Top Band -->
  <div class="top-band">
    <div class="band-dot"></div>
    BLOODSYNC — BLOOD BANK MANAGEMENT SYSTEM
    <div class="band-dot"></div>
  </div>

  <!-- Content area -->
  <div class="content">

    <!-- Left Sidebar -->
    <div class="sidebar">
      <div class="sidebar-line"></div>
      <div class="sidebar-text">Certificate of Appreciation</div>
      <div class="sidebar-line"></div>
    </div>

    <!-- Watermark -->
    <div class="watermark">BLOODSYNC</div>

    <!-- Corner ornaments (SVG) -->
    <svg class="corner tl" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L40,0 L40,5 L5,5 L5,40 L0,40 Z" fill="#c62828"/>
      <path d="M10,10 L30,10 L30,14 L14,14 L14,30 L10,30 Z" fill="#c62828"/>
      <circle cx="5" cy="5" r="3" fill="#c62828"/>
    </svg>
    <svg class="corner tr" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L40,0 L40,5 L5,5 L5,40 L0,40 Z" fill="#c62828"/>
      <path d="M10,10 L30,10 L30,14 L14,14 L14,30 L10,30 Z" fill="#c62828"/>
      <circle cx="5" cy="5" r="3" fill="#c62828"/>
    </svg>
    <svg class="corner bl" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L40,0 L40,5 L5,5 L5,40 L0,40 Z" fill="#c62828"/>
      <path d="M10,10 L30,10 L30,14 L14,14 L14,30 L10,30 Z" fill="#c62828"/>
      <circle cx="5" cy="5" r="3" fill="#c62828"/>
    </svg>
    <svg class="corner br" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L40,0 L40,5 L5,5 L5,40 L0,40 Z" fill="#c62828"/>
      <path d="M10,10 L30,10 L30,14 L14,14 L14,30 L10,30 Z" fill="#c62828"/>
      <circle cx="5" cy="5" r="3" fill="#c62828"/>
    </svg>

    <!-- Main Body -->
    <div class="body">
      <div class="eyebrow">&#9670; Certificate of Appreciation &#9670;</div>

      <div class="deco-line">
        <hr/><div class="diamond"></div><hr/>
      </div>

      <div class="cert-title">Blood Donation<br>Certificate</div>

      <div class="presented-to">Proudly Presented To</div>

      <div class="donor-name">${donor.first_name} ${donor.last_name}</div>

      <!-- Metadata pills -->
      <div class="meta-row">
        <div class="meta-pill">
          <div class="pill-label">Blood Group</div>
          <div class="pill-value">${d.group_name}</div>
        </div>
        <div class="meta-pill">
          <div class="pill-label">Units Donated</div>
          <div class="pill-value">${d.units_donated} U</div>
        </div>
        <div class="meta-pill">
          <div class="pill-label">Date</div>
          <div class="pill-value">${dateStr}</div>
        </div>
      </div>

      <p class="body-text">
        In recognition of the selfless act of blood donation at
        <b>${d.donated_at_location || 'BloodSync Partner Centre'}</b>.
        Your contribution directly saves lives and strengthens our healthcare community.
      </p>

      <div class="sig-row">
        <div class="cert-no">CERT: ${certNo}</div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">BloodSync &mdash; Authorised Signatory</div>
        </div>
        <div class="cert-no">ISSUED: ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}).toUpperCase()}</div>
      </div>
    </div>
  </div>

  <!-- Bottom Band -->
  <div class="bottom-band">
    <span>www.bloodsync.org</span>
    <span>&#9670; Saving Lives Together &#9670;</span>
    <span>Goa, India</span>
  </div>

</div>
</body>
</html>`;



        const pdf = await mdToPdf(
            { content: html.replace(/^\s+/gm, '') },
            { pdf_options: { format: 'A4', landscape: true, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }, printBackground: true } }
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="BloodSync_Certificate_${certNo}.pdf"`);
        res.send(Buffer.from(pdf.content));

    } catch (err) {
        console.error(err);
        res.redirect('/donor-portal?error=' + encodeURIComponent('Failed to generate certificate.'));
    }
});

export default router;
