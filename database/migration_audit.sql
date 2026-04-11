-- ============================================================
-- migration_audit.sql — Add audit_log table
-- Run: mysql -u root -p blood_bank_db < database/migration_audit.sql
-- ============================================================

USE blood_bank_db;

CREATE TABLE IF NOT EXISTS audit_log (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   INT,
    details     TEXT,
    ip_address  VARCHAR(45),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES system_user(user_id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
);

-- Widen time_slot column to fit longer values like "Morning (9-12)"
ALTER TABLE appointment MODIFY COLUMN time_slot VARCHAR(30);

-- Prevent duplicate scheduled appointments for same donor/date
ALTER TABLE appointment
    ADD CONSTRAINT uq_appt_donor_date UNIQUE (donor_id, scheduled_date, status);

-- Prevent fulfilling the same request multiple times
ALTER TABLE request_fulfillment
    ADD CONSTRAINT uq_fulfilled_request UNIQUE (request_id);

-- Recreate fulfillment trigger so inventory deduction is handled inside procedure transaction
DROP TRIGGER IF EXISTS after_fulfillment_insert;
DELIMITER $$
CREATE TRIGGER after_fulfillment_insert
AFTER INSERT ON request_fulfillment
FOR EACH ROW
BEGIN
    UPDATE blood_inventory
    SET    last_updated = NOW()
    WHERE  inventory_id = NEW.inventory_id;
END$$
DELIMITER ;

-- Recreate fulfillment stored procedure with row locking and status guard
DROP PROCEDURE IF EXISTS sp_fulfill_request;
DELIMITER $$
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

    UPDATE blood_request SET status = 'Fulfilled' WHERE request_id = p_request_id;

    COMMIT;
END$$
DELIMITER ;
