-- Create the invoice table for billing & monetization
USE blood_bank_db;

CREATE TABLE IF NOT EXISTS invoice (
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

CREATE INDEX idx_invoice_hospital ON invoice(hospital_id);
CREATE INDEX idx_invoice_status ON invoice(status);

-- Update the stored procedure to auto-generate invoices
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

    -- Auto-generate invoice: Rs.1500 per unit processing fee
    SET @new_fulfillment_id = LAST_INSERT_ID();
    SET @v_hospital_id = (SELECT hospital_id FROM blood_request WHERE request_id = p_request_id);
    SET @v_invoice_amount = p_units * 1500.00;

    INSERT INTO invoice (hospital_id, fulfillment_id, amount, status, issued_date)
    VALUES (@v_hospital_id, @new_fulfillment_id, @v_invoice_amount, 'Pending', NOW());

    UPDATE blood_request SET status = 'Approved' WHERE request_id = p_request_id;

    COMMIT;
END$$
DELIMITER ;
