// ============================================================
// routes/reports.js — Analytics & Reports  [PERSON 2]
// ============================================================
import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// GET /reports — dashboard with charts & analytics
router.get('/', async (req, res) => {
    try {
        const [bloodStock] = await db.query('SELECT * FROM vw_blood_stock');

        const [donationStats] = await db.query(`
            SELECT bg.group_name, COUNT(don.donation_id) AS total_donations, SUM(don.units_donated) AS total_units
            FROM blood_group bg
            LEFT JOIN donation don ON bg.blood_group_id = don.blood_group_id AND don.status = 'Approved'
            GROUP BY bg.blood_group_id, bg.group_name
        `);

        const [requestStats] = await db.query(`
            SELECT
                status,
                COUNT(*) AS count
            FROM blood_request
            GROUP BY status
        `);

        const [topHospitals] = await db.query(`
            SELECT h.name, COUNT(br.request_id) AS total_requests,
                   SUM(CASE WHEN br.status='Fulfilled' THEN 1 ELSE 0 END) AS fulfilled
            FROM hospital h
            LEFT JOIN blood_request br ON h.hospital_id = br.hospital_id
            GROUP BY h.hospital_id, h.name
            ORDER BY total_requests DESC
            LIMIT 5
        `);

        // Summary totals
        const [[totalDonationsRow]] = await db.query(
            `SELECT COUNT(*) AS total FROM donation WHERE status = 'Approved'`
        );
        const [[totalRequestsRow]] = await db.query(
            `SELECT COUNT(*) AS total FROM blood_request`
        );
        const [[totalUnitsRow]] = await db.query(
            `SELECT COALESCE(SUM(units_donated), 0) AS total FROM donation WHERE status = 'Approved'`
        );
        const [[totalDonorsRow]] = await db.query(
            `SELECT COUNT(*) AS total FROM donor`
        );

        // Monthly donation trends (last 6 months)
        const [monthlyTrends] = await db.query(`
            SELECT 
                DATE_FORMAT(donation_date, '%b %Y') AS month_label,
                COUNT(*) AS donations,
                COALESCE(SUM(units_donated), 0) AS units
            FROM donation
            WHERE status = 'Approved'
              AND donation_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(donation_date, '%Y-%m'), DATE_FORMAT(donation_date, '%b %Y')
            ORDER BY MIN(donation_date) ASC
        `);

        res.render('reports/index', {
            title: 'Reports & Analytics',
            bloodStock,
            donationStats,
            requestStats,
            topHospitals,
            summary: {
                totalDonations: totalDonationsRow.total,
                totalRequests: totalRequestsRow.total,
                totalUnits: totalUnitsRow.total,
                totalDonors: totalDonorsRow.total
            },
            monthlyTrends
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error: ' + err.message);
    }
});

export default router;
