# Blood Bank System Presentation Script

## Introduction (2 Minutes)

**Speaker:**
"Hello everyone. Today, I'll be presenting our work on the Blood Bank Management System. Specifically, I focused on the vital components that keep the system running: how we intake blood (Donations), manage our clients (Hospitals), and handle external dispatches (Blood Requests). 

Our goal was to make this as realistic as possible to mirror how actual clinical blood banks operate."

## Database Concepts Used (3 Minutes)

**Speaker:**
"Before showing the system, I want to briefly touch on the underlying database engine, because that's where the real magic happens.

We used a variety of advanced SQL concepts to ensure data integrity:
1. **Constraints:** We used *Check Constraints* like `chk_units_donated` to ensure nobody can illegally log a donation of more than 2 units. We also used *Unique Constraints* on fields like the hospital `license_number` to prevent duplicate clinical registrations. 
2. **Triggers:** A blood bank needs real-time inventory. We designed two triggers: `after_donation_insert` and `after_fulfillment_insert`. So, the exact second a bag of blood clears testing or is shipped out to a hospital, the master `blood_inventory` totals automatically adjust themselves. 
3. **Stored Procedures & Transactions:** The most complex part was fulfilling a blood request. We wrote a stored procedure called `sp_fulfill_request`. We wrapped it in a strict SQL `START TRANSACTION`. It checks if we have enough blood, creates a dispatch log, deducts the inventory, and marks the request as fulfilled. If any step fails—say, we don't actually have enough units—it hits `ROLLBACK` and completely cancels the operation, protecting our data."

## Live Demonstration (5 Minutes)

**[Action: Open the Hospital Dashboard in your browser]**

**Speaker:**
"Let's look at the system in action. This is the Hospital Portal. 

*   **(Point to the screen):** An external hospital can log in here. 
*   They can view their past request history. 
*   Let's raise a new request. As you can see, instead of just asking for 'A+', hospitals can request specific components like 'Plasma' or 'Platelets' for specific patient diagnoses.

**[Action: Raise a new test request on the portal for 'Critical' urgency]**

**Speaker:**
"I've just submitted a 'Critical' request. Now, let's switch to the internal staff dashboard."

**[Action: Open the main Staff Dashboard -> Requests screen]**

**Speaker:**
"We are now looking at what the Blood Bank staff sees. 
*   Notice how the new request we just made is automatically pushed to the very top of the list? We built a SQL View called `vw_pending_requests` that automatically sorts the incoming requests based on medical urgency—*Critical* cases jump to the top automatically.

**[Action: Click 'Approve/Fulfill' on the new request]**

**Speaker:**
"I'm now going to fulfill this request. 
*   When I click dispatch, a window opens asking for the exact `dispatch_temperature` and `transport_mode`. Real blood requires strict cold-chain logistics, so we enforce recording this data before it leaves the building.

**[Action: Submit the fulfillment form, then navigate to the Inventory page]**

**Speaker:**
"The request is now marked as fulfilled! But here is the most important part: Let's check our Blood Stock table. 
*   Because of the database triggers I mentioned earlier, our total stock for this blood group has already dropped in the background. The system self-managed the data update without me having to manually deduct the numbers." 

## Conclusion (1 Minute)

**Speaker:**
"To summarize, we've successfully modeled real-world features like component separation, cold-chain logistics, and automated inventory control completely at the database level. 

Thank you! Are there any questions?"
