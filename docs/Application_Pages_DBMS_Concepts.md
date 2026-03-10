# Goa Blood Bank System - Page-Wise DBMS Explanations

This document explains the core Database Management System (DBMS) concepts used behind the scenes for each page of the application.

## 1. Admin Dashboard (`/dashboard`)
This is the central hub for Staff and Super Admins. It brings multiple data points together using efficient queries and SQL features.
*   **Virtual Views:** The stock widget uses the `vw_blood_stock` View to instantly pull an aggregated sum of available units per blood group without manually writing complex `SUM()` and `GROUP BY` logic in the application.
*   **Aggregate Functions:** The top counters for Total Donors, Pending Requests, and Total Hospitals use the `COUNT(*)` SQL aggregate function to scan the `donor`, `blood_request`, and `hospital` tables to return single integer values rapidly.
*   **Date Operations:** The expiring stock widget uses the MySQL `DATE_ADD()` function to filter rows in the `blood_inventory` table `WHERE bi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)`, effectively showing blood expiring within the next 7 days.

## 2. Blood Inventory (`/inventory`)
This page handles the physical availability of blood units.
*   **Abstraction using Views:** The entire stock interface is abstracted behind `SELECT * FROM vw_blood_stock;`. The View executes a `LEFT JOIN` between `blood_group` and `blood_inventory`. A `LEFT JOIN` ensures that even if a blood group currently has 0 stock (meaning no related rows in `blood_inventory`), the blood group still appears on the user interface with a 0 value rather than disappearing.
*   **Data Aggregation:** The view utilizes `JOIN`, `SUM()`, `MIN()` (to find the earliest expiry date), and `COALESCE()` (to turn NULL sums into 0).

## 3. Donors Page (`/donors`)
This page lists registered donors and allows adding new ones.
*   **JOIN Queries:** The list uses an `INNER JOIN` (`JOIN blood_group bg ON d.blood_group_id = bg.blood_group_id`) to pull the human-readable string (like 'A+') instead of showing the user an unintelligible `blood_group_id` foreign key number.
*   **Data Insertion (DML):** When adding a donor (`/donors/add`), an `INSERT INTO` Data Manipulation Language (DML) statement is executed.
*   **NULL Handling:** The query logic transforms empty form inputs (like an empty email or address) into `NULL` types before insertion, maintaining database schema integrity rather than inserting empty strings (`''`).

## 4. Record Donation (`/donations`)
This handles logging blood donations from individuals.
*   **Encapsulated Logic (Stored Procedures):** Before confirming a donation, the backend executes `CALL sp_check_eligibility(?, @out)`. This executes a Stored Procedure directly on the database engine. It calculates the donor's 58-day cooldown status entirely on the database side and returns a boolean value through an `OUT` parameter.
*   **Active Rules (Triggers):** When the backend executes the `INSERT INTO donation` query, a **Before Insert Trigger** (`before_donation_insert`) acts as a safeguard to block the transaction if the user is still in cooldown.
*   **Cascading Actions (Triggers):** Upon successful insertion, an **After Insert Trigger** (`after_donation_insert`) fires immediately. It calculates math and instantly `UPDATE`s the `blood_inventory` and sets the donor's `is_eligible` status to false, guaranteeing ACID consistency without relying on the Node.js application to run consecutive queries.

## 5. Blood Requests (`/requests`)
This page manages hospital requests for blood units.
*   **Pre-sorted Views:** The frontend simply queries `SELECT * FROM vw_pending_requests`. This View uses an advanced `ORDER BY FIELD(br.urgency, 'Critical','Urgent','Normal')` mechanism. It sorts records logically by their string exactness rather than alphabetically, ensuring 'Critical' requests ALWAYS float to the absolute top of the table.
*   **Transaction Controls (ACID Properties):** Fulfilling a request triggers a complex Stored Procedure (`sp_fulfill_request`). 
    *   It begins with `START TRANSACTION`.
    *   It runs a manual validation check using an `IF` statement. If there isn't enough stock, it throws an exception (`SIGNAL SQLSTATE '45000'`) and halts.
    *   It inserts into the fulfillment ledger.
    *   It updates the main request to 'Fulfilled'.
    *   It completes the transaction with `COMMIT`. 
    *   If the server crashes mid-way, or an exception is thrown, the `ROLLBACK` handler undoes everything, preventing partial, corrupted data entries.

## 6. Reports & Analytics (`/reports`)
This is the analytical dashboard for viewing metrics.
*   **Conditional Formatting (`CASE WHEN`):** To calculate the fulfill rate of top hospitals, the query uses `SUM(CASE WHEN br.status='Fulfilled' THEN 1 ELSE 0 END)`. This enables row-by-row logical evaluation directly inside the database engine to pivot the data neatly.
*   **Advanced Grouping:** Aggregates data by combining `GROUP BY`, `COUNT()`, and `SUM()` across multiple `LEFT JOIN`s to render statistical comparisons, exactly answering questions like "Which blood group receives the most donations?" or "Which hospital requests the most blood?".
