# Project Progress Report

### What We Built
* We created the system to handle blood donations, hospital requests, and blood dispatch.
* Built a portal for hospitals to log in and request blood.
* Made a system to record new blood donations with details like blood type, date, and donor vitals.
* Created a way for hospitals to ask for specific blood components (like Plasma or Platelets).
* Built a feature to track exactly when blood is sent to a hospital, including temperature and transport details.

### Database Concepts Used & Exactly Where They Are
* **Tables:** Created specialized tables for `hospital`, `donation`, `blood_request`, and `request_fulfillment` to organize data neatly.
* **Primary and Foreign Keys:** 
  * *Primary Keys* like `hospital_id` to uniquely identify each row. 
  * *Foreign Keys* to link tables (e.g., `hospital_id` in the `blood_request` table links back to the hospital that made the request).
* **Constraints (Check & Unique):** 
  * *Unique Constraint* on `license_number` to prevent duplicate hospital registrations.
  * *Check Constraint* (`chk_units_donated`) to make sure nobody can donate more than 2 units of blood.
* **Stored Procedures:** Wrote `sp_fulfill_request` to automatically handle fulfilling a blood request so all steps happen together easily with a single command.
* **Transactions (Commit/Rollback):** Used `START TRANSACTION` inside `sp_fulfill_request` to make sure if one step fails (like insufficient blood), the whole process stops (`ROLLBACK`) and no data is corrupted.
* **Triggers:** 
  * `after_donation_insert` to automatically increase the available blood inventory whenever new blood is cleared.
  * `after_fulfillment_insert` to automatically deduct blood inventory when bags are sent out to a hospital.
* **Views:** Built the `vw_pending_requests` view to automatically sort incoming hospital requests so the most urgent (*Critical*) ones show up at the top automatically.
