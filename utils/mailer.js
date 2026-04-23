// ============================================================
// utils/mailer.js — Nodemailer Email Delivery
// Graceful fallback to console if not configured
// ============================================================
import nodemailer from 'nodemailer';

let transporter = null;
const isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

if (isConfigured) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Verify connection on startup
    transporter.verify().then(() => {
        console.log('📧 Email transport ready (Gmail)');
    }).catch(err => {
        console.warn('⚠️  Email transport failed to verify:', err.message);
        console.warn('   OTPs will be logged to console instead.');
        transporter = null;
    });
} else {
    console.log('📧 Email not configured — OTPs will appear in console only.');
}

/**
 * Send an email. Falls back to console if transport unavailable.
 * @param {string} to      — recipient email
 * @param {string} subject — email subject
 * @param {string} html    — HTML body
 * @returns {Promise<boolean>} true if sent, false if fallback
 */
export async function sendEmail(to, subject, html) {
    if (!transporter) {
        console.log(`📧 [CONSOLE FALLBACK] To: ${to} | Subject: ${subject}`);
        return false;
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to,
            subject,
            html
        });
        return true;
    } catch (err) {
        console.error('📧 Email send failed:', err.message);
        return false;
    }
}

/**
 * Send a styled OTP email
 */
export async function sendOTPEmail(to, code, purpose = 'verification', ttlMinutes = 5) {
    const purposeText = {
        login: 'Login Verification',
        signup: 'Account Verification',
        reset: 'Password Reset'
    }[purpose] || 'Verification';

    const html = `
    <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#0d0d0d;border-radius:16px;overflow:hidden;border:1px solid #2d2d2d;">
        <div style="background:linear-gradient(135deg,#7f0000,#b71c1c);padding:32px 24px;text-align:center;">
            <div style="font-size:42px;margin-bottom:8px;">🩸</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">BloodSync</h1>
            <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">State of Goa — Official Portal</p>
        </div>
        <div style="padding:32px 24px;text-align:center;">
            <h2 style="color:#f5f5f5;margin:0 0 8px;font-size:18px;">${purposeText}</h2>
            <p style="color:#9e9e9e;font-size:14px;margin:0 0 24px;">Use this code to complete your ${purpose}. It expires in ${ttlMinutes} minutes.</p>
            <div style="background:#1a1a1a;border:2px solid #b71c1c;border-radius:12px;padding:20px;margin:0 auto;display:inline-block;">
                <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#ef5350;font-family:monospace;">${code}</span>
            </div>
            <p style="color:#616161;font-size:12px;margin:24px 0 0;">If you did not request this code, please ignore this email.</p>
        </div>
        <div style="background:#111;padding:16px 24px;text-align:center;border-top:1px solid #2d2d2d;">
            <p style="color:#616161;font-size:11px;margin:0;">© 2026 BloodSync — Secure OTP Delivery</p>
        </div>
    </div>`;

    return sendEmail(to, `${code} — Your ${purposeText} Code | BloodSync`, html);
}

/**
 * Send a blood request notification email
 */
export async function sendRequestNotification(to, hospitalName, details) {
    const { action, bloodGroup, units, urgency, purpose } = details;

    const actionColors = {
        created: '#FF9800',
        approved: '#4CAF50',
        fulfilled: '#4CAF50',
        rejected: '#F44336'
    };

    const color = actionColors[action] || '#2196F3';
    const actionText = action.charAt(0).toUpperCase() + action.slice(1);

    const html = `
    <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#0d0d0d;border-radius:16px;overflow:hidden;border:1px solid #2d2d2d;">
        <div style="background:linear-gradient(135deg,#7f0000,#b71c1c);padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;">🩸 Blood Request ${actionText}</h1>
        </div>
        <div style="padding:24px;">
            <p style="color:#b0b0b0;font-size:14px;margin:0 0 16px;">Dear <strong style="color:#f5f5f5;">${hospitalName}</strong>,</p>
            <div style="background:#1a1a1a;border-radius:10px;padding:16px;border-left:4px solid ${color};">
                <table style="width:100%;font-size:13px;color:#b0b0b0;">
                    <tr><td style="padding:4px 8px;">Status</td><td style="color:${color};font-weight:700;">${actionText}</td></tr>
                    ${bloodGroup ? `<tr><td style="padding:4px 8px;">Blood Group</td><td style="color:#ef5350;font-weight:600;">${bloodGroup}</td></tr>` : ''}
                    ${units ? `<tr><td style="padding:4px 8px;">Units</td><td style="color:#f5f5f5;">${units}</td></tr>` : ''}
                    ${urgency ? `<tr><td style="padding:4px 8px;">Urgency</td><td style="color:#f5f5f5;">${urgency}</td></tr>` : ''}
                    ${purpose ? `<tr><td style="padding:4px 8px;">Purpose</td><td style="color:#f5f5f5;">${purpose}</td></tr>` : ''}
                </table>
            </div>
            <p style="color:#616161;font-size:12px;margin:16px 0 0;">This is an automated notification from the BloodSync.</p>
        </div>
    </div>`;

    return sendEmail(to, `Blood Request ${actionText} — ${bloodGroup || ''} | BloodSync`, html);
}

export default { sendEmail, sendOTPEmail, sendRequestNotification };
