# Goa Blood Bank System - Core DBMS Concepts & Logic

This document outlines the core Database Management System (DBMS) concepts, principles, and specific logic implemented in the Goa Blood Bank System project.

## 1. Relational Schema & Normalization
The database follows a relational model and is highly normalized to minimize redundancy and prevent data anomalies (Update, Insertion, and Deletion anomalies). 
- **Separation of Concerns:** Core entities are divided into distinct tables: `system_user`, `blood_group`, `donor`, `hospital`, `blood_inventory`, `donation`, `blood_request`, `request_fulfillment`, and `appointment`.
- **Lookup Tables:** By extracting repeated strings (like Blood Types A+, O-, etc.) into a `blood_group` master lookup table, data integrity is maintained natively using foreign keys.
- **Unified Authentication:** The use of a central `system_user` table linked via foreign keys to the `donor` and `hospital` profile tables allows the system to easily handle authentication for different portals without creating multiple user credential tables.

## 2. Integrity Constraints
Data Integrity is rigorously enforced at the database level using SQL constraints to ensure incoming data is valid and reliable.

* **Domain Constraints:**
  * **`NOT NULL`**: Used extensively to ensure critical fields data (e.g., names, DOB, blood_group, units) are strictly provided.
  * **`DEFAULT`**: Automatically assigning timestamps (`CURRENT_TIMESTAMP`), common statuses (`'Pending'`, `'Collected'`), or default roles.
  * **`ENUM`**: Restricting allowable values for strings (e.g., `role ENUM('Super Admin', 'Staff', 'Donor', 'Hospital')`, `gender ENUM('Male','Female','Other')`).
  * **`CHECK` Constraints**: Ensuring logical validity, such as verifying the number of donated units is realistic (`CONSTRAINT chk_units_donated CHECK (units_donated > 0 AND units_donated <= 2)`).
* **Entity Integrity:** 
  * Every table utilizes a numeric `PRIMARY KEY` (e.g., `user_id`, `donor_id`) natively managed by `AUTO_INCREMENT` for strict, unique row identification.
* **Referential Integrity:**
  * Extensive use of **`FOREIGN KEY`** constraints binds the entire schema together. 
  * Examples: `FOREIGN KEY (user_id) REFERENCES system_user(user_id) ON DELETE SET NULL`. This ensures a `donor` or `hospital` record correctly relates back to an existing login credential, and handles the logic appropriately if the credential is deleted.
  * **`UNIQUE`** constraints enforce business rules, ensuring properties like `email`, `phone`, `username`, and hospital `license_number` do not duplicate across the table.

## 3. Role-Based Access Control (RBAC)
The database directly supports RBAC logic natively in its schema.
* The `system_user` table evaluates the `role` enum field to authenticate users dynamically (Super Admin, Staff, Donor, Hospital) into specific software application portals.
* Administrative functionality is tied back to the schema natively (e.g., `request_fulfillment` specifically records **who** approved it via `fulfilled_by` linked to an administrative `system_user_id`).

## 4. Views (Virtual Tables)
SQL `VIEWS` are implemented to abstract complex, multi-table JOINs and aggregations into easily queryable virtual tables. This cleans up backend code logic and prevents recalculating heavily-used metrics.
* **`vw_blood_stock`**: Aggregates the `blood_inventory` against `blood_group` utilizing `COALESCE`, `SUM`, and `MIN()` grouping to provide an instant, real-time snapshot of available units and the closest expiry dates for each blood type.
* **`vw_donor_history`**: Performs a 3-way `JOIN` between `donor`, `blood_group`, and `donation` to cleanly retrieve an individual's entire history in one swift query.
* **`vw_pending_requests`**: Pre-sorts and filters pending blood requirements from hospitals using complex `ORDER BY FIELD()` logic (`Critical` -> `Urgent` -> `Normal`), assuring the hardest-hit patients are prioritized gracefully.

## 5. Stored Procedures & Transactions (ACID Properties)
Complex business logic that requires executing multiple atomic database steps is natively encapsulated within Stored Procedures on the MySQL Server.

* **Transaction Management (`sp_fulfill_request`)**:
  Approving a hospital's blood request invokes a transaction (`START TRANSACTION`, `COMMIT`, `ROLLBACK`). 
  1. It uses an `EXIT HANDLER FOR SQLEXCEPTION` to catch any errors.
  2. It evaluates inventory manually (throws a custom error if insufficient stock).
  3. It inserts a fulfillment manifest (`request_fulfillment`).
  4. It cascades the `status` string on the `blood_request` table.
  5. If anything fails midway, it `ROLLBACK`s safely, ensuring the database remains completely consistent (**ACID Principle: Atomicity**).
* **Encapsulation (`sp_check_eligibility`)**: 
  The 58-day cooldown logic is encapsulated entirely within a Stored Procedure, which measures the `DATEDIFF()` against `last_donation_date` to output a clean boolean variable back to the main application.

## 6. Triggers (Active Database Concepts)
Triggers are implemented extensively to automate cascading side-effects synchronously during INSERT operations.

* **`after_donation_insert`**: (AFTER INSERT Trigger)
  When a new donation is successfully logged, the database actively fires off two updates without the Node.js application intervening:
  1. It automatically increases the available stock level inside `blood_inventory`.
  2. It updates the donor's `last_donation_date` and strictly sets their boolean flag `is_eligible = FALSE`.
* **`before_donation_insert`**: (BEFORE INSERT Trigger)
  Acts as a massive database-layer security switch. It proactively inspects the `donor` table prior to successfully inserting a donation. If the donor isn't eligible, the database utilizes `SIGNAL SQLSTATE '45000'` to forcefully abort the entire process and throw an error to the user interface.
* **`after_fulfillment_insert`**: (AFTER INSERT Trigger)
  The direct reciprocal to donations; securely and automatically deducts the designated `units_provided` away from the central `blood_inventory` whenever an Admin approves dispatching blood to a hospital.

## 7. Indexing for Performance Optimization
In order to reduce scan times on tables that generally scale massive sizes over time, exact `CREATE INDEX` mappings have been hardcoded. 
* Foreign keys universally feature indexes (`idx_donor_blood_group`, `idx_hospital_user`) ensuring exceptionally fast `JOIN` operations.
* Lookup fields involved heavily in logical queries or dashboards (`idx_request_status`, `idx_request_urgency`, `idx_donation_date`) utilize Custom indexes, vastly reducing disk I/O when reading records.
