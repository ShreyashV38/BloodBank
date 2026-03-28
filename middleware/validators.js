// ============================================================
// middleware/validators.js — Express-Validator chains
// Centralised input validation for all routes
// ============================================================
import { body, param, validationResult } from 'express-validator';

// ── Helper: check for validation errors ─────────────────────
export function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Attach first error message to req for route handlers
        req.validationError = errors.array()[0].msg;
    }
    next();
}

// ── Login ────────────────────────────────────────────────────
export const validateLogin = [
    body('username')
        .trim().notEmpty().withMessage('Username is required.')
        .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters.')
        .matches(/^[a-zA-Z0-9._]+$/).withMessage('Username can only contain letters, numbers, dots, and underscores.'),
    body('password')
        .notEmpty().withMessage('Password is required.')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    handleValidationErrors
];

// ── Signup ───────────────────────────────────────────────────
export const validateSignup = [
    body('full_name')
        .trim().notEmpty().withMessage('Full name is required.')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters.')
        .matches(/^[a-zA-Z\s.]+$/).withMessage('Name can only contain letters, spaces, and periods.'),
    body('username')
        .trim().notEmpty().withMessage('Username is required.')
        .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters.')
        .matches(/^[a-zA-Z0-9._]+$/).withMessage('Username: letters, numbers, dots, underscores only.'),
    body('email')
        .trim().notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please enter a valid email address.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
        .matches(/[0-9]/).withMessage('Password must contain at least one digit.')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character.'),
    body('confirm_password')
        .notEmpty().withMessage('Please confirm your password.')
        .custom((val, { req }) => val === req.body.password).withMessage('Passwords do not match.'),
    body('role')
        .notEmpty().withMessage('Role is required.')
        .isIn(['Donor', 'Hospital', 'NGO']).withMessage('Invalid role selection.'),
    body('phone')
        .trim().notEmpty().withMessage('Phone number is required.')
        .matches(/^[6-9]\d{9}$/).withMessage('Please enter a valid 10-digit Indian mobile number.'),
    handleValidationErrors
];

// ── Donor-specific signup fields ─────────────────────────────
export const validateDonorSignup = [
    body('first_name').trim().notEmpty().withMessage('First name is required.'),
    body('last_name').trim().notEmpty().withMessage('Last name is required.'),
    body('date_of_birth')
        .notEmpty().withMessage('Date of birth is required.')
        .isDate().withMessage('Invalid date format.')
        .custom(val => {
            const age = Math.floor((Date.now() - new Date(val).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            if (age < 18) throw new Error('Donor must be at least 18 years old.');
            if (age > 65) throw new Error('Donor must be at most 65 years old.');
            return true;
        }),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender.'),
    body('blood_group_id').isInt({ min: 1, max: 8 }).withMessage('Please select a valid blood group.'),
    handleValidationErrors
];

// ── Hospital-specific signup fields ──────────────────────────
export const validateHospitalSignup = [
    body('hospital_name').trim().notEmpty().withMessage('Hospital name is required.'),
    body('city').trim().notEmpty().withMessage('City is required.'),
    handleValidationErrors
];

// ── NGO-specific signup fields ───────────────────────────────
export const validateNGOSignup = [
    body('ngo_name').trim().notEmpty().withMessage('NGO name is required.').isLength({ max: 150 }),
    body('registration_number').trim().notEmpty().withMessage('Registration number is required.'),
    body('focus_area').trim().notEmpty().withMessage('Focus area is required.'),
    handleValidationErrors
];

// ── OTP ──────────────────────────────────────────────────────
export const validateOTP = [
    body('otp')
        .trim().notEmpty().withMessage('OTP is required.')
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits.')
        .isNumeric().withMessage('OTP must contain only digits.'),
    handleValidationErrors
];

// ── Add Donor (admin route) ──────────────────────────────────
export const validateAddDonor = [
    body('first_name').trim().notEmpty().withMessage('First name is required.'),
    body('last_name').trim().notEmpty().withMessage('Last name is required.'),
    body('date_of_birth').isDate().withMessage('Invalid date.'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender.'),
    body('phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number.'),
    body('blood_group_id').isInt({ min: 1, max: 8 }).withMessage('Invalid blood group.'),
    handleValidationErrors
];

// ── Add Hospital (admin route) ───────────────────────────────
export const validateAddHospital = [
    body('name').trim().notEmpty().withMessage('Hospital name is required.'),
    body('phone').trim().notEmpty().withMessage('Phone is required.'),
    body('city').trim().notEmpty().withMessage('City is required.'),
    handleValidationErrors
];

// ── Record Donation ──────────────────────────────────────────
export const validateDonation = [
    body('donor_id').isInt({ min: 1 }).withMessage('Please select a valid donor.'),
    body('units_donated').isFloat({ min: 0.1, max: 2.0 }).withMessage('Units must be between 0.1 and 2.0.'),
    handleValidationErrors
];

// ── Blood Request ────────────────────────────────────────────
export const validateBloodRequest = [
    body('hospital_id').isInt({ min: 1 }).withMessage('Please select a hospital.'),
    body('blood_group_id').isInt({ min: 1, max: 8 }).withMessage('Please select a blood group.'),
    body('units_required').isFloat({ min: 0.5 }).withMessage('Units must be at least 0.5.'),
    body('urgency').isIn(['Normal', 'Urgent', 'Critical']).withMessage('Invalid urgency level.'),
    handleValidationErrors
];

// ── Camp ─────────────────────────────────────────────────────
export const validateCamp = [
    body('name').trim().notEmpty().withMessage('Camp name is required.'),
    body('organizer_type').isIn(['NGO', 'Hospital', 'Government', 'CSR', 'College']).withMessage('Invalid organizer type.'),
    body('organizer_name').trim().notEmpty().withMessage('Organizer name is required.'),
    body('location').trim().notEmpty().withMessage('Location is required.'),
    body('camp_date').isDate().withMessage('Valid camp date is required.'),
    handleValidationErrors
];

// ── Forgot Password ──────────────────────────────────────────
export const validateForgotPassword = [
    body('email')
        .trim().notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please enter a valid email address.'),
    handleValidationErrors
];

// ── Reset Password ───────────────────────────────────────────
export const validateResetPassword = [
    body('new_password')
        .notEmpty().withMessage('Password is required.')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
        .matches(/[0-9]/).withMessage('Password must contain at least one digit.')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character.'),
    body('confirm_password')
        .custom((val, { req }) => val === req.body.new_password).withMessage('Passwords do not match.'),
    handleValidationErrors
];

// ── Param ID validator ───────────────────────────────────────
export const validateId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid ID.'),
    handleValidationErrors
];
