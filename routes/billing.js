// ============================================================
// routes/billing.js — Razorpay Payment Gateway Integration
// ============================================================
import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import pool from '../config/db.js';
import { sanitizeBody } from '../middleware/security.js';

const router = express.Router();

// ── Razorpay Instance ────────────────────────────────────────
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

let razorpay = null;
if (razorpayKeyId && razorpayKeySecret) {
    razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret
    });
}

// ── Auth Guard ───────────────────────────────────────────────
function requireHospital(req, res, next) {
    if (!req.session.userId || req.session.role !== 'Hospital') {
        return res.redirect('/login');
    }
    next();
}

// ── POST /billing/create-order ───────────────────────────────
// Creates a Razorpay order for a pending invoice
router.post('/create-order', requireHospital, sanitizeBody, async (req, res) => {
    try {
        if (!razorpay) {
            return res.status(503).json({
                error: 'Payment gateway is not configured. Please contact the administrator.'
            });
        }

        const { invoice_id } = req.body;
        if (!invoice_id || isNaN(invoice_id)) {
            return res.status(400).json({ error: 'Invalid invoice ID.' });
        }

        // Get hospital for logged-in user
        const [hospitals] = await pool.query(
            'SELECT hospital_id FROM hospital WHERE user_id = ?',
            [req.session.userId]
        );
        if (!hospitals.length) {
            return res.status(403).json({ error: 'No hospital linked to this account.' });
        }

        // Fetch invoice and validate ownership
        const [[invoice]] = await pool.query(
            'SELECT * FROM invoice WHERE invoice_id = ? AND hospital_id = ?',
            [parseInt(invoice_id), hospitals[0].hospital_id]
        );

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        if (invoice.status === 'Paid') {
            return res.status(400).json({ error: 'This invoice has already been paid.' });
        }

        // Create Razorpay order (amount in paise)
        const amountInPaise = Math.round(invoice.amount * 100);
        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `invoice_${invoice.invoice_id}`,
            notes: {
                invoice_id: invoice.invoice_id.toString(),
                hospital_id: invoice.hospital_id.toString()
            }
        });

        res.json({
            success: true,
            order_id: order.id,
            amount: amountInPaise,
            currency: 'INR',
            key: razorpayKeyId,
            invoice_id: invoice.invoice_id
        });
    } catch (err) {
        console.error('Create order error:', err);
        res.status(500).json({ error: 'Failed to create payment order.' });
    }
});

// ── POST /billing/verify-payment ─────────────────────────────
// Verifies Razorpay payment signature and updates invoice status
router.post('/verify-payment', requireHospital, sanitizeBody, async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            invoice_id
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoice_id) {
            return res.status(400).json({ error: 'Missing payment verification fields.' });
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', razorpayKeySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
        }

        // Get hospital for logged-in user
        const [hospitals] = await pool.query(
            'SELECT hospital_id FROM hospital WHERE user_id = ?',
            [req.session.userId]
        );
        if (!hospitals.length) {
            return res.status(403).json({ error: 'No hospital linked to this account.' });
        }

        // Validate invoice ownership
        const [[invoice]] = await pool.query(
            'SELECT * FROM invoice WHERE invoice_id = ? AND hospital_id = ?',
            [parseInt(invoice_id), hospitals[0].hospital_id]
        );

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }

        // Update invoice to Paid
        await pool.query(
            `UPDATE invoice SET status = 'Paid', payment_reference = ? WHERE invoice_id = ?`,
            [razorpay_payment_id, invoice.invoice_id]
        );

        res.json({
            success: true,
            message: 'Payment verified and invoice updated successfully.',
            payment_id: razorpay_payment_id
        });
    } catch (err) {
        console.error('Verify payment error:', err);
        res.status(500).json({ error: 'Payment verification failed.' });
    }
});

export default router;
