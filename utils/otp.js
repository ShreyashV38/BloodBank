// ============================================================
// utils/otp.js — OTP Generation & Verification + Email Delivery
// ============================================================
import crypto from 'crypto';
import { sendOTPEmail } from './mailer.js';

// In-memory OTP store  { key: { code, expiresAt, attempts } }
const otpStore = new Map();

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of otpStore) {
        if (now > data.expiresAt) otpStore.delete(key);
    }
}, 5 * 60 * 1000);

/**
 * Generate a 6-digit OTP for a given key (email/phone/userId)
 * @param {string} key       — unique identifier (email, phone, etc.)
 * @param {string} email     — email address to send OTP to
 * @param {string} purpose   — 'login', 'signup', or 'reset'
 * @param {number} ttlMs     — time-to-live in ms (default 5 minutes)
 * @returns {{ code: string, expiresAt: number }}
 */
export function generateOTP(key, email = null, purpose = 'verification', ttlMs = 5 * 60 * 1000) {
    // Rate-limit: max 5 OTPs per key per 15 min window
    const existing = otpStore.get(key);
    if (existing && existing.rateCount >= 5 && Date.now() - existing.rateWindowStart < 15 * 60 * 1000) {
        throw new Error('Too many OTP requests. Please wait before retrying.');
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + ttlMs;

    otpStore.set(key, {
        code,
        expiresAt,
        attempts: 0,
        maxAttempts: 5,
        rateCount: (existing && Date.now() - (existing.rateWindowStart || 0) < 15 * 60 * 1000)
            ? (existing.rateCount || 0) + 1
            : 1,
        rateWindowStart: (existing && Date.now() - (existing.rateWindowStart || 0) < 15 * 60 * 1000)
            ? existing.rateWindowStart
            : Date.now()
    });

    // ── Console log (always, for dev convenience) ────────────
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       📱 OTP GENERATED                   ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  To:   ${key.padEnd(33)}║`);
    console.log(`║  Code: ${code.padEnd(33)}║`);
    console.log(`║  Expires in: ${Math.round(ttlMs / 60000)} minutes${' '.repeat(20)}║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    // ── Send via email (non-blocking) ────────────────────────
    if (email) {
        sendOTPEmail(email, code, purpose, Math.round(ttlMs / 60000))
            .then(sent => {
                if (sent) console.log(`📧 OTP emailed to ${email}`);
            })
            .catch(err => console.error('Email send error:', err.message));
    }

    return { code, expiresAt };
}

/**
 * Verify an OTP for a given key
 */
export function verifyOTP(key, code) {
    const data = otpStore.get(key);

    if (!data) {
        return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
    }

    if (Date.now() > data.expiresAt) {
        otpStore.delete(key);
        return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }

    if (data.attempts >= data.maxAttempts) {
        otpStore.delete(key);
        return { valid: false, error: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (data.code !== code.trim()) {
        data.attempts++;
        return { valid: false, error: `Invalid OTP. ${data.maxAttempts - data.attempts} attempts remaining.` };
    }

    // Success — remove OTP (one-time use)
    otpStore.delete(key);
    return { valid: true };
}

/**
 * Check if OTP exists and is still valid for a key
 */
export function hasActiveOTP(key) {
    const data = otpStore.get(key);
    if (!data) return false;
    if (Date.now() > data.expiresAt) {
        otpStore.delete(key);
        return false;
    }
    return true;
}

/**
 * Get remaining time in seconds for an active OTP
 */
export function getOTPTimeRemaining(key) {
    const data = otpStore.get(key);
    if (!data || Date.now() > data.expiresAt) return 0;
    return Math.ceil((data.expiresAt - Date.now()) / 1000);
}
