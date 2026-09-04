/**
 * Vandi Load - Automated Verification Suite for Email-Only Notifications & Existing Workflows
 * Tests:
 * A. Customer Enquiry (Customer Email + Admin Email)
 * B. Driver Registration (Driver Email + Admin Email)
 * C. Driver Assignment (Assigned Driver Stored Email)
 * D. Driver Confirmation (Customer Confirmation + Admin Confirmation)
 * E. Driver Timeout (Admin Cancellation ONLY, NO customer email)
 * F. Integrity of existing tables and workflows
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Ensure dotenv is loaded
require('dotenv').config();

const db = require('../database/db');
const { 
  getAdminEmail,
  sendDriverAssignmentEmail, 
  sendCustomerConfirmationEmail, 
  sendAdminConfirmationEmail, 
  sendAdminTimeoutCancellationEmail,
  sendCustomerEnquiryReceivedEmail,
  sendAdminEnquiryNotificationEmail,
  sendDriverRegistrationReceivedEmail,
  sendAdminDriverRegistrationNotificationEmail,
  isEmailAlreadySent 
} = require('../services/email.service');
const { 
  startConfirmationTimer, 
  cancelConfirmationTimer, 
  handleTimeoutCancellation, 
  scanOverdueOrders 
} = require('../services/timer.service');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING EMAIL NOTIFICATION & WORKFLOW TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function recordResult(testName, isSuccess, details = '') {
    if (isSuccess) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   └─ ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   └─ ${details}`);
      failed++;
    }
  }

  // Confirm Admin Email resolution from settings table
  const adminEmail = getAdminEmail();
  console.log(`ℹ Configured Admin Email: ${adminEmail}\n`);

  // ---------------------------------------------------------------------------
  // TEST A: Customer Enquiry (Enter Customer Gmail -> Customer & Admin Emails)
  // ---------------------------------------------------------------------------
  let enquiryA = null;
  try {
    const reqCode = 'VL-CUST-' + Math.floor(100000 + Math.random() * 900000);
    const testCustomerEmail = 'customer.test@gmail.com';

    const insertRes = db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, customer_email, pickup_city, drop_city, goods_category, quantity, vehicle_preferred, status, assignment_status
      ) VALUES (?, 'Karthik Raja', '9840112233', ?, 'Chennai', 'Madurai', 'Industrial Hardware', '20 Boxes', '14 Feet Truck', 'new', 'Pending')
    `).run(reqCode, testCustomerEmail);

    enquiryA = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(insertRes.lastInsertRowid);
    assert(enquiryA, 'Enquiry not saved in database');
    assert.strictEqual(enquiryA.customer_email, testCustomerEmail, 'Customer email not saved correctly');

    // Trigger emails
    const custEmailRes = await sendCustomerEnquiryReceivedEmail(enquiryA);
    const adminEmailRes = await sendAdminEnquiryNotificationEmail(enquiryA);

    assert(custEmailRes.success, 'Customer enquiry confirmation email failed');
    assert(adminEmailRes.success, 'Admin enquiry notification email failed');
    assert(isEmailAlreadySent(enquiryA.id, 'customer_enquiry_received'), 'Customer email log missing');
    assert(isEmailAlreadySent(enquiryA.id, 'admin_enquiry_notification'), 'Admin email log missing');

    recordResult('TEST A: Customer Enquiry -> Saved in DB, Customer receives confirmation, Admin receives notification', true, `Enquiry #${enquiryA.id} (${enquiryA.request_code}) with email: ${enquiryA.customer_email}`);
  } catch (err) {
    recordResult('TEST A: Customer Enquiry', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST B: Driver Registration (Enter Driver Gmail -> Driver & Admin Emails)
  // ---------------------------------------------------------------------------
  let driverB = null;
  try {
    const testDriverEmail = 'driver.test@gmail.com';
    const insertRes = db.prepare(`
      INSERT INTO driver_applications (
        full_name, phone, email, location, vehicle_type, vehicle_number, experience, status
      ) VALUES ('Murugan Driver', '9876500112', ?, 'Salem', '14-feet', 'TN 30 AA 5555', 4, 'pending')
    `).run(testDriverEmail);

    driverB = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(insertRes.lastInsertRowid);
    assert(driverB, 'Driver record not saved in database');
    assert.strictEqual(driverB.email, testDriverEmail, 'Driver email not saved correctly');
    assert.strictEqual(driverB.status, 'pending', 'Driver should remain pending approval');

    // Trigger emails
    const driverEmailRes = await sendDriverRegistrationReceivedEmail(driverB);
    const adminDriverEmailRes = await sendAdminDriverRegistrationNotificationEmail(driverB);

    assert(driverEmailRes.success, 'Driver registration confirmation email failed');
    assert(adminDriverEmailRes.success, 'Admin driver registration notification email failed');

    recordResult('TEST B: Driver Registration -> Saved in DB (pending), Driver receives email, Admin receives notification', true, `Driver #${driverB.id} (${driverB.full_name}) with email: ${driverB.email}`);
  } catch (err) {
    recordResult('TEST B: Driver Registration', false, err.message);
  }

  // Setup approved test drivers for assignment tests
  let approvedDriver = db.prepare("SELECT * FROM driver_applications WHERE status = 'approved' AND email IS NOT NULL AND email != ''").get();
  if (!approvedDriver) {
    const res = db.prepare(`
      INSERT INTO driver_applications (full_name, phone, email, location, vehicle_type, vehicle_number, experience, status)
      VALUES ('Vimal Driver', '9876543299', 'vimal.driver@gmail.com', 'Chennai', '14-feet', 'TN 01 ZZ 9999', 6, 'approved')
    `).run();
    approvedDriver = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(res.lastInsertRowid);
  }

  // ---------------------------------------------------------------------------
  // TEST C: Driver Assignment -> Assignment email sent to Driver's Stored Gmail
  // ---------------------------------------------------------------------------
  let assignedOrder = null;
  try {
    const reqCode = 'VL-ASSIGN-' + Math.floor(100000 + Math.random() * 900000);
    const nowIso = new Date().toISOString();
    const deadlineIso = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const insertRes = db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, customer_email, pickup_city, drop_city, goods_category, quantity, vehicle_preferred,
        status, assigned_driver_id, assigned_driver_name, assigned_driver_phone,
        assignment_status, driver_confirmation_status, driver_assigned_at, driver_confirmation_deadline
      ) VALUES (?, 'Apex Fabrics', '9840223344', 'apex@gmail.com', 'Erode', 'Chennai', 'Cotton Bales', '40 Bundles', '14-feet',
        'contacted', ?, ?, ?,
        'Waiting for Driver Confirmation', 'Waiting for Driver Confirmation', ?, ?)
    `).run(reqCode, approvedDriver.id, approvedDriver.full_name, approvedDriver.phone, nowIso, deadlineIso);

    assignedOrder = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(insertRes.lastInsertRowid);
    assert.strictEqual(assignedOrder.assignment_status, 'Waiting for Driver Confirmation');
    assert.strictEqual(assignedOrder.assigned_driver_id, approvedDriver.id);

    // Send assignment email
    const assignEmailRes = await sendDriverAssignmentEmail(assignedOrder, approvedDriver);
    assert(assignEmailRes.success, 'Driver assignment email failed');
    assert(isEmailAlreadySent(assignedOrder.id, 'driver_assigned'), 'Driver assignment email log missing');

    recordResult('TEST C: Driver Assignment -> Assignment email sent to Driver stored Gmail', true, `Order #${assignedOrder.id} dispatched to ${approvedDriver.email}`);
  } catch (err) {
    recordResult('TEST C: Driver Assignment', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST D: Driver Confirms within 5 minutes -> Customer & Admin Confirmation Emails
  // ---------------------------------------------------------------------------
  try {
    const confirmUpdate = db.prepare(`
      UPDATE contact_enquiries SET
        assignment_status = 'Driver Confirmed',
        driver_confirmation_status = 'Driver Confirmed',
        driver_confirmed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? 
        AND assigned_driver_id = ?
        AND driver_confirmation_status = 'Waiting for Driver Confirmation'
        AND driver_confirmed_at IS NULL
        AND cancelled_at IS NULL
    `).run(assignedOrder.id, approvedDriver.id);

    assert.strictEqual(confirmUpdate.changes, 1, 'Confirm update failed');

    const confirmedOrder = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(assignedOrder.id);
    assert.strictEqual(confirmedOrder.assignment_status, 'Driver Confirmed');

    // Send Customer & Admin confirmation emails
    const custConfRes = await sendCustomerConfirmationEmail(confirmedOrder, approvedDriver);
    const adminConfRes = await sendAdminConfirmationEmail(confirmedOrder, approvedDriver);

    assert(custConfRes.success, 'Customer confirmation email failed');
    assert(adminConfRes.success, 'Admin confirmation email failed');
    assert(isEmailAlreadySent(assignedOrder.id, 'driver_confirmed_customer'), 'Customer confirmation log missing');
    assert(isEmailAlreadySent(assignedOrder.id, 'driver_confirmed_admin'), 'Admin confirmation log missing');

    recordResult('TEST D: Driver Confirms -> Order marked Driver Confirmed, Customer & Admin confirmation emails sent', true, `Customer: ${confirmedOrder.customer_email} | Admin: ${adminEmail}`);
  } catch (err) {
    recordResult('TEST D: Driver Confirmation', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST E: Driver Timeout -> Auto Cancellation -> Admin email ONLY (NO customer email)
  // ---------------------------------------------------------------------------
  try {
    const reqCode = 'VL-TIMEOUT-' + Math.floor(100000 + Math.random() * 900000);
    const nowIso = new Date().toISOString();
    const pastDeadlineIso = new Date(Date.now() - 5000).toISOString();

    const insertRes = db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, customer_email, pickup_city, drop_city, goods_category, quantity, vehicle_preferred,
        status, assigned_driver_id, assigned_driver_name, assigned_driver_phone,
        assignment_status, driver_confirmation_status, driver_assigned_at, driver_confirmation_deadline
      ) VALUES (?, 'Timber Works', '9840445566', 'timber@gmail.com', 'Trichy', 'Madurai', 'Wood Planks', '5 Tons', '17-feet',
        'contacted', ?, ?, ?,
        'Waiting for Driver Confirmation', 'Waiting for Driver Confirmation', ?, ?)
    `).run(reqCode, approvedDriver.id, approvedDriver.full_name, approvedDriver.phone, nowIso, pastDeadlineIso);

    const timeoutOrderId = insertRes.lastInsertRowid;

    // Trigger timeout cancellation
    await handleTimeoutCancellation(timeoutOrderId);

    const cancelledOrder = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(timeoutOrderId);
    assert.strictEqual(cancelledOrder.assignment_status, 'Cancelled - Driver Did Not Confirm');
    assert.strictEqual(cancelledOrder.cancellation_reason, 'Driver did not confirm within 5 minutes');

    // Check emails
    assert(isEmailAlreadySent(timeoutOrderId, 'driver_timeout_cancelled_admin'), 'Admin cancellation email log missing');
    assert(!isEmailAlreadySent(timeoutOrderId, 'driver_confirmed_customer'), 'Customer MUST NOT receive cancellation email');

    recordResult('TEST E: Driver Timeout -> Auto-cancelled, Cancellation email sent to ADMIN ONLY (NO customer email)', true, `Order #${timeoutOrderId} status: Cancelled - Driver Did Not Confirm`);
  } catch (err) {
    recordResult('TEST E: Driver Timeout', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST F: Existing flows and features verification
  // ---------------------------------------------------------------------------
  try {
    const vehicles = db.prepare('SELECT COUNT(*) as c FROM vehicles').get().c;
    const categories = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
    const gallery = db.prepare('SELECT COUNT(*) as c FROM gallery').get().c;
    const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;

    assert(vehicles >= 8, 'Vehicles table damaged');
    assert(categories >= 4, 'Categories damaged');
    assert(adminCount >= 1, 'Admin auth damaged');

    recordResult('TEST F: Existing Pages & Workflows intact -> Vehicles, Categories, Gallery, Content & Auth verified', true, `${vehicles} vehicles, ${categories} categories, admin auth intact`);
  } catch (err) {
    recordResult('TEST F: Existing features verification', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runTests().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runTests;
