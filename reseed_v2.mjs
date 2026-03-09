import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const db = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '4019', database: 'blood_bank_db'
});

const adminHash = await bcrypt.hash('admin123', 10);
const hospHash = await bcrypt.hash('hospital123', 10);
const donorHash = await bcrypt.hash('donor123', 10);

// system_user
await db.query(`INSERT INTO system_user (username,password_hash,full_name,role,email) VALUES
  ('superadmin', ?, 'Super Admin',        'Super Admin', 'admin@goabloodbank.gov.in'),
  ('staff1',     ?, 'Rajesh Naik',        'Staff',       'rajesh@goabloodbank.gov.in'),
  ('gmc.admin',  ?, 'GMC Admin',          'Hospital',    'gmc.portal@goahealth.gov.in'),
  ('manipal.goa',?, 'Manipal Goa Admin',  'Hospital',    'portal@manipalgoa.com'),
  ('apollo.goa', ?, 'Apollo Victor',      'Hospital',    'portal@apollogoa.com'),
  ('asilo.goa',  ?, 'Asilo Hospital',     'Hospital',    'portal@asilohospital.com'),
  ('vasco.dh',   ?, 'Vasco District',     'Hospital',    'portal@vascodh.gov.in'),
  ('rohan.naik', ?, 'Rohan Naik',         'Donor',       'rohan.naik@mail.com'),
  ('sneha.des',  ?, 'Sneha Dessai',       'Donor',       'sneha.dessai@mail.com')`,
    [adminHash, adminHash, hospHash, hospHash, hospHash, hospHash, hospHash, donorHash, donorHash]);
console.log('✅ system_user inserted');

// blood_group
await db.query(`INSERT INTO blood_group (group_name) VALUES ('A+'),('A-'),('B+'),('B-'),('AB+'),('AB-'),('O+'),('O-')`);

// hospital (linked to system_user user_id 3-7)
await db.query(`INSERT INTO hospital (user_id,name,address,city,contact_person,phone,email) VALUES
  (3,'Goa Medical College & Hospital','Bambolim, NH-4A',             'Panaji','Dr. Rajesh Naik',   '8320000001','gmc@goahealth.gov.in'),
  (4,'Manipal Hospital Goa',          'Dona Paula, Panaji',          'Panaji','Dr. Sunita Bhat',   '8320000002','manipal@goahospital.com'),
  (5,'Apollo Victor Hospital',        'Swatantra Path, Margao',      'Margao','Dr. Priya Dessai',  '8320000003','apollo@goahospital.com'),
  (6,'Asilo Hospital',                'Hospital Road, Mapusa',       'Mapusa','Dr. Carlos Fonseca','8320000004','asilo@goahospital.com'),
  (7,'District Hospital Vasco',       'FL Gomes Road, Vasco da Gama','Vasco', 'Dr. Meena Gaonkar', '8320000005','vasco@goahealth.gov.in')`);

// donor (first 2 linked to system_user 8-9)
await db.query(`INSERT INTO donor (user_id,first_name,last_name,date_of_birth,gender,phone,email,address,blood_group_id,is_eligible) VALUES
  (8,   'Rohan', 'Naik',      '1995-03-12','Male',  '8321111111','rohan.naik@mail.com',  'Alto Porvorim, Bardez, Goa',1,TRUE),
  (9,   'Sneha', 'Dessai',    '1998-07-22','Female','8321111112','sneha.dessai@mail.com','Fatorda, Margao, Goa',      2,TRUE),
  (NULL,'Aditya','Kamat',     '1993-11-05','Male',  '8321111113','aditya.kamat@mail.com','Mapusa, Bardez, Goa',       3,TRUE),
  (NULL,'Priya', 'Gaonkar',   '2000-01-18','Female','8321111114','priya.gaon@mail.com',  'Ponda, South Goa',          4,TRUE),
  (NULL,'Vikram','Fonseca',   '1997-06-30','Male',  '8321111115','vikram.f@mail.com',    'Calangute, North Goa',      5,TRUE),
  (NULL,'Anjali','Borges',    '1999-09-14','Female','8321111116','anjali.b@mail.com',    'Vasco da Gama, South Goa',  6,TRUE),
  (NULL,'Suresh','Shetty',    '1991-04-25','Male',  '8321111117','suresh.s@mail.com',    'Canacona, South Goa',       7,TRUE),
  (NULL,'Meera', 'Sawant',    '1996-12-03','Female','8321111118','meera.saw@mail.com',   'Pernem, North Goa',         8,TRUE),
  (NULL,'Carlos','Rodrigues', '1994-08-17','Male',  '8321111119','carlos.r@mail.com',    'Panaji, North Goa',         1,TRUE),
  (NULL,'Divya', 'Parab',     '2001-02-28','Female','8321111120','divya.p@mail.com',     'Bicholim, North Goa',       3,TRUE)`);

// blood_inventory
await db.query(`INSERT INTO blood_inventory (blood_group_id,units_available,expiry_date) VALUES
  (1,15,DATE_ADD(CURDATE(),INTERVAL 30 DAY)),(2,4,DATE_ADD(CURDATE(),INTERVAL 20 DAY)),
  (3,20,DATE_ADD(CURDATE(),INTERVAL 35 DAY)),(4,2,DATE_ADD(CURDATE(),INTERVAL 15 DAY)),
  (5,10,DATE_ADD(CURDATE(),INTERVAL 25 DAY)),(6,3,DATE_ADD(CURDATE(),INTERVAL 28 DAY)),
  (7,25,DATE_ADD(CURDATE(),INTERVAL 40 DAY)),(8,6,DATE_ADD(CURDATE(),INTERVAL 18 DAY))`);

// donations
await db.query(`INSERT INTO donation (donor_id,blood_group_id,donation_date,units_donated,donated_at_location,status) VALUES
  (1,1,DATE_SUB(CURDATE(),INTERVAL 120 DAY),1,'GMC Blood Bank, Bambolim, Goa','Approved'),
  (3,3,DATE_SUB(CURDATE(),INTERVAL 95 DAY), 1,'Rotary Camp, Mapusa, Goa','Approved'),
  (5,5,DATE_SUB(CURDATE(),INTERVAL 110 DAY),1,'Apollo Victor Drive, Margao, Goa','Approved'),
  (7,7,DATE_SUB(CURDATE(),INTERVAL 100 DAY),1,'NSS Camp, Ponda College, Goa','Approved'),
  (9,1,DATE_SUB(CURDATE(),INTERVAL 130 DAY),1,'Manipal Hospital Camp, Panaji, Goa','Approved'),
  (2,2,DATE_SUB(CURDATE(),INTERVAL 30 DAY), 1,'PHC Blood Bank, Fatorda, Goa','Collected'),
  (4,4,DATE_SUB(CURDATE(),INTERVAL 10 DAY), 1,'Community Camp, Ponda, Goa','Tested'),
  (6,6,DATE_SUB(CURDATE(),INTERVAL 5 DAY),  1,'District Hospital Camp, Vasco, Goa','Collected')`);

// appointments
await db.query(`INSERT INTO appointment (donor_id,scheduled_date,time_slot,status,location) VALUES
  (1,DATE_ADD(CURDATE(),INTERVAL 15 DAY),'09:00','Scheduled','GMC Blood Bank, Bambolim, Goa'),
  (2,DATE_ADD(CURDATE(),INTERVAL 7 DAY), '11:00','Scheduled','Manipal Hospital Camp, Panaji, Goa'),
  (3,DATE_SUB(CURDATE(),INTERVAL 5 DAY), '10:00','Completed','Rotary Camp, Mapusa, Goa')`);

// blood_requests
await db.query(`INSERT INTO blood_request (hospital_id,blood_group_id,units_required,urgency,status,request_date,required_by_date,purpose) VALUES
  (1,7,5,'Urgent',  'Pending',  CURDATE(),DATE_ADD(CURDATE(),INTERVAL 2 DAY),'Emergency surgery'),
  (2,1,3,'Normal',  'Pending',  CURDATE(),DATE_ADD(CURDATE(),INTERVAL 7 DAY),'Scheduled operation'),
  (3,4,2,'Critical','Pending',  CURDATE(),DATE_ADD(CURDATE(),INTERVAL 1 DAY),'Trauma patient'),
  (4,3,4,'Normal',  'Fulfilled',CURDATE(),DATE_ADD(CURDATE(),INTERVAL 5 DAY),'Routine transfusion'),
  (5,5,2,'Urgent',  'Rejected', CURDATE(),DATE_ADD(CURDATE(),INTERVAL 3 DAY),'Cardiac operation')`);

console.log('');
console.log('🎉 Goa Blood Bank v2.0 fully seeded!');
console.log('');
console.log('  Login            Password       Role');
console.log('  ─────────────── ─────────────  ──────────');
console.log('  superadmin      admin123        Admin Dashboard');
console.log('  staff1          admin123        Admin Dashboard');
console.log('  gmc.admin       hospital123     GMC Hospital Portal');
console.log('  manipal.goa     hospital123     Manipal Hospital Portal');
console.log('  apollo.goa      hospital123     Apollo Hospital Portal');
console.log('  rohan.naik      donor123        Donor Portal (stub)');

await db.end();
