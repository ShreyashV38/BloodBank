-- ============================================================
-- schema_v3.sql — Blood Bank System (Industry-Ready)
-- Adds: donation_camp, ngo tables, NGO role, account lockout
-- ============================================================

CREATE DATABASE IF NOT EXISTS blood_bank_db;
USE blood_bank_db;

-- ────────────────────────────────────────────────────────────
-- TABLE 1: blood_group 
-- ────────────────────────────────────────────────────────────
CREATE TABLE blood_group (
    blood_group_id   INT AUTO_INCREMENT PRIMARY KEY,
    group_name       VARCHAR(5) NOT NULL UNIQUE
);

-- ────────────────────────────────────────────────────────────
-- TABLE 2: system_user (updated — adds NGO role + lockout)
-- ────────────────────────────────────────────────────────────
CREATE TABLE system_user (
    user_id            INT AUTO_INCREMENT PRIMARY KEY,
    username           VARCHAR(50)  NOT NULL UNIQUE,
    password_hash      VARCHAR(255) NOT NULL,          
    full_name          VARCHAR(100) NOT NULL,
    role               ENUM('Super Admin','Staff','Donor','Hospital','NGO') NOT NULL DEFAULT 'Donor',
    email              VARCHAR(100) UNIQUE,
    phone              VARCHAR(15),
    is_active          BOOLEAN      DEFAULT TRUE,
    failed_login_count INT          DEFAULT 0,
    locked_until       DATETIME     DEFAULT NULL,
    last_login         DATETIME     DEFAULT NULL,
    created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- TABLE 3: donor
-- ────────────────────────────────────────────────────────────
CREATE TABLE donor (
    donor_id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id            INT          DEFAULT NULL,
    first_name         VARCHAR(50)  NOT NULL,
    last_name          VARCHAR(50)  NOT NULL,
    date_of_birth      DATE         NOT NULL,
    gender             ENUM('Male','Female','Other') NOT NULL,
    phone              VARCHAR(15)  NOT NULL UNIQUE,
    email              VARCHAR(100) UNIQUE,
    address            TEXT,
    blood_group_id     INT          NOT NULL,
    last_donation_date DATE         DEFAULT NULL,
    is_eligible        BOOLEAN      DEFAULT TRUE,
    created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_donor_user
        FOREIGN KEY (user_id)       REFERENCES system_user(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_donor_bg
        FOREIGN KEY (blood_group_id) REFERENCES blood_group(blood_group_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 4: blood_inventory
-- ────────────────────────────────────────────────────────────
CREATE TABLE blood_inventory (
    inventory_id     INT AUTO_INCREMENT PRIMARY KEY,
    blood_group_id   INT          NOT NULL,
    units_available  DECIMAL(6,2) NOT NULL DEFAULT 0,
    expiry_date      DATE         NOT NULL,
    last_updated     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_inv_bg
        FOREIGN KEY (blood_group_id) REFERENCES blood_group(blood_group_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 5: hospital
-- ────────────────────────────────────────────────────────────
CREATE TABLE hospital (
    hospital_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT          DEFAULT NULL,
    name             VARCHAR(150) NOT NULL,
    license_number   VARCHAR(50)  UNIQUE,
    hospital_type    ENUM('Government','Private','Clinic') DEFAULT 'Private',
    address          TEXT,
    city             VARCHAR(80),
    contact_person   VARCHAR(100),
    phone            VARCHAR(15)  NOT NULL UNIQUE,
    email            VARCHAR(100) UNIQUE,
    registered_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hospital_user
        FOREIGN KEY (user_id) REFERENCES system_user(user_id) ON DELETE SET NULL
);

-- ────────────────────────────────────────────────────────────
-- TABLE 6: donation
-- ────────────────────────────────────────────────────────────
CREATE TABLE donation (
    donation_id         INT AUTO_INCREMENT PRIMARY KEY,
    donor_id            INT          NOT NULL,
    blood_group_id      INT          NOT NULL,
    bag_serial_number   VARCHAR(50)  UNIQUE,
    donation_type       ENUM('Whole Blood','Apheresis Platelets','Plasmapheresis') DEFAULT 'Whole Blood',
    phlebotomist_id     INT          DEFAULT NULL,
    donation_date       DATE         NOT NULL,
    units_donated       DECIMAL(4,2) NOT NULL,
    weight              DECIMAL(5,2),
    blood_pressure      VARCHAR(20),
    hemoglobin_level    DECIMAL(4,2),
    donated_at_location VARCHAR(150),
    status              ENUM('Collected','Tested','Approved','Rejected') DEFAULT 'Collected',
    remarks             TEXT,

    CONSTRAINT fk_don_donor FOREIGN KEY (donor_id)       REFERENCES donor(donor_id),
    CONSTRAINT fk_don_bg    FOREIGN KEY (blood_group_id) REFERENCES blood_group(blood_group_id),
    CONSTRAINT fk_don_phleb FOREIGN KEY (phlebotomist_id) REFERENCES system_user(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_units_donated CHECK (units_donated > 0 AND units_donated <= 2)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 7: blood_request
-- ────────────────────────────────────────────────────────────
CREATE TABLE blood_request (
    request_id       INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id      INT          NOT NULL,
    blood_group_id   INT          NOT NULL,
    patient_name     VARCHAR(100),
    patient_diagnosis VARCHAR(255),
    component_required ENUM('Whole Blood', 'Packed Red Blood Cells (PRBC)', 'Fresh Frozen Plasma (FFP)', 'Platelets', 'Cryoprecipitate') DEFAULT 'Whole Blood',
    units_required   DECIMAL(6,2) NOT NULL,
    urgency          ENUM('Normal','Urgent','Critical') DEFAULT 'Normal',
    status           ENUM('Pending','Approved','Fulfilled','Rejected') DEFAULT 'Pending',
    crossmatch_required BOOLEAN   DEFAULT TRUE,
    request_date     DATE         NOT NULL DEFAULT (CURRENT_DATE),
    required_by_date DATE,
    purpose          VARCHAR(255),

    CONSTRAINT fk_req_hospital FOREIGN KEY (hospital_id)    REFERENCES hospital(hospital_id),
    CONSTRAINT fk_req_bg       FOREIGN KEY (blood_group_id) REFERENCES blood_group(blood_group_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 8: request_fulfillment
-- ────────────────────────────────────────────────────────────
CREATE TABLE request_fulfillment (
    fulfillment_id   INT AUTO_INCREMENT PRIMARY KEY,
    request_id       INT          NOT NULL,
    inventory_id     INT          NOT NULL,
    units_provided   DECIMAL(6,2) NOT NULL,
    dispatch_temperature DECIMAL(4,2),
    transport_mode   VARCHAR(100),
    fulfilled_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    fulfilled_by     INT          NOT NULL,

    CONSTRAINT uq_fulfilled_request UNIQUE (request_id),
    CONSTRAINT fk_ful_request FOREIGN KEY (request_id)   REFERENCES blood_request(request_id),
    CONSTRAINT fk_ful_inv     FOREIGN KEY (inventory_id) REFERENCES blood_inventory(inventory_id),
    CONSTRAINT fk_ful_admin   FOREIGN KEY (fulfilled_by) REFERENCES system_user(user_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 8b: invoice (Billing & Monetization)
-- ────────────────────────────────────────────────────────────
CREATE TABLE invoice (
    invoice_id        INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id       INT            NOT NULL,
    fulfillment_id    INT            NOT NULL,
    amount            DECIMAL(10,2)  NOT NULL,
    status            ENUM('Pending','Paid','Overdue') DEFAULT 'Pending',
    issued_date       DATETIME       DEFAULT CURRENT_TIMESTAMP,
    payment_reference VARCHAR(255)   DEFAULT NULL,

    CONSTRAINT fk_inv_hospital    FOREIGN KEY (hospital_id)    REFERENCES hospital(hospital_id),
    CONSTRAINT fk_inv_fulfillment FOREIGN KEY (fulfillment_id) REFERENCES request_fulfillment(fulfillment_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 9: appointment
-- ────────────────────────────────────────────────────────────
CREATE TABLE appointment (
    appointment_id  INT AUTO_INCREMENT PRIMARY KEY,
    donor_id        INT          NOT NULL,
    scheduled_date  DATE         NOT NULL,
    time_slot       VARCHAR(30),
    status          ENUM('Scheduled','Completed','Cancelled','No-Show') DEFAULT 'Scheduled',
    location        VARCHAR(150) DEFAULT 'GMC Blood Bank, Bambolim, Goa',
    notes           TEXT,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_appt_donor FOREIGN KEY (donor_id) REFERENCES donor(donor_id),
    CONSTRAINT uq_appt_donor_date UNIQUE (donor_id, scheduled_date, status)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 10: ngo (NEW)
-- ────────────────────────────────────────────────────────────
CREATE TABLE ngo (
    ngo_id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT          DEFAULT NULL,
    name                VARCHAR(150) NOT NULL,
    registration_number VARCHAR(50)  UNIQUE,
    focus_area          VARCHAR(100),
    address             TEXT,
    city                VARCHAR(80),
    contact_person      VARCHAR(100),
    phone               VARCHAR(15)  NOT NULL UNIQUE,
    email               VARCHAR(100) UNIQUE,
    website             VARCHAR(255),
    description         TEXT,
    is_verified         BOOLEAN      DEFAULT FALSE,
    registered_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ngo_user
        FOREIGN KEY (user_id) REFERENCES system_user(user_id) ON DELETE SET NULL
);

-- ────────────────────────────────────────────────────────────
-- TABLE 11: donation_camp (NEW)
-- ────────────────────────────────────────────────────────────
CREATE TABLE donation_camp (
    camp_id         INT AUTO_INCREMENT PRIMARY KEY,
    organizer_type  ENUM('NGO','Hospital','Government','CSR','College') NOT NULL,
    ngo_id          INT          DEFAULT NULL,
    hospital_id     INT          DEFAULT NULL,
    name            VARCHAR(150) NOT NULL,
    location        TEXT         NOT NULL,
    city            VARCHAR(80),
    camp_date       DATE         NOT NULL,
    start_time      TIME,
    end_time        TIME,
    expected_donors INT          DEFAULT 0,
    actual_donors   INT          DEFAULT 0,
    units_collected DECIMAL(6,2) DEFAULT 0,
    contact_person  VARCHAR(100),
    contact_phone   VARCHAR(15),
    status          ENUM('Upcoming','Ongoing','Completed','Cancelled') DEFAULT 'Upcoming',
    description     TEXT,
    created_by      INT          DEFAULT NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_camp_ngo      FOREIGN KEY (ngo_id)      REFERENCES ngo(ngo_id) ON DELETE SET NULL,
    CONSTRAINT fk_camp_hospital FOREIGN KEY (hospital_id) REFERENCES hospital(hospital_id) ON DELETE SET NULL,
    CONSTRAINT fk_camp_creator  FOREIGN KEY (created_by)  REFERENCES system_user(user_id) ON DELETE SET NULL
);


-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW vw_blood_stock AS
    SELECT
        bg.blood_group_id,
        bg.group_name,
        COALESCE(SUM(bi.units_available), 0) AS total_units,
        MIN(bi.expiry_date)                  AS earliest_expiry
    FROM blood_group bg
    LEFT JOIN blood_inventory bi ON bg.blood_group_id = bi.blood_group_id
    GROUP BY bg.blood_group_id, bg.group_name;

CREATE OR REPLACE VIEW vw_donor_history AS
    SELECT
        d.donor_id,
        CONCAT(d.first_name, ' ', d.last_name) AS donor_name,
        bg.group_name,
        don.donation_date,
        don.units_donated,
        don.status,
        don.donated_at_location
    FROM donor d
    JOIN blood_group bg  ON d.blood_group_id = bg.blood_group_id
    JOIN donation   don  ON d.donor_id       = don.donor_id
    ORDER BY don.donation_date DESC;

CREATE OR REPLACE VIEW vw_pending_requests AS
    SELECT
        br.request_id,
        h.name           AS hospital_name,
        h.city,
        bg.group_name,
        br.units_required,
        br.urgency,
        br.required_by_date,
        br.request_date
    FROM blood_request br
    JOIN hospital    h  ON br.hospital_id    = h.hospital_id
    JOIN blood_group bg ON br.blood_group_id = bg.blood_group_id
    WHERE br.status = 'Pending'
    ORDER BY
        FIELD(br.urgency, 'Critical','Urgent','Normal'),
        br.required_by_date ASC;

CREATE OR REPLACE VIEW vw_upcoming_camps AS
    SELECT
        dc.*,
        COALESCE(n.name, h.name, 'Self-organized') AS organizer_display_name
    FROM donation_camp dc
    LEFT JOIN ngo n ON dc.ngo_id = n.ngo_id
    LEFT JOIN hospital h ON dc.hospital_id = h.hospital_id
    WHERE dc.status IN ('Upcoming', 'Ongoing')
    ORDER BY dc.camp_date ASC;


-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER $$

CREATE PROCEDURE sp_record_donation (
    IN p_donor_id  INT,
    IN p_units     DECIMAL(4,2),
    IN p_location  VARCHAR(150)
)
BEGIN
    DECLARE v_bg_id INT;
    SELECT blood_group_id INTO v_bg_id FROM donor WHERE donor_id = p_donor_id;
    INSERT INTO donation (donor_id, blood_group_id, donation_date, units_donated, donated_at_location)
    VALUES (p_donor_id, v_bg_id, CURDATE(), p_units, p_location);
END$$

CREATE PROCEDURE sp_check_eligibility (
    IN  p_donor_id INT,
    OUT p_eligible BOOLEAN
)
BEGIN
    SELECT
        (last_donation_date IS NULL OR DATEDIFF(CURDATE(), last_donation_date) > 58)
        AND is_eligible = TRUE
    INTO p_eligible
    FROM donor WHERE donor_id = p_donor_id;
END$$

CREATE PROCEDURE sp_fulfill_request (
    IN p_request_id    INT,
    IN p_inventory_id  INT,
    IN p_units         DECIMAL(6,2),
    IN p_admin_id      INT,
    IN p_dispatch_temp DECIMAL(4,2),
    IN p_transport_mode VARCHAR(100)
)
BEGIN
    DECLARE v_units_available DECIMAL(6,2);
    DECLARE v_request_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT status INTO v_request_status
    FROM blood_request
    WHERE request_id = p_request_id
    FOR UPDATE;

    IF v_request_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Blood request not found';
    END IF;

    IF v_request_status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Blood request is not pending';
    END IF;

    SELECT units_available INTO v_units_available
    FROM blood_inventory
    WHERE inventory_id = p_inventory_id
    FOR UPDATE;

    IF v_units_available IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inventory batch not found';
    END IF;

    IF v_units_available < p_units THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient blood units in inventory';
    END IF;

    UPDATE blood_inventory
    SET units_available = units_available - p_units,
        last_updated = NOW()
    WHERE inventory_id = p_inventory_id;

    INSERT INTO request_fulfillment (request_id, inventory_id, units_provided, fulfilled_by, dispatch_temperature, transport_mode)
    VALUES (p_request_id, p_inventory_id, p_units, p_admin_id, p_dispatch_temp, p_transport_mode);

    -- Auto-generate invoice: ₹1500 per unit processing fee
    SET @new_fulfillment_id = LAST_INSERT_ID();
    SET @v_hospital_id = (SELECT hospital_id FROM blood_request WHERE request_id = p_request_id);
    SET @v_invoice_amount = p_units * 1500.00;

    INSERT INTO invoice (hospital_id, fulfillment_id, amount, status, issued_date)
    VALUES (@v_hospital_id, @new_fulfillment_id, @v_invoice_amount, 'Pending', NOW());

    UPDATE blood_request SET status = 'Approved' WHERE request_id = p_request_id;

    COMMIT;
END$$


-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER after_donation_insert
AFTER INSERT ON donation
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM blood_inventory
        WHERE blood_group_id = NEW.blood_group_id AND expiry_date > CURDATE()
        LIMIT 1
    ) THEN
        UPDATE blood_inventory
        SET    units_available = units_available + NEW.units_donated,
               last_updated    = NOW()
        WHERE  blood_group_id  = NEW.blood_group_id
          AND  expiry_date     > CURDATE()
        LIMIT 1;
    ELSE
        INSERT INTO blood_inventory (blood_group_id, units_available, expiry_date)
        VALUES (NEW.blood_group_id, NEW.units_donated, DATE_ADD(CURDATE(), INTERVAL 42 DAY));
    END IF;

    UPDATE donor
    SET    last_donation_date = NEW.donation_date,
           is_eligible        = FALSE
    WHERE  donor_id = NEW.donor_id;
END$$

CREATE TRIGGER before_donation_insert
BEFORE INSERT ON donation
FOR EACH ROW
BEGIN
    DECLARE v_eligible BOOLEAN;
    SELECT is_eligible INTO v_eligible FROM donor WHERE donor_id = NEW.donor_id;
    IF v_eligible = FALSE THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Donor is not eligible to donate (58-day cooldown active)';
    END IF;
END$$

CREATE TRIGGER after_fulfillment_insert
AFTER INSERT ON request_fulfillment
FOR EACH ROW
BEGIN
    UPDATE blood_inventory
    SET    last_updated    = NOW()
    WHERE  inventory_id = NEW.inventory_id;
END$$

DELIMITER ;


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_donor_blood_group     ON donor(blood_group_id);
CREATE INDEX idx_donor_user            ON donor(user_id);
CREATE INDEX idx_donation_date         ON donation(donation_date);
CREATE INDEX idx_inventory_blood_group ON blood_inventory(blood_group_id);
CREATE INDEX idx_appointment_donor     ON appointment(donor_id);
CREATE INDEX idx_appointment_date      ON appointment(scheduled_date);
CREATE INDEX idx_hospital_user         ON hospital(user_id);
CREATE INDEX idx_request_status        ON blood_request(status);
CREATE INDEX idx_request_urgency       ON blood_request(urgency);
CREATE INDEX idx_donation_status       ON donation(status);
CREATE INDEX idx_ngo_user              ON ngo(user_id);
CREATE INDEX idx_camp_date             ON donation_camp(camp_date);
CREATE INDEX idx_camp_status           ON donation_camp(status);
CREATE INDEX idx_camp_ngo              ON donation_camp(ngo_id);
CREATE INDEX idx_user_email            ON system_user(email);
CREATE INDEX idx_user_locked           ON system_user(locked_until);
CREATE INDEX idx_invoice_hospital      ON invoice(hospital_id);
CREATE INDEX idx_invoice_status        ON invoice(status);
