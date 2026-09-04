/**
 * Location Dropdowns, Customer Map, and Driver/Admin Map View Verification Suite
 * Tests all 12 scenarios specified in the user request.
 */

const http = require('http');
const db = require('../database/db');
const IndiaLocations = require('../js/india-locations.js');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };

    if (body) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        body = JSON.stringify(body);
        if (!options.headers['Content-Type']) {
          options.headers['Content-Type'] = 'application/json';
        }
      }
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  RUNNING LOCATION DROPDOWNS & MAP INTEGRATION TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: State Dropdown Dataset
    // -------------------------------------------------------------
    console.log('[TEST 1 & 2 & 3] Structured India State/District Dataset & Dependencies');
    const states = IndiaLocations.getStates();
    assert(states.length >= 36, `All 36 Indian states and union territories are present (found ${states.length})`);
    assert(states.includes('Tamil Nadu'), 'Tamil Nadu is in state list');
    assert(states.includes('Karnataka'), 'Karnataka is in state list');
    assert(states.includes('Kerala'), 'Kerala is in state list');

    // TEST 2: Select Tamil Nadu -> Tamil Nadu districts only
    const tnDistricts = IndiaLocations.getDistricts('Tamil Nadu');
    assert(tnDistricts.length === 38, `Tamil Nadu has 38 official districts (found ${tnDistricts.length})`);
    assert(tnDistricts.includes('Chennai') && tnDistricts.includes('Coimbatore') && tnDistricts.includes('Madurai'), 'TN includes Chennai, Coimbatore, Madurai');
    assert(!tnDistricts.includes('Bengaluru Urban') && !tnDistricts.includes('Ernakulam'), 'TN does not include Karnataka or Kerala districts');

    // TEST 3: Change State -> Districts reset to selected state
    const kaDistricts = IndiaLocations.getDistricts('Karnataka');
    assert(kaDistricts.some(d => d.includes('Bengaluru') || d.includes('Bangalore')), 'Karnataka districts include Bengaluru/Bangalore');
    assert(!kaDistricts.includes('Chennai'), 'Karnataka districts do not include Chennai');

    // -------------------------------------------------------------
    // TEST 4, 5, 6: Customer Map Coordinates & Database Persistence
    // -------------------------------------------------------------
    console.log('\n[TEST 4, 5, 6] Customer Enquiry Submission with Coordinates & Address');
    const testEnquiryPayload = {
      name: 'Ramesh Kumar (Test Location)',
      phone: '9876500112',
      pickupState: 'Tamil Nadu',
      pickupDistrict: 'Chennai',
      pickupCity: 'Guindy',
      pickupAddress: 'Plot 45, Industrial Estate, Guindy, Chennai',
      pickupLatitude: 13.0067,
      pickupLongitude: 80.2021,
      dropState: 'Tamil Nadu',
      dropDistrict: 'Coimbatore',
      dropCity: 'Gandhipuram',
      dropAddress: '100 Feet Road, Gandhipuram',
      goodsCategory: 'Industrial Machinery',
      quantity: '2.5 Tons',
      vehiclePreferred: '14 Feet Truck',
      message: 'Fragile electrical control panels. Need prompt morning pickup.'
    };

    const enqRes = await httpRequest('POST', '/api/enquiries', testEnquiryPayload);
    assert((enqRes.status === 200 || enqRes.status === 201) && enqRes.data && enqRes.data.success, 'Customer enquiry submitted successfully');

    const enquiryId = enqRes.data.id || enqRes.data.enquiry?.id;
    assert(!!enquiryId, `Created enquiry ID: ${enquiryId}`);

    // TEST 6: Check Database
    const savedRow = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(enquiryId);
    assert(savedRow !== undefined, 'Enquiry record exists in SQLite database');
    assert(savedRow.pickup_state === 'Tamil Nadu', 'pickup_state correctly saved');
    assert(savedRow.pickup_district === 'Chennai', 'pickup_district correctly saved');
    assert(savedRow.pickup_city === 'Guindy', 'pickup_city correctly saved');
    assert(savedRow.pickup_address === 'Plot 45, Industrial Estate, Guindy, Chennai', 'pickup_address correctly saved');
    assert(Math.abs(savedRow.pickup_latitude - 13.0067) < 0.0001, `pickup_latitude correctly saved (${savedRow.pickup_latitude})`);
    assert(Math.abs(savedRow.pickup_longitude - 80.2021) < 0.0001, `pickup_longitude correctly saved (${savedRow.pickup_longitude})`);
    assert(savedRow.drop_state === 'Tamil Nadu' && savedRow.drop_district === 'Coimbatore', 'drop state and district saved');

    // -------------------------------------------------------------
    // TEST 7: Admin Portal Access to Enquiry Location
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Admin Portal Location Access');
    const adminLoginRes = await httpRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123'
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.data?.token, 'Admin authentication successful');
    const adminToken = adminLoginRes.data?.token;

    const adminEnqRes = await httpRequest('GET', `/api/enquiries/admin/${enquiryId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(adminEnqRes.status === 200 && adminEnqRes.data?.success, 'Admin can fetch enquiry details');
    const adminEnquiryData = adminEnqRes.data.data;
    assert(adminEnquiryData.pickup_latitude === 13.0067, 'Admin receives exact pickup_latitude');
    assert(adminEnquiryData.pickup_longitude === 80.2021, 'Admin receives exact pickup_longitude');
    assert(adminEnquiryData.pickup_address.includes('Guindy'), 'Admin receives full pickup address');

    // -------------------------------------------------------------
    // TEST 8 & 9: Driver A Assignment & Pickup Location Viewing
    // -------------------------------------------------------------
    console.log('\n[TEST 8 & 9 & 10] Driver Assignment, Location Isolation & Privacy');
    const bcrypt = require('bcryptjs');
    const driverPassHash = bcrypt.hashSync('driver123', 10);

    // Ensure two test drivers exist: Driver A and Driver B
    let driverA = db.prepare("SELECT * FROM driver_applications WHERE phone = '9999900001'").get();
    if (!driverA) {
      db.prepare(`
        INSERT INTO driver_applications (full_name, phone, email, state, district, location, address, vehicle_type, vehicle_number, status, password_hash)
        VALUES ('Driver Alpha', '9999900001', 'driverA@test.com', 'Tamil Nadu', 'Chennai', 'Chennai', 'Guindy Depot', '14-feet', 'TN09AB1001', 'approved', ?)
      `).run(driverPassHash);
      driverA = db.prepare("SELECT * FROM driver_applications WHERE phone = '9999900001'").get();
    } else {
      db.prepare("UPDATE driver_applications SET password_hash = ?, status = 'approved' WHERE id = ?").run(driverPassHash, driverA.id);
    }

    let driverB = db.prepare("SELECT * FROM driver_applications WHERE phone = '9999900002'").get();
    if (!driverB) {
      db.prepare(`
        INSERT INTO driver_applications (full_name, phone, email, state, district, location, address, vehicle_type, vehicle_number, status, password_hash)
        VALUES ('Driver Beta', '9999900002', 'driverB@test.com', 'Tamil Nadu', 'Madurai', 'Madurai', 'Madurai Yard', '14-feet', 'TN58CD2002', 'approved', ?)
      `).run(driverPassHash);
      driverB = db.prepare("SELECT * FROM driver_applications WHERE phone = '9999900002'").get();
    } else {
      db.prepare("UPDATE driver_applications SET password_hash = ?, status = 'approved' WHERE id = ?").run(driverPassHash, driverB.id);
    }

    // Assign enquiry to Driver A
    const assignRes = await httpRequest('PATCH', `/api/enquiries/admin/${enquiryId}/assign`, {
      driverId: driverA.id,
      driverName: driverA.full_name,
      driverPhone: driverA.phone,
      assignmentStatus: 'Waiting for Driver Confirmation',
      adminNotes: 'Handle fragile load with care.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(assignRes.status === 200 && assignRes.data?.success, 'Admin successfully assigned order to Driver A');

    // Driver A logs in
    const driverALogin = await httpRequest('POST', '/api/driver/auth/login', {
      phone: '9999900001',
      password: 'driver123'
    });
    assert(driverALogin.status === 200 && driverALogin.data?.token, 'Driver A login successful');
    const driverAToken = driverALogin.data?.token;

    // Driver A gets orders
    const driverAOrders = await httpRequest('GET', '/api/driver/orders', null, {
      'Authorization': `Bearer ${driverAToken}`
    });
    assert(driverAOrders.status === 200 && driverAOrders.data?.success, 'Driver A fetched assigned orders');
    const driverAOrder = driverAOrders.data.data.find(o => o.id === enquiryId);
    assert(driverAOrder !== undefined, 'Assigned order is present in Driver A orders list');
    assert(driverAOrder.pickup_latitude === 13.0067 && driverAOrder.pickup_longitude === 80.2021, 'Driver A can access exact pickup coordinates');
    assert(driverAOrder.pickup_address === 'Plot 45, Industrial Estate, Guindy, Chennai', 'Driver A can access pickup address');

    // TEST 10: Driver B (unassigned) CANNOT access customer pickup location
    const driverBLogin = await httpRequest('POST', '/api/driver/auth/login', {
      phone: '9999900002',
      password: 'driver123'
    });
    assert(driverBLogin.status === 200 && driverBLogin.data?.token, 'Driver B login successful');
    const driverBToken = driverBLogin.data?.token;

    const driverBOrders = await httpRequest('GET', '/api/driver/orders', null, {
      'Authorization': `Bearer ${driverBToken}`
    });
    const driverBHasOrder = driverBOrders.data.data.some(o => o.id === enquiryId);
    assert(driverBHasOrder === false, 'Driver B (unassigned) CANNOT see or access Customer A order or location');

    // Public / Unauthenticated user cannot access order location
    const unauthRes = await httpRequest('GET', `/api/enquiries/admin/${enquiryId}`);
    assert(unauthRes.status === 401, 'Unauthenticated public request cannot access customer location data (HTTP 401)');

    // -------------------------------------------------------------
    // TEST 11: Legacy Enquiries Without Coordinates
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Legacy Enquiries Without Coordinates Fallback');
    const legacyEnquiryPayload = {
      name: 'Legacy Customer (No GPS)',
      phone: '9840011223',
      pickupCity: 'Salem',
      dropCity: 'Trichy',
      goodsCategory: 'Textiles',
      quantity: '500 Kg'
    };
    const legRes = await httpRequest('POST', '/api/enquiries', legacyEnquiryPayload);
    const legId = legRes.data.id || legRes.data.enquiry?.id;
    assert(!!legId, 'Legacy-style enquiry without coordinates created successfully');

    const legRow = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(legId);
    assert(legRow.pickup_latitude === null && legRow.pickup_longitude === null, 'Legacy record coordinates are null as expected');
    assert(legRow.pickup_city === 'Salem', 'Legacy city continues working normally');

    // Admin can view legacy enquiry without errors
    const adminLegRes = await httpRequest('GET', `/api/enquiries/admin/${legId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(adminLegRes.status === 200, 'Admin can fetch legacy enquiry without coordinates');

    // -------------------------------------------------------------
    // TEST 12: Existing Workflows & Regression Verification
    // -------------------------------------------------------------
    console.log('\n[TEST 12] Core Business Logic Integrity & Regression Checks');
    // Stats endpoint
    const statsRes = await httpRequest('GET', '/api/admin/stats', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(statsRes.status === 200 && statsRes.data?.stats, 'Admin stats API working');

    // Vehicles endpoint
    const vehRes = await httpRequest('GET', '/api/vehicles');
    assert(vehRes.status === 200 && vehRes.data?.data?.length > 0, 'Public vehicles catalog API working');

    console.log('\n===============================================================');
    console.log(`  ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

runTests();
