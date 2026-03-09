-- ============================================================
-- BLOOD BANK SYSTEM — Sample / Seed Data
-- Run AFTER schema.sql
-- ============================================================

USE blood_bank_db;

-- ── Blood Groups ─────────────────────────────────────────────
INSERT INTO blood_group (group_name) VALUES
  ('A+'), ('A-'), ('B+'), ('B-'), ('AB+'), ('AB-'), ('O+'), ('O-');

-- ── Admin Users (passwords are bcrypt of 'admin123') ─────────
INSERT INTO admin_user (username, password_hash, full_name, role) VALUES
  ('superadmin', '$2b$10$k1nhtvr5791WRD7ZGQ6axumED8oCqjmhhvKtKSsE8D/lbABX.Sy87G', 'Super Admin', 'Super Admin'),
  ('staff1',     '$2b$10$k1nhtvr5791WRD7ZGQ6axumED8oCqjmhhvKtKSsE8D/lbABX.Sy87G', 'Ravi Sharma', 'Staff');

-- ── Hospitals (Goa, India) ────────────────────────────────────
INSERT INTO hospital (name, license_number, hospital_type, address, city, contact_person, phone, email) VALUES
  ('Goa Medical College & Hospital', 'LIC-GMC-001', 'Government', 'Bambolim, NH-4A',                     'Panaji',    'Dr. Rajesh Naik',   '8320000001', 'gmc@goahealth.gov.in'),
  ('Manipal Hospital Goa',           'LIC-MAN-002', 'Private',    'Dona Paula, Panaji',                  'Panaji',    'Dr. Sunita Bhat',   '8320000002', 'manipal@goahospital.com'),
  ('Apollo Victor Hospital',         'LIC-APO-003', 'Private',    'Swatantra Path, Margao',              'Margao',    'Dr. Priya Dessai',  '8320000003', 'apollo@goahospital.com'),
  ('Asilo Hospital',                 'LIC-ASI-004', 'Government', 'Hospital Road, Mapusa',               'Mapusa',    'Dr. Carlos Fonseca','8320000004', 'asilo@goahospital.com'),
  ('District Hospital Vasco',        'LIC-VAS-005', 'Government', 'FL Gomes Road, Vasco da Gama',        'Vasco',     'Dr. Meena Gaonkar', '8320000005', 'vasco@goahealth.gov.in');

-- ── Donors (Goa-based) ────────────────────────────────────────
INSERT INTO donor (first_name, last_name, date_of_birth, gender, phone, email, address, blood_group_id, is_eligible) VALUES
  ('Rohan',   'Naik',    '1995-03-12', 'Male',   '8321111111', 'rohan.naik@mail.com',   'Alto Porvorim, Bardez, Goa',    1, TRUE),
  ('Sneha',   'Dessai',  '1998-07-22', 'Female', '8321111112', 'sneha.dessai@mail.com', 'Fatorda, Margao, Goa',          2, TRUE),
  ('Aditya',  'Kamat',   '1993-11-05', 'Male',   '8321111113', 'aditya.kamat@mail.com', 'Mapusa, Bardez, Goa',           3, TRUE),
  ('Priya',   'Gaonkar', '2000-01-18', 'Female', '8321111114', 'priya.gaon@mail.com',   'Ponda, South Goa',              4, TRUE),
  ('Vikram',  'Fonseca', '1997-06-30', 'Male',   '8321111115', 'vikram.f@mail.com',     'Calangute, North Goa',          5, TRUE),
  ('Anjali',  'Borges',  '1999-09-14', 'Female', '8321111116', 'anjali.b@mail.com',     'Vasco da Gama, South Goa',      6, TRUE),
  ('Suresh',  'Shetty',  '1991-04-25', 'Male',   '8321111117', 'suresh.s@mail.com',     'Canacona, South Goa',           7, TRUE),
  ('Meera',   'Sawant',  '1996-12-03', 'Female', '8321111118', 'meera.saw@mail.com',    'Pernem, North Goa',             8, TRUE),
  ('Carlos',  'Rodrigues','1994-08-17','Male',   '8321111119', 'carlos.r@mail.com',     'Panaji, North Goa',             1, TRUE),
  ('Divya',   'Parab',   '2001-02-28', 'Female', '8321111120', 'divya.p@mail.com',      'Bicholim, North Goa',           3, TRUE);

-- ── Blood Inventory (initial stock) ──────────────────────────
INSERT INTO blood_inventory (blood_group_id, units_available, expiry_date) VALUES
  (1, 15, DATE_ADD(CURDATE(), INTERVAL 30 DAY)),  -- A+
  (2,  4, DATE_ADD(CURDATE(), INTERVAL 20 DAY)),  -- A-  (low stock)
  (3, 20, DATE_ADD(CURDATE(), INTERVAL 35 DAY)),  -- B+
  (4,  2, DATE_ADD(CURDATE(), INTERVAL 15 DAY)),  -- B-  (critical)
  (5, 10, DATE_ADD(CURDATE(), INTERVAL 25 DAY)),  -- AB+
  (6,  3, DATE_ADD(CURDATE(), INTERVAL 28 DAY)),  -- AB-
  (7, 25, DATE_ADD(CURDATE(), INTERVAL 40 DAY)),  -- O+
  (8,  6, DATE_ADD(CURDATE(), INTERVAL 18 DAY));  -- O-

-- ── Donations (Goa camps & blood banks) ──────────────────────
INSERT INTO donation (donor_id, blood_group_id, bag_serial_number, donation_type, weight, blood_pressure, hemoglobin_level, donation_date, units_donated, donated_at_location, status) VALUES
  (1, 1, 'W123424100001', 'Whole Blood', 65.0, '120/80', 14.5, DATE_SUB(CURDATE(), INTERVAL 120 DAY), 1, 'GMC Blood Bank, Bambolim, Goa',          'Approved'),
  (3, 3, 'W123424100002', 'Whole Blood', 72.5, '118/78', 15.1, DATE_SUB(CURDATE(), INTERVAL 95 DAY),  1, 'Rotary Blood Donation Camp, Mapusa, Goa', 'Approved'),
  (5, 5, 'W123424100003', 'Whole Blood', 80.0, '122/82', 14.8, DATE_SUB(CURDATE(), INTERVAL 110 DAY), 1, 'Apollo Victor Drive, Margao, Goa',        'Approved'),
  (7, 7, 'W123424100004', 'Whole Blood', 68.0, '115/75', 13.9, DATE_SUB(CURDATE(), INTERVAL 100 DAY), 1, 'NSS Camp, Ponda College, Goa',            'Approved'),
  (9, 1, 'W123424100005', 'Whole Blood', 75.0, '125/85', 16.0, DATE_SUB(CURDATE(), INTERVAL 130 DAY), 1, 'Manipal Hospital Camp, Panaji, Goa',      'Approved'),
  (2, 2, 'W123424100006', 'Apheresis Platelets', 58.0, '110/70', 13.5, DATE_SUB(CURDATE(), INTERVAL 30 DAY),  1, 'PHC Blood Bank, Fatorda, Goa',            'Collected'),
  (4, 4, 'W123424100007', 'Whole Blood', 62.0, '112/72', 14.0, DATE_SUB(CURDATE(), INTERVAL 10 DAY),  1, 'Community Camp, Ponda, Goa',              'Tested'),
  (6, 6, 'W123424100008', 'Plasmapheresis', 60.0, '110/75', 13.8, DATE_SUB(CURDATE(), INTERVAL 5 DAY),   1, 'District Hospital Camp, Vasco, Goa',      'Collected');

-- ── Blood Requests (from Goa hospitals) ──────────────────────
INSERT INTO blood_request (hospital_id, blood_group_id, patient_name, patient_diagnosis, component_required, units_required, urgency, status, crossmatch_required, required_by_date, purpose) VALUES
  (1, 7, 'Rohit Tendulkar', 'Severe Anemia', 'Packed Red Blood Cells (PRBC)', 5, 'Urgent',   'Pending',   TRUE,  DATE_ADD(CURDATE(), INTERVAL 2 DAY),  'Emergency surgery'),
  (2, 1, 'Smita Patil', 'Hip Replacement', 'Whole Blood', 3, 'Normal',   'Pending',   TRUE,  DATE_ADD(CURDATE(), INTERVAL 7 DAY),  'Scheduled operation'),
  (3, 4, 'Almeida Dsouza', 'Traffic Accident Trauma', 'Whole Blood', 2, 'Critical', 'Pending',   FALSE, DATE_ADD(CURDATE(), INTERVAL 1 DAY),  'Trauma patient'),
  (4, 3, 'Kabir Singh', 'Thalassemia', 'Packed Red Blood Cells (PRBC)', 4, 'Normal',   'Fulfilled', TRUE,  DATE_ADD(CURDATE(), INTERVAL 5 DAY),  'Routine transfusion'),
  (5, 5, 'Anand Borkar', 'Open Heart Surgery', 'Platelets', 2, 'Urgent',   'Rejected',  TRUE,  DATE_ADD(CURDATE(), INTERVAL 3 DAY),  'Cardiac operation');
