import 'dotenv/config';
import db from './config/db.js';

async function run() {
    try {
        console.log('Finding or creating Apollo Hospital...');
        let [hospitals] = await db.query("SELECT hospital_id FROM hospital WHERE name LIKE '%Apollo%' LIMIT 1");
        let hospitalId;
        
        if (hospitals.length === 0) {
            const [insertH] = await db.query("INSERT INTO hospital (name, phone, email, city) VALUES ('Apollo Hospital', '9999999991', 'apollo@example.com', 'Panaji')");
            hospitalId = insertH.insertId;
        } else {
            hospitalId = hospitals[0].hospital_id;
        }

        console.log('Finding a blood group...');
        const [[bg]] = await db.query("SELECT blood_group_id FROM blood_group LIMIT 1");
        const bgId = bg.blood_group_id;

        console.log('Injecting 5 units of blood into inventory to guarantee approval works...');
        const [invResult] = await db.query("INSERT INTO blood_inventory (blood_group_id, units_available, expiry_date) VALUES (?, 5.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY))", [bgId]);
        const inventoryId = invResult.insertId;

        console.log('Creating an already APPROVED dummy request for Apollo...');
        const [reqResult] = await db.query("INSERT INTO blood_request (hospital_id, blood_group_id, units_required, urgency, status, request_date) VALUES (?, ?, 2.50, 'Urgent', 'Approved', DATE_SUB(CURDATE(), INTERVAL 1 DAY))", [hospitalId, bgId]);
        const reqId = reqResult.insertId;

        // Fulfill it to make the history complete
        await db.query("INSERT INTO request_fulfillment (request_id, inventory_id, units_provided, fulfilled_by) VALUES (?, ?, 2.50, 1)", [reqId, inventoryId]);
        await db.query("INSERT INTO invoice (hospital_id, fulfillment_id, amount, status) VALUES (?, LAST_INSERT_ID(), 3750, 'Pending')", [hospitalId]);

        console.log('Creating a PENDING dummy request for Apollo so the user can test the button...');
        await db.query("INSERT INTO blood_request (hospital_id, blood_group_id, units_required, urgency, status, request_date) VALUES (?, ?, 3.00, 'Critical', 'Pending', CURDATE())", [hospitalId, bgId]);

        console.log('Dummy data inserted successfully!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
