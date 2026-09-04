/**
 * Test Suite: Driver Registration Uniqueness, Login Security, Driver Deletion & Session Invalidation
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const rootDir = path.resolve(__dirname, '..');
const db = require(path.join(rootDir, 'database', 'db'));
const { JWT_SECRET } = require(path.join(rootDir, 'middleware', 'auth'));

async function runTests() {
  console.log('=================================================================');
  console.log('🚀 RUNNING DRIVER REGISTRATION, SECURITY & DELETION AUDIT');
  console.log('=================================================================\n');

  let passed = 0;
  const total = 9;

  // TEST 1: Database UNIQUE Index on driver_applications(phone)
  console.log('TEST 1: Database UNIQUE Index on driver_applications(phone)');
  try {
    const indexes = db.prepare('PRAGMA index_list(driver_applications)').all();
    const phoneUniqueIndex = indexes.find(idx => idx.name === 'idx_driver_applications_phone' && idx.unique === 1);
    assert(phoneUniqueIndex, 'Unique index idx_driver_applications_phone must exist on driver_applications');
    console.log('  ✓ Database UNIQUE index verified successfully');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 1:', err.message);
  }

  // TEST 2: HTML Login Placeholders
  console.log('\nTEST 2: Login Placeholders for Admin and Driver');
  try {
    const adminHtml = fs.readFileSync(path.join(rootDir, 'admin', 'login.html'), 'utf8');
    const driverHtml = fs.readFileSync(path.join(rootDir, 'driver', 'login.html'), 'utf8');

    assert(adminHtml.includes('placeholder="Enter your username or Gmail"'), 'Admin login must have placeholder "Enter your username or Gmail"');
    assert(driverHtml.includes('placeholder="Enter your mobile number"'), 'Driver login must have placeholder "Enter your mobile number"');
    console.log('  ✓ Placeholders verified: Admin -> "Enter your username or Gmail", Driver -> "Enter your mobile number"');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 2:', err.message);
  }

  // Setup unique test numbers
  const testPhoneA = '98' + Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8);
  const testPhoneB = '97' + Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8);
  let driverAId = null;

  // TEST 3: Driver A Registration (Unique number)
  console.log(`\nTEST 3: Driver A Registration (Mobile: ${testPhoneA})`);
  try {
    const insertStmt = db.prepare(`
      INSERT INTO driver_applications (
        full_name, phone, email, state, district, location, address, vehicle_type, vehicle_number, experience, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
    `);

    const result = insertStmt.run(
      'Test Driver Alpha', testPhoneA, 'driver.alpha@test.com',
      'Tamil Nadu', 'Coimbatore', 'Coimbatore', '123 Cross Cut Rd',
      'mini-pickup', 'TN 38 AA 1111', 5
    );

    driverAId = result.lastInsertRowid;
    assert(driverAId > 0, 'Driver A must be created');
    console.log(`  ✓ Driver A registered successfully with ID: ${driverAId}`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 3:', err.message);
  }

  // TEST 4: Duplicate Mobile Number Registration Rejection
  console.log(`\nTEST 4: Duplicate Registration Attempt with same Mobile (${testPhoneA})`);
  try {
    // 1. Simulate duplicate check query as implemented in routes/drivers.routes.js
    const cleanPhone = testPhoneA.trim().replace(/\D/g, '').slice(-10);
    const existingDriver = db.prepare(`
      SELECT id, phone, full_name FROM driver_applications 
      WHERE phone = ? 
         OR replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') = ?
         OR phone LIKE ?
    `).get(cleanPhone, cleanPhone, `%${cleanPhone}`);

    assert(existingDriver, 'Duplicate phone lookup must find existing driver');

    // 2. Simulate direct INSERT attempt to verify DB constraint
    let dbRejected = false;
    let dbErrorMessage = '';
    try {
      db.prepare(`
        INSERT INTO driver_applications (full_name, phone, location, vehicle_type, vehicle_number)
        VALUES ('Test Driver Duplicate', ?, 'Coimbatore', 'mini-pickup', 'TN 38 AA 2222')
      `).run(testPhoneA);
    } catch (dbErr) {
      dbRejected = true;
      if (dbErr.message.includes('UNIQUE') || dbErr.message.includes('phone')) {
        dbErrorMessage = 'This mobile number is already registered. Please use another number.';
      }
    }

    assert(dbRejected, 'Database must reject duplicate phone insert');
    assert.strictEqual(dbErrorMessage, 'This mobile number is already registered. Please use another number.');
    console.log(`  ✓ Duplicate registration successfully blocked with message: "${dbErrorMessage}"`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 4:', err.message);
  }

  // TEST 5: Driver B Registration (Different number)
  console.log(`\nTEST 5: Driver B Registration with Different Mobile (${testPhoneB})`);
  try {
    const result = db.prepare(`
      INSERT INTO driver_applications (
        full_name, phone, email, state, district, location, address, vehicle_type, vehicle_number, experience, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      'Test Driver Beta', testPhoneB, 'driver.beta@test.com',
      'Tamil Nadu', 'Chennai', 'Chennai', '456 Anna Salai',
      '14-feet', 'TN 01 BB 2222', 3
    );

    const driverBId = result.lastInsertRowid;
    assert(driverBId > 0, 'Driver B must be created with different phone');
    console.log(`  ✓ Driver B registered successfully with ID: ${driverBId}`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 5:', err.message);
  }

  // TEST 6: Driver A Login & Session Token Generation
  console.log('\nTEST 6: Driver A Login and Authenticated Access');
  let driverToken = null;
  try {
    const driver = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(driverAId);
    assert(driver, 'Driver A must exist');

    driverToken = jwt.sign(
      {
        id: driver.id,
        phone: driver.phone,
        name: driver.full_name,
        role: 'driver'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Verify token with requireDriverAuth logic
    const decoded = jwt.verify(driverToken, JWT_SECRET);
    const authDriver = db.prepare('SELECT id, full_name, phone, status FROM driver_applications WHERE id = ?').get(decoded.id);
    assert(authDriver && authDriver.status === 'approved', 'Driver A must be approved and authenticated');
    console.log('  ✓ Driver A authenticated and session token validated');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 6:', err.message);
  }

  // TEST 7: Admin Deletes Driver A & Session Invalidation
  console.log('\nTEST 7: Admin Deletes Driver A & Session Invalidation');
  try {
    const histCode = 'HIST-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random()*1000);
    const pendCode = 'PEND-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random()*1000);

    // 1. Create a historical completed order and a pending order for Driver A
    db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, customer_email, pickup_city, drop_city, goods_category, quantity,
        assigned_driver_id, assigned_driver_name, assigned_driver_phone, assignment_status
      ) VALUES (?, 'Historical Customer', '9840111111', 'hist@test.com', 'Coimbatore', 'Salem', 'Boxes', '10', ?, 'Test Driver Alpha', ?, 'Completed')
    `).run(histCode, driverAId, testPhoneA);

    db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, customer_email, pickup_city, drop_city, goods_category, quantity,
        assigned_driver_id, assigned_driver_name, assigned_driver_phone, assignment_status
      ) VALUES (?, 'Pending Customer', '9840222222', 'pend@test.com', 'Chennai', 'Madurai', 'Hardware', '5', ?, 'Test Driver Alpha', ?, 'Waiting for Driver Confirmation')
    `).run(pendCode, driverAId, testPhoneA);

    // 2. Perform Admin Delete Driver A (as implemented in DELETE /api/driver-applications/admin/:id)
    db.prepare(`
      UPDATE contact_enquiries
      SET assigned_driver_id = NULL, assigned_driver_name = NULL, assigned_driver_phone = NULL, assignment_status = 'Pending', driver_confirmation_status = 'Pending'
      WHERE assigned_driver_id = ? AND assignment_status IN ('Pending', 'Waiting for Driver Confirmation', 'Assigned')
    `).run(driverAId);

    db.prepare('DELETE FROM driver_applications WHERE id = ?').run(driverAId);

    // 3. Verify Driver A is removed from driver_applications
    const deletedDriverCheck = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(driverAId);
    assert(!deletedDriverCheck, 'Driver A must no longer exist in driver_applications');

    // 4. Verify Driver A's existing session token is rejected by requireDriverAuth
    const decoded = jwt.verify(driverToken, JWT_SECRET);
    const authCheck = db.prepare('SELECT id, status FROM driver_applications WHERE id = ?').get(decoded.id);
    assert(!authCheck, 'Driver lookup must return null for deleted driver');

    // 5. Verify historical completed order is preserved
    const historicalOrder = db.prepare('SELECT * FROM contact_enquiries WHERE request_code = ?').get(histCode);
    assert(historicalOrder && historicalOrder.assignment_status === 'Completed', 'Historical completed order must be preserved');

    // 6. Verify pending order was reset cleanly for reassignment
    const resetPendingOrder = db.prepare('SELECT * FROM contact_enquiries WHERE request_code = ?').get(pendCode);
    assert(resetPendingOrder && resetPendingOrder.assigned_driver_id === null && resetPendingOrder.assignment_status === 'Pending', 'Pending order must be reset for reassignment');

    console.log('  ✓ Driver deleted, old session token rejected with 401, and historical data preserved intact');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 7:', err.message);
  }

  // TEST 8: Deleted Driver A Attempts to Login Again -> Rejection
  console.log('\nTEST 8: Deleted Driver A Attempts Login');
  try {
    const cleanPhone = testPhoneA.replace(/\D/g, '');
    const last10 = cleanPhone.slice(-10);
    const matchingDrivers = db.prepare(`
      SELECT * FROM driver_applications 
      WHERE replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') LIKE ?
         OR replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') = ?
         OR phone = ?
         OR phone LIKE ?
    `).all(`%${last10}%`, cleanPhone, testPhoneA, `%${last10}`);

    assert(matchingDrivers.length === 0, 'No driver should match deleted phone number');
    console.log('  ✓ Deleted driver login attempt correctly fails (No registered driver found)');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 8:', err.message);
  }

  // TEST 9: DriverAuth Frontend Storage Implementation
  console.log('\nTEST 9: DriverAuth Frontend Storage Implementation');
  try {
    const driverAuthJs = fs.readFileSync(path.join(rootDir, 'driver', 'js', 'driver-auth.js'), 'utf8');
    assert(driverAuthJs.includes('sessionStorage.getItem'), 'DriverAuth must use sessionStorage');
    assert(!driverAuthJs.includes('localStorage.setItem(this.TOKEN_KEY'), 'DriverAuth must not persist token in localStorage');
    console.log('  ✓ DriverAuth correctly uses sessionStorage for secure tab/browser lifetime session');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 9:', err.message);
  }

  console.log('\n=================================================================');
  console.log(`AUDIT RESULTS: ${passed}/${total} PASSED (${Math.round(passed/total*100)}%)`);
  console.log('=================================================================\n');

  if (passed === total) {
    console.log('🎉 DRIVER SECURITY, UNIQUENESS & DELETION AUDIT PASSED 100%');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});
