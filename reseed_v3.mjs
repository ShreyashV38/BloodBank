// ============================================================
// reseed_v3.mjs — Drop & Re-create blood_bank_db with all v3 tables
// Run: node reseed_v3.mjs
// ============================================================
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '4019',
    multipleStatements: true
});

console.log('🩸 Dropping and recreating blood_bank_db...');
await db.query('DROP DATABASE IF EXISTS blood_bank_db');

// Read and execute schema
const schema = readFileSync(join(__dirname, 'database', 'schema_v3.sql'), 'utf8');
// Split on DELIMITER and handle stored procedures separately
const parts = schema.split('DELIMITER');
for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('$$')) {
        // Stored procedure / trigger block
        const procedures = trimmed.replace(/^\$\$/, '').replace(/DELIMITER\s*;?\s*$/, '');
        const blocks = procedures.split('$$').filter(b => b.trim());
        for (const block of blocks) {
            const sql = block.trim();
            if (sql && !sql.startsWith(';')) {
                try { await db.query(sql); } catch(e) { console.warn('SP/Trigger warning:', e.message); }
            }
        }
    } else {
        // Regular SQL statements
        const sql = trimmed.replace(/DELIMITER\s*;?\s*$/, '');
        if (sql.trim()) {
            try { await db.query(sql); } catch(e) { console.warn('SQL warning:', e.message); }
        }
    }
}
console.log('✅ Schema created');

// Switch to the database
await db.changeUser({ database: 'blood_bank_db' });

const adminHash = await bcrypt.hash('admin123', 12);
const hospHash = await bcrypt.hash('hospital123', 12);
const donorHash = await bcrypt.hash('donor123', 12);
const ngoHash = await bcrypt.hash('ngo123', 12);

// system_user (including NGO users)
await db.query(`INSERT INTO system_user (username, password_hash, full_name, role, email, phone) VALUES
  ('superadmin',  ?, 'Super Admin',        'Super Admin', 'admin@goabloodbank.gov.in',     '9999900000'),
  ('staff1',      ?, 'Rajesh Naik',        'Staff',       'rajesh@goabloodbank.gov.in',    '9999900001'),
  ('gmc.admin',   ?, 'GMC Admin',          'Hospital',    'gmc.portal@goahealth.gov.in',   '9999900002'),
  ('manipal.goa', ?, 'Manipal Goa Admin',  'Hospital',    'portal@manipalgoa.com',         '9999900003'),
  ('apollo.goa',  ?, 'Apollo Victor',      'Hospital',    'portal@apollogoa.com',          '9999900004'),
  ('asilo.goa',   ?, 'Asilo Hospital',     'Hospital',    'portal@asilohospital.com',      '9999900005'),
  ('vasco.dh',    ?, 'Vasco District',     'Hospital',    'portal@vascodh.gov.in',         '9999900006'),
  ('rohan.naik',  ?, 'Rohan Naik',         'Donor',       'rohan.naik@mail.com',           '9999900007'),
  ('sneha.des',   ?, 'Sneha Dessai',       'Donor',       'sneha.dessai@mail.com',         '9999900008'),
  ('goa.redcross',?, 'Goa Red Cross',      'NGO',         'goaredcross@ngo.org',           '9999900009'),
  ('rotary.goa',  ?, 'Rotary Club Goa',    'NGO',         'rotarygoa@ngo.org',             '9999900010')`,
    [adminHash, adminHash, hospHash, hospHash, hospHash, hospHash, hospHash, donorHash, donorHash, ngoHash, ngoHash]);
console.log('✅ system_user inserted');

// blood_group
await db.query(`INSERT INTO blood_group (group_name) VALUES ('A+'),('A-'),('B+'),('B-'),('AB+'),('AB-'),('O+'),('O-')`);
console.log('✅ blood_group inserted');

// hospital (linked to system_user user_id 3-7)
await db.query(`INSERT INTO hospital (user_id, name, address, city, contact_person, phone, email) VALUES
  (3,'Goa Medical College & Hospital','Bambolim, NH-4A','Panaji','Dr. Rajesh Naik','8320000001','gmc@goahealth.gov.in'),
  (4,'Manipal Hospital Goa','Dona Paula, Panaji','Panaji','Dr. Sunita Bhat','8320000002','manipal@goahospital.com'),
  (5,'Apollo Victor Hospital','Swatantra Path, Margao','Margao','Dr. Priya Dessai','8320000003','apollo@goahospital.com'),
  (6,'Asilo Hospital','Hospital Road, Mapusa','Mapusa','Dr. Carlos Fonseca','8320000004','asilo@goahospital.com'),
  (7,'District Hospital Vasco','FL Gomes Road, Vasco da Gama','Vasco','Dr. Meena Gaonkar','8320000005','vasco@goahealth.gov.in')`);
console.log('✅ hospital inserted');

// ngo (linked to system_user user_id 10-11)
await db.query(`INSERT INTO ngo (user_id, name, registration_number, focus_area, city, contact_person, phone, email, is_verified, description) VALUES
  (10, 'Goa Red Cross Society', 'GDA/2024/001', 'Blood Donation', 'Panaji', 'Smt. Maria Fernandes', '8320000006', 'goaredcross@ngo.org', TRUE, 'Official Red Cross chapter for the State of Goa. Organizing blood donation drives since 1975.'),
  (11, 'Rotary Club of Goa',   'GDA/2024/002', 'Community Welfare', 'Margao', 'Mr. Sunil Shetty', '8320000007', 'rotarygoa@ngo.org', TRUE, 'Rotary International Goa chapter. Regular blood donation camps across North and South Goa.')`);
console.log('✅ ngo inserted');

// donor (first 2 linked to system_user 8-9)
await db.query(`INSERT INTO donor (user_id, first_name, last_name, date_of_birth, gender, phone, email, address, blood_group_id, is_eligible) VALUES
  (8,   'Rohan','Naik',     '1995-03-12','Male',  '8321111111','rohan.naik@mail.com','Alto Porvorim, Bardez, Goa',1,TRUE),
  (9,   'Sneha','Dessai',   '1998-07-22','Female','8321111112','sneha.dessai@mail.com','Fatorda, Margao, Goa',2,TRUE),
  (NULL,'Aditya','Kamat',   '1993-11-05','Male',  '8321111113','aditya.kamat@mail.com','Mapusa, Bardez, Goa',3,TRUE),
  (NULL,'Priya','Gaonkar',  '2000-01-18','Female','8321111114','priya.gaon@mail.com','Ponda, South Goa',4,TRUE),
  (NULL,'Vikram','Fonseca', '1997-06-30','Male',  '8321111115','vikram.f@mail.com','Calangute, North Goa',5,TRUE),
  (NULL,'Anjali','Borges',  '1999-09-14','Female','8321111116','anjali.b@mail.com','Vasco da Gama, South Goa',6,TRUE),
  (NULL,'Suresh','Shetty',  '1991-04-25','Male',  '8321111117','suresh.s@mail.com','Canacona, South Goa',7,TRUE),
  (NULL,'Meera','Sawant',   '1996-12-03','Female','8321111118','meera.saw@mail.com','Pernem, North Goa',8,TRUE),
  (NULL,'Carlos','Rodrigues','1994-08-17','Male', '8321111119','carlos.r@mail.com','Panaji, North Goa',1,TRUE),
  (NULL,'Divya','Parab',    '2001-02-28','Female','8321111120','divya.p@mail.com','Bicholim, North Goa',3,TRUE)`);
console.log('✅ donor inserted');

// blood_inventory
await db.query(`INSERT INTO blood_inventory (blood_group_id, units_available, expiry_date) VALUES
  (1,15,DATE_ADD(CURDATE(),INTERVAL 30 DAY)),(2,4,DATE_ADD(CURDATE(),INTERVAL 20 DAY)),
  (3,20,DATE_ADD(CURDATE(),INTERVAL 35 DAY)),(4,2,DATE_ADD(CURDATE(),INTERVAL 15 DAY)),
  (5,10,DATE_ADD(CURDATE(),INTERVAL 25 DAY)),(6,3,DATE_ADD(CURDATE(),INTERVAL 28 DAY)),
  (7,25,DATE_ADD(CURDATE(),INTERVAL 40 DAY)),(8,6,DATE_ADD(CURDATE(),INTERVAL 18 DAY))`);
console.log('✅ blood_inventory inserted');

// donations
await db.query(`INSERT INTO donation (donor_id, blood_group_id, donation_date, units_donated, donated_at_location, status) VALUES
  (1,1,DATE_SUB(CURDATE(),INTERVAL 120 DAY),1,'GMC Blood Bank, Bambolim, Goa','Approved'),
  (3,3,DATE_SUB(CURDATE(),INTERVAL 95 DAY), 1,'Rotary Camp, Mapusa, Goa','Approved'),
  (5,5,DATE_SUB(CURDATE(),INTERVAL 110 DAY),1,'Apollo Victor Drive, Margao, Goa','Approved'),
  (7,7,DATE_SUB(CURDATE(),INTERVAL 100 DAY),1,'NSS Camp, Ponda College, Goa','Approved'),
  (9,1,DATE_SUB(CURDATE(),INTERVAL 130 DAY),1,'Manipal Hospital Camp, Panaji, Goa','Approved'),
  (2,2,DATE_SUB(CURDATE(),INTERVAL 30 DAY), 1,'PHC Blood Bank, Fatorda, Goa','Collected'),
  (4,4,DATE_SUB(CURDATE(),INTERVAL 10 DAY), 1,'Community Camp, Ponda, Goa','Tested'),
  (6,6,DATE_SUB(CURDATE(),INTERVAL 5 DAY),  1,'District Hospital Camp, Vasco, Goa','Collected')`);
console.log('✅ donation inserted');

// appointments
await db.query(`INSERT INTO appointment (donor_id, scheduled_date, time_slot, status, location) VALUES
  (1,DATE_ADD(CURDATE(),INTERVAL 15 DAY),'09:00','Scheduled','GMC Blood Bank, Bambolim, Goa'),
  (2,DATE_ADD(CURDATE(),INTERVAL 7 DAY), '11:00','Scheduled','Manipal Hospital Camp, Panaji, Goa'),
  (3,DATE_SUB(CURDATE(),INTERVAL 5 DAY), '10:00','Completed','Rotary Camp, Mapusa, Goa')`);
console.log('✅ appointment inserted');

// blood_requests
await db.query(`INSERT INTO blood_request (hospital_id, blood_group_id, units_required, urgency, status, request_date, required_by_date, purpose) VALUES
  (1,7,5,'Urgent',  'Pending',  CURDATE(),DATE_ADD(CURDATE(),INTERVAL 2 DAY),'Emergency surgery'),
  (2,1,3,'Normal',  'Pending',  CURDATE(),DATE_ADD(CURDATE(),INTERVAL 7 DAY),'Scheduled operation'),
  (3,4,2,'Critical','Pending',  CURDATE(),DATE_ADD(CURDATE(),INTERVAL 1 DAY),'Trauma patient'),
  (4,3,4,'Normal',  'Fulfilled',CURDATE(),DATE_ADD(CURDATE(),INTERVAL 5 DAY),'Routine transfusion'),
  (5,5,2,'Urgent',  'Rejected', CURDATE(),DATE_ADD(CURDATE(),INTERVAL 3 DAY),'Cardiac operation')`);
console.log('✅ blood_request inserted');

// donation_camps
await db.query(`INSERT INTO donation_camp (organizer_type, ngo_id, hospital_id, name, location, city, camp_date, start_time, end_time, expected_donors, actual_donors, units_collected, contact_person, contact_phone, status, description) VALUES
  ('NGO', 1, 1, 'Republic Day Blood Drive 2026', 'Campal Grounds, Panaji', 'Panaji', DATE_ADD(CURDATE(), INTERVAL 10 DAY), '09:00', '16:00', 100, 0, 0, 'Smt. Maria Fernandes', '8320000006', 'Upcoming', 'Annual blood donation drive organized by Goa Red Cross in partnership with GMC Hospital.'),
  ('NGO', 2, NULL, 'Rotary Blood Camp - Margao', 'Ravindra Bhavan, Margao', 'Margao', DATE_ADD(CURDATE(), INTERVAL 20 DAY), '10:00', '15:00', 60, 0, 0, 'Mr. Sunil Shetty', '8320000007', 'Upcoming', 'Monthly blood donation camp by Rotary Club of Goa, South Goa chapter.'),
  ('Hospital', NULL, 3, 'Apollo Emergency Drive', 'Apollo Victor Hospital, Margao', 'Margao', DATE_SUB(CURDATE(), INTERVAL 15 DAY), '09:00', '14:00', 50, 42, 38, 'Dr. Priya Dessai', '8320000003', 'Completed', 'Emergency blood donation drive due to low O+ stock levels.'),
  ('College', NULL, NULL, 'GEC Blood Donation 2026', 'Goa Engineering College, Ponda', 'Ponda', DATE_ADD(CURDATE(), INTERVAL 5 DAY), '10:00', '16:00', 80, 0, 0, 'Prof. Anand Naik', '8321111130', 'Upcoming', 'Annual student-organized blood donation camp at GEC Farmagudi.')`);
console.log('✅ donation_camp inserted');

console.log('');
console.log('🎉 ═══════════════════════════════════════════════');
console.log('🎉  Goa Blood Bank v3.0 fully seeded!');
console.log('🎉 ═══════════════════════════════════════════════');
console.log('');
console.log('  Login            Password       Role              Portal');
console.log('  ─────────────── ─────────────  ──────────────── ─────────────────');
console.log('  superadmin       admin123       Super Admin       Admin Dashboard');
console.log('  staff1           admin123       Staff             Admin Dashboard');
console.log('  gmc.admin        hospital123    Hospital          Hospital Portal');
console.log('  manipal.goa      hospital123    Hospital          Hospital Portal');
console.log('  apollo.goa       hospital123    Hospital          Hospital Portal');
console.log('  rohan.naik       donor123       Donor             Donor Portal');
console.log('  sneha.des        donor123       Donor             Donor Portal');
console.log('  goa.redcross     ngo123         NGO               NGO Portal');
console.log('  rotary.goa       ngo123         NGO               NGO Portal');
console.log('');
console.log('⚠️  OTP is simulated — codes appear in the server console');

await db.end();
