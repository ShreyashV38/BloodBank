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
