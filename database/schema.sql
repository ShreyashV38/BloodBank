CREATE DATABASE IF NOT EXISTS blood_bank_db;
USE blood_bank_db;

-- ────────────────────────────────────────────────────────────
-- TABLE 1: blood_group 
-- Master list of 8 blood types — referenced everywhere
-- ────────────────────────────────────────────────────────────
CREATE TABLE blood_group (
    blood_group_id   INT AUTO_INCREMENT PRIMARY KEY,
    group_name       VARCHAR(5) NOT NULL UNIQUE   -- A+, A-, B+, B-, AB+, AB-, O+, O-
);

-- ────────────────────────────────────────────────────────────
-- TABLE 2: system_user  
-- Unified login table for ALL user types.
-- Admins & Staff log in to the back-office dashboard.
-- Donors & Hospitals log in to their own portals.
-- ────────────────────────────────────────────────────────────
CREATE TABLE system_user (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,          
    full_name      VARCHAR(100) NOT NULL,
    role           ENUM('Super Admin','Staff','Donor','Hospital') NOT NULL DEFAULT 'Donor',
    email          VARCHAR(100) UNIQUE,
    is_active      BOOLEAN      DEFAULT TRUE,
    last_login     DATETIME     DEFAULT NULL,
    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- TABLE 3: donor 
-- Registered blood donors in Goa.
-- user_id is NULL until the donor registers a portal account.
-- ────────────────────────────────────────────────────────────
CREATE TABLE donor (
    donor_id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id            INT          DEFAULT NULL,        -- FK to system_user (portal login)
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
    -- Note: age >= 18 enforced at application layer
);

-- ────────────────────────────────────────────────────────────
-- TABLE 4: blood_inventory 
-- Physical blood stock at the Goa Blood Bank.
-- ────────────────────────────────────────────────────────────
CREATE TABLE blood_inventory (
    inventory_id     INT AUTO_INCREMENT PRIMARY KEY,
    blood_group_id   INT          NOT NULL,
    units_available  DECIMAL(6,2) NOT NULL DEFAULT 0,
    expiry_date      DATE         NOT NULL,            -- blood expires ~42 days after collection
    last_updated     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_inv_bg
        FOREIGN KEY (blood_group_id) REFERENCES blood_group(blood_group_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 5: hospital  
-- Goa hospitals that request blood from the bank.
-- user_id links to the hospital's portal login account.
-- ────────────────────────────────────────────────────────────
CREATE TABLE hospital (
    hospital_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT          DEFAULT NULL,        -- FK to system_user (portal login)
    name             VARCHAR(150) NOT NULL,
    license_number   VARCHAR(50)  UNIQUE,              -- Clinical establishment license
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
-- Every blood donation event.
-- Triggers auto-update inventory & donor eligibility on INSERT.
-- ────────────────────────────────────────────────────────────
CREATE TABLE donation (
    donation_id         INT AUTO_INCREMENT PRIMARY KEY,
    donor_id            INT          NOT NULL,
    blood_group_id      INT          NOT NULL,
    bag_serial_number   VARCHAR(50)  UNIQUE,            -- ISBT 128 barcode
    donation_type       ENUM('Whole Blood','Apheresis Platelets','Plasmapheresis') DEFAULT 'Whole Blood',
    phlebotomist_id     INT          DEFAULT NULL,      -- FK to system_user
    donation_date       DATE         NOT NULL,          -- supplied explicitly in INSERT
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
-- Blood requests raised by hospitals.
-- Can be raised via the back-office OR the hospital portal.
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
-- Tracks which inventory batch fulfilled which request,
-- and which admin approved it.
-- Trigger auto-deducts inventory units on INSERT.
-- ────────────────────────────────────────────────────────────
CREATE TABLE request_fulfillment (
    fulfillment_id   INT AUTO_INCREMENT PRIMARY KEY,
    request_id       INT          NOT NULL,
    inventory_id     INT          NOT NULL,
    units_provided   DECIMAL(6,2) NOT NULL,
    dispatch_temperature DECIMAL(4,2),
    transport_mode   VARCHAR(100),
    fulfilled_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    fulfilled_by     INT          NOT NULL,             -- system_user_id (Staff or Super Admin)

    CONSTRAINT uq_fulfilled_request UNIQUE (request_id),
    CONSTRAINT fk_ful_request FOREIGN KEY (request_id)   REFERENCES blood_request(request_id),
    CONSTRAINT fk_ful_inv     FOREIGN KEY (inventory_id) REFERENCES blood_inventory(inventory_id),
    CONSTRAINT fk_ful_admin   FOREIGN KEY (fulfilled_by) REFERENCES system_user(user_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 9: appointment 
-- Donors can schedule a donation slot via the donor portal.
-- ────────────────────────────────────────────────────────────
CREATE TABLE appointment (
    appointment_id  INT AUTO_INCREMENT PRIMARY KEY,
    donor_id        INT          NOT NULL,
    scheduled_date  DATE         NOT NULL,
    time_slot       VARCHAR(30),                        -- '09:00', '11:30', etc.
    status          ENUM('Scheduled','Completed','Cancelled','No-Show') DEFAULT 'Scheduled',
    location        VARCHAR(150) DEFAULT 'GMC Blood Bank, Bambolim, Goa',
    notes           TEXT,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_appt_donor FOREIGN KEY (donor_id) REFERENCES donor(donor_id),
    CONSTRAINT uq_appt_donor_date UNIQUE (donor_id, scheduled_date, status)
);


-- ============================================================
-- VIEWS
-- ============================================================

--  Current stock summary per blood group
CREATE OR REPLACE VIEW vw_blood_stock AS
    SELECT
        bg.group_name,  
        COALESCE(SUM(bi.units_available), 0) AS total_units,
        MIN(bi.expiry_date)                  AS earliest_expiry
    FROM blood_group bg
    LEFT JOIN blood_inventory bi ON bg.blood_group_id = bi.blood_group_id
    GROUP BY bg.blood_group_id, bg.group_name;

--  Full donor donation history
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

--  Pending requests ordered Critical → Urgent → Normal
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


-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER $$

--  Record a donation — triggers handle the rest
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

--  Check if donor is eligible (58-day)
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

--  Fulfill a blood request — TRANSACTION with ROLLBACK
CREATE PROCEDURE sp_fulfill_request (
    IN p_request_id   INT,
    IN p_inventory_id INT,
    IN p_units        DECIMAL(6,2),
    IN p_admin_id     INT,
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

    -- Validate stock
    IF v_units_available < p_units THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient blood units in inventory';
    END IF;

    UPDATE blood_inventory
    SET units_available = units_available - p_units,
        last_updated = NOW()
    WHERE inventory_id = p_inventory_id;

    -- Insert fulfillment record (trigger auto-deducts inventory)
    INSERT INTO request_fulfillment (request_id, inventory_id, units_provided, fulfilled_by, dispatch_temperature, transport_mode)
    VALUES (p_request_id, p_inventory_id, p_units, p_admin_id, p_dispatch_temp, p_transport_mode);

    -- Mark request as approved (payment will later fulfill)
    UPDATE blood_request SET status = 'Approved' WHERE request_id = p_request_id;

    COMMIT;
END$$


-- ============================================================
-- TRIGGERS
-- ============================================================

--  After donation: update inventory + set 58-day cooldown on donor
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

--  Before donation: block if donor is ineligible
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

--  After fulfillment: auto-deduct blood units from inventory
CREATE TRIGGER after_fulfillment_insert
AFTER INSERT ON request_fulfillment
FOR EACH ROW
BEGIN
    UPDATE blood_inventory
    SET    last_updated = NOW()
    WHERE  inventory_id = NEW.inventory_id;
END$$

DELIMITER ;


-- ============================================================
-- INDEXES
-- ============================================================

--  indexes
CREATE INDEX idx_donor_blood_group     ON donor(blood_group_id);
CREATE INDEX idx_donor_user            ON donor(user_id);
CREATE INDEX idx_donation_date         ON donation(donation_date);
CREATE INDEX idx_inventory_blood_group ON blood_inventory(blood_group_id);
CREATE INDEX idx_appointment_donor     ON appointment(donor_id);
CREATE INDEX idx_appointment_date      ON appointment(scheduled_date);

--  indexes
CREATE INDEX idx_hospital_user         ON hospital(user_id);
CREATE INDEX idx_request_status        ON blood_request(status);
CREATE INDEX idx_request_urgency       ON blood_request(urgency);
CREATE INDEX idx_donation_status       ON donation(status);
